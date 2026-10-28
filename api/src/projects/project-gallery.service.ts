import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProjectStatus, ProjectVisibility, RolNombre } from '@perfil/shared';
import { Project } from '../entities/project.entity';
import { ProjectImage } from '../entities/project-image.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService, scopeSql } from '../access/teacher-scope.service';
import { ProjectsService } from './projects.service';

/** V5 §13.4: hasta cinco imágenes de muestra por proyecto. */
export const MAX_PROJECT_IMAGES = 5;
const MIME_IMAGEN = /^image\/(png|jpeg|webp)$/;
export const COMMUNITY_PAGE_SIZE = 6;

/**
 * V5 BATCH 13 (§13.4): imágenes de muestra y «Proyectos de la carrera».
 *
 * - Las imágenes son de 0 a 5, PNG/JPG/WEBP subidas por el propio dueño, con
 *   una portada. No son evidencias y solo se ven donde el proyecto se ve (G08).
 * - La galería es para la comunidad con sesión: solo proyectos ACTIVE en la
 *   comunidad (`profile`) o con enlace público, y, para un docente, también
 *   los visibles a docentes de su alcance. Nunca un borrador, nunca correos ni
 *   evidencias (G07, G09).
 */
@Injectable()
export class ProjectGalleryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectImage) private readonly images: Repository<ProjectImage>,
    private readonly projectsService: ProjectsService,
    private readonly scope: TeacherScopeService,
  ) {}

  /** Imágenes de un proyecto, para quien ya puede verlo. */
  async list(user: AuthenticatedUser, projectId: string) {
    await this.projectsService.findOneForUser(user, projectId);
    return this.vista(projectId);
  }

  async add(user: AuthenticatedUser, projectId: string, fileId: string) {
    await this.assertDueno(user, projectId);
    const archivo = await this.dataSource.getRepository(StoredFileRecord).findOne({ where: { id: fileId } });
    if (!archivo || archivo.uploadedByUserId !== user.userId || !MIME_IMAGEN.test(archivo.mimeTypeDetected ?? '')) {
      const m = 'La imagen tiene que ser PNG, JPG o WEBP y haberla subido tú.';
      throw new BadRequestException({ message: m, fields: { fileId: [m] } });
    }
    return this.dataSource.transaction(async (m) => {
      // Bloquea el proyecto: dos subidas a la vez no pasan del límite.
      await m.getRepository(Project).createQueryBuilder('p').setLock('pessimistic_write').where('p.id = :id', { id: projectId }).getOne();
      const actuales = await m.getRepository(ProjectImage).find({ where: { projectId }, order: { position: 'ASC' } });
      if (actuales.some((i) => i.storedFileId === fileId)) throw new ConflictException('Esa imagen ya está en el proyecto.');
      if (actuales.length >= MAX_PROJECT_IMAGES) {
        const msg = `Un proyecto admite hasta ${MAX_PROJECT_IMAGES} imágenes. Quita una para agregar otra.`;
        throw new BadRequestException({ code: 'PROJECT_IMAGES_LIMIT', message: msg, fields: { fileId: [msg] } });
      }
      await m.getRepository(ProjectImage).save(m.getRepository(ProjectImage).create({
        projectId, storedFileId: fileId, position: actuales.length, isCover: actuales.length === 0,
      }));
      return this.vista(projectId, m.getRepository(ProjectImage));
    });
  }

  /** Portada u orden. Mover a una posición ocupada intercambia las dos. */
  async update(user: AuthenticatedUser, projectId: string, imageId: string, dto: { isCover?: boolean; position?: number }) {
    await this.assertDueno(user, projectId);
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(ProjectImage);
      const imagen = await repo.findOne({ where: { id: imageId, projectId } });
      if (!imagen) throw new NotFoundException('Imagen no encontrada.');
      if (dto.isCover === true && !imagen.isCover) {
        await repo.update({ projectId, isCover: true }, { isCover: false });
        await repo.update({ id: imagen.id }, { isCover: true });
      }
      if (dto.position !== undefined && dto.position !== imagen.position) {
        const total = await repo.count({ where: { projectId } });
        if (dto.position < 0 || dto.position >= total) {
          const msg = 'Posición fuera de rango.';
          throw new BadRequestException({ message: msg, fields: { position: [msg] } });
        }
        const otra = await repo.findOne({ where: { projectId, position: dto.position } });
        // Intercambio en dos pasos para no chocar con la posición repetida.
        if (otra) await repo.update({ id: otra.id }, { position: imagen.position });
        await repo.update({ id: imagen.id }, { position: dto.position });
      }
      return this.vista(projectId, repo);
    });
  }

  async remove(user: AuthenticatedUser, projectId: string, imageId: string) {
    await this.assertDueno(user, projectId);
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(ProjectImage);
      const imagen = await repo.findOne({ where: { id: imageId, projectId } });
      if (!imagen) throw new NotFoundException('Imagen no encontrada.');
      await repo.delete({ id: imagen.id });
      const quedan = await repo.find({ where: { projectId }, order: { position: 'ASC' } });
      for (const [i, q] of quedan.entries()) {
        if (q.position !== i) await repo.update({ id: q.id }, { position: i });
      }
      if (imagen.isCover && quedan.length) await repo.update({ id: quedan[0].id }, { isCover: true });
      return this.vista(projectId, repo);
    });
  }

  /** «Proyectos de la carrera»: 6 por página, con búsqueda y filtros por área y tecnología. */
  async community(user: AuthenticatedUser, q: { q?: string; areaId?: string; skillId?: string; page?: number }) {
    const pagina = Math.max(1, Math.floor(Number(q.page) || 1));
    const qb = this.projects.createQueryBuilder('p')
      .innerJoin('p.createdByProfile', 'sp')
      .innerJoin('sp.user', 'u')
      .where('p.status = :activo', { activo: ProjectStatus.ACTIVE });
    // Qué se ve según el rol: la comunidad y el enlace público para todos; lo
    // visible a docentes, para el docente de su alcance y para Administración.
    const abiertas = [ProjectVisibility.PROFILE, ProjectVisibility.PUBLIC_LINK];
    if (user.role === RolNombre.ADMIN) {
      qb.andWhere('p.visibility IN (:...vis)', { vis: [...abiertas, ProjectVisibility.TEACHERS] });
    } else if (user.role === RolNombre.TEACHER) {
      const alcance = await this.scope.scopeFor(user);
      if (alcance && alcance.length) {
        qb.andWhere(`(p.visibility IN (:...vis) OR (p.visibility = :doc AND ${scopeSql('sp', 'alcance')}))`, {
          vis: abiertas, doc: ProjectVisibility.TEACHERS, alcance,
        });
      } else {
        qb.andWhere('p.visibility IN (:...vis)', { vis: abiertas });
      }
    } else {
      qb.andWhere('p.visibility IN (:...vis)', { vis: abiertas });
    }
    const texto = (q.q ?? '').trim().slice(0, 80).replace(/[%_\\]/g, '');
    if (texto) qb.andWhere('(p.title ILIKE :t OR p.description ILIKE :t)', { t: `%${texto}%` });
    if (q.areaId && /^[0-9a-f-]{36}$/i.test(q.areaId)) {
      qb.andWhere('EXISTS (SELECT 1 FROM project_areas pa WHERE pa.project_id = p.id AND pa.academic_area_id = :area)', { area: q.areaId });
    }
    if (q.skillId && /^[0-9a-f-]{36}$/i.test(q.skillId)) {
      qb.andWhere('EXISTS (SELECT 1 FROM project_skills ps WHERE ps.project_id = p.id AND ps.skill_id = :skill)', { skill: q.skillId });
    }
    const total = await qb.getCount();
    const filas = await qb
      .select(['p.id', 'p.title', 'p.description', 'p.visibility', 'p.backingTier', 'p.updatedAt', 'p.createdByProfileId'])
      .addSelect(`u.first_name || ' ' || u.last_name`, 'owner')
      .orderBy('p.updated_at', 'DESC')
      .offset((pagina - 1) * COMMUNITY_PAGE_SIZE)
      .limit(COMMUNITY_PAGE_SIZE)
      .getRawAndEntities();
    const ids = filas.entities.map((p) => p.id);
    const extra = ids.length ? await this.dataSource.query(`
      SELECT p.id,
             ARRAY(SELECT a.name FROM project_areas pa JOIN academic_areas a ON a.id = pa.academic_area_id WHERE pa.project_id = p.id ORDER BY a.name) AS areas,
             ARRAY(SELECT s.name FROM project_skills ps JOIN skills s ON s.id = ps.skill_id WHERE ps.project_id = p.id ORDER BY s.name) AS skills,
             (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.id AND m.contribution_confirmed_at IS NOT NULL)::int AS confirmed_members,
             ARRAY(SELECT '/api/files/' || f.storage_key FROM project_images pi JOIN stored_files f ON f.id = pi.stored_file_id
                    WHERE pi.project_id = p.id ORDER BY pi.is_cover DESC, pi.position) AS images
        FROM projects p WHERE p.id = ANY($1::uuid[])`, [ids]) as { id: string; areas: string[]; skills: string[]; confirmed_members: number; images: string[] }[] : [];
    return {
      total,
      page: pagina,
      pageSize: COMMUNITY_PAGE_SIZE,
      items: filas.entities.map((p, i) => {
        const e = extra.find((x) => x.id === p.id);
        return {
          id: p.id,
          title: p.title,
          description: p.description ? p.description.slice(0, 280) : null,
          owner: (filas.raw[i] as { owner?: string })?.owner ?? null,
          areas: e?.areas ?? [],
          skills: e?.skills ?? [],
          confirmedMembers: e?.confirmed_members ?? 0,
          backingTier: p.backingTier,
          coverUrl: e?.images?.[0] ?? null,
          images: e?.images ?? [],
          updatedAt: p.updatedAt,
        };
      }),
    };
  }

  private async assertDueno(user: AuthenticatedUser, projectId: string) {
    const p = await this.projects.findOne({ where: { id: projectId }, relations: { createdByProfile: true } });
    if (!p) throw new NotFoundException('Proyecto no encontrado.');
    if (p.createdByProfile?.userId !== user.userId) {
      throw new ForbiddenException('Solo quien lleva el proyecto administra sus imágenes.');
    }
  }

  private async vista(projectId: string, repo: Repository<ProjectImage> = this.images) {
    const filas = await repo.find({ where: { projectId }, relations: { storedFile: true }, order: { position: 'ASC' } });
    return filas.map((i) => ({
      id: i.id,
      position: i.position,
      isCover: i.isCover,
      url: `/api/files/${i.storedFile?.storageKey}`,
      fileName: i.storedFile?.originalFilename ?? null,
    }));
  }
}
