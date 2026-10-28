import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LEARNING_RESOURCE_TYPE_LABEL, LearningResourceStatus, LearningResourceType, RolNombre } from '@perfil/shared';
import { LearningResource } from '../entities/learning-resource.entity';
import { LearningResourceFavorite } from '../entities/learning-resource-library.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FILES_ROUTE } from '../storage/local-storage.driver';

export interface LibraryQuery {
  q?: string;
  areaId?: string;
  skillId?: string;
  type?: string;
  favorites?: boolean;
  /** V4.1 A41-014 (§7): «Para ti», por intereses y metas declaradas. */
  forMe?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Biblioteca de recursos (V3.2 §35).
 *
 * Un recurso es material permanente: libro, documentación, guía, video,
 * herramienta… No tiene fechas, inscripción, asistencia ni certificado, y
 * consultarlo no aporta afinidad (§35.3). El estudiante busca, filtra por
 * área o habilidad, abre y guarda como favorito.
 */
@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(LearningResource) private readonly recursos: Repository<LearningResource>,
    @InjectRepository(LearningResourceFavorite) private readonly favoritos: Repository<LearningResourceFavorite>,
    @InjectRepository(StudentProfile) private readonly perfiles: Repository<StudentProfile>,
  ) {}

  private async perfilDe(user: AuthenticatedUser): Promise<string | null> {
    if (user.role !== RolNombre.STUDENT) return null;
    const perfil = await this.perfiles.findOne({ where: { userId: user.userId }, select: { id: true } });
    return perfil?.id ?? null;
  }

  async listar(user: AuthenticatedUser, filtros: LibraryQuery) {
    const perfilId = await this.perfilDe(user);
    const limit = Math.min(Math.max(Number(filtros.limit) || 12, 1), 48);
    const offset = Math.max(Number(filtros.offset) || 0, 0);
    const qb = this.recursos.createQueryBuilder('r')
      .where('r.status = :activo', { activo: LearningResourceStatus.ACTIVE })
      // V4.1 A41-014: lo propuesto por un docente llega cuando Dirección lo aprueba.
      .andWhere("r.review_status IN ('not_required', 'approved')");
    const perfil = perfilId ? await this.perfiles.findOne({ where: { id: perfilId } }) : null;
    if (perfil?.semester) {
      // Dirigido a toda la carrera o a su semestre.
      qb.andWhere("(r.semester_scope = '{}' OR :sem = ANY(r.semester_scope))", { sem: perfil.semester });
    }
    let motivos: Map<string, string[]> | null = null;
    if (filtros.forMe) {
      const pref = await this.preferencias(perfilId, perfil?.improvementAreaIds ?? []);
      motivos = pref.motivos;
      const ids = pref.ids.length ? pref.ids : ['00000000-0000-4000-8000-000000000000'];
      qb.andWhere('r.id IN (:...paraTi)', { paraTi: ids });
    }
    const texto = filtros.q?.trim();
    if (texto) {
      const t = `%${texto.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      qb.andWhere('(r.title ILIKE :t OR r.description ILIKE :t OR r.provider ILIKE :t)', { t });
    }
    if (filtros.areaId) {
      qb.andWhere(
        '(r.academic_area_id = :area OR r.id IN (SELECT a.learning_resource_id FROM learning_resource_areas a WHERE a.academic_area_id = :area))',
        { area: filtros.areaId },
      );
    }
    if (filtros.skillId) {
      qb.andWhere('r.id IN (SELECT s.learning_resource_id FROM learning_resource_skills s WHERE s.skill_id = :skill)', { skill: filtros.skillId });
    }
    if (filtros.type && (Object.values(LearningResourceType) as string[]).includes(filtros.type)) {
      qb.andWhere('r.resource_type = :tipo', { tipo: filtros.type });
    }
    if (filtros.favorites) {
      qb.andWhere(
        'r.id IN (SELECT f.learning_resource_id FROM learning_resource_favorites f WHERE f.student_profile_id = :perfil)',
        { perfil: perfilId ?? '00000000-0000-4000-8000-000000000000' },
      );
    }
    const total = await qb.getCount();
    const filas = await qb.orderBy('r.title', 'ASC').skip(offset).take(limit).getMany();
    const items = await this.vista(filas, perfilId);
    if (motivos) for (const it of items) Object.assign(it, { reasons: motivos.get(it.id) ?? [] });
    return { items, total, limit, offset, facets: await this.facetas() };
  }

  /**
   * V4.1 A41-014 (§7, §8, B23): recursos que coinciden con lo que el
   * estudiante declaró que le interesa o quiere mejorar (áreas y habilidades),
   * con el motivo en palabras. No usa favoritos, clics ni afinidad.
   */
  private async preferencias(perfilId: string | null, mejoraAreas: string[]): Promise<{ ids: string[]; motivos: Map<string, string[]> }> {
    const motivos = new Map<string, string[]>();
    if (!perfilId) return { ids: [], motivos };
    const m = this.recursos.manager;
    const interesAreas = (await m.query(
      `SELECT i.academic_area_id AS id, a.name FROM student_interests i JOIN academic_areas a ON a.id = i.academic_area_id WHERE i.student_profile_id = $1`,
      [perfilId],
    )) as { id: string; name: string }[];
    const mejora = mejoraAreas.length
      ? (await m.query(`SELECT id, name FROM academic_areas WHERE id = ANY($1::uuid[])`, [mejoraAreas])) as { id: string; name: string }[]
      : [];
    const skills = (await m.query(
      `SELECT si.skill_id AS id, s.name, si.kind FROM student_skill_interests si JOIN skills s ON s.id = si.skill_id WHERE si.student_profile_id = $1`,
      [perfilId],
    )) as { id: string; name: string; kind: string }[];
    const agregar = (id: string, motivo: string) => {
      const lista = motivos.get(id) ?? [];
      if (!lista.includes(motivo)) lista.push(motivo);
      motivos.set(id, lista);
    };
    const porArea = async (areas: { id: string; name: string }[], texto: string) => {
      if (!areas.length) return;
      const filas = (await m.query(
        `SELECT r.id, r.academic_area_id AS area FROM learning_resources r WHERE r.academic_area_id = ANY($1::uuid[])
         UNION SELECT la.learning_resource_id AS id, la.academic_area_id AS area FROM learning_resource_areas la WHERE la.academic_area_id = ANY($1::uuid[])`,
        [areas.map((a) => a.id)],
      )) as { id: string; area: string }[];
      for (const f of filas) agregar(f.id, `${texto} ${areas.find((a) => a.id === f.area)?.name ?? ''}`.trim());
    };
    await porArea(interesAreas, 'Coincide con tus intereses:');
    await porArea(mejora, 'Coincide con lo que quieres mejorar:');
    for (const kind of ['interest', 'improve']) {
      const propias = skills.filter((s) => s.kind === kind);
      if (!propias.length) continue;
      const filas = (await m.query(
        `SELECT learning_resource_id AS id, skill_id AS skill FROM learning_resource_skills WHERE skill_id = ANY($1::uuid[])`,
        [propias.map((s) => s.id)],
      )) as { id: string; skill: string }[];
      const texto = kind === 'interest' ? 'Coincide con tus intereses:' : 'Coincide con lo que quieres mejorar:';
      for (const f of filas) agregar(f.id, `${texto} ${propias.find((s) => s.id === f.skill)?.name ?? ''}`.trim());
    }
    return { ids: [...motivos.keys()], motivos };
  }

  /**
   * V3.2 §6.3: para filtrar no se despliegan cientos de opciones: solo las
   * áreas y habilidades que tienen recursos vigentes, las más usadas primero.
   */
  private async facetas() {
    const m = this.recursos.manager;
    const [areas, skills] = await Promise.all([
      m.query(
        `SELECT ar.id, ar.name, COUNT(DISTINCT x.rid)::int AS total FROM (
           SELECT a.learning_resource_id AS rid, a.academic_area_id AS aid FROM learning_resource_areas a
           UNION SELECT r.id, r.academic_area_id FROM learning_resources r
         ) x
         JOIN learning_resources r ON r.id = x.rid AND r.status = 'active'
         JOIN academic_areas ar ON ar.id = x.aid
         GROUP BY ar.id, ar.name ORDER BY total DESC, ar.name LIMIT 30`,
      ),
      m.query(
        `SELECT k.id, k.name, COUNT(DISTINCT s.learning_resource_id)::int AS total
           FROM learning_resource_skills s
           JOIN learning_resources r ON r.id = s.learning_resource_id AND r.status = 'active'
           JOIN skills k ON k.id = s.skill_id
          GROUP BY k.id, k.name ORDER BY total DESC, k.name LIMIT 30`,
      ),
    ]);
    return { areas, skills };
  }

  /** Lo que muestra la tarjeta: áreas y habilidades con nombre, imagen y si es favorito. */
  private async vista(filas: LearningResource[], perfilId: string | null) {
    if (filas.length === 0) return [];
    const ids = filas.map((r) => r.id);
    const m = this.recursos.manager;
    const [areas, skills, favs, imagenes, archivos] = await Promise.all([
      m.query(
        `SELECT x.rid, ar.id, ar.name FROM (
           SELECT a.learning_resource_id AS rid, a.academic_area_id AS aid FROM learning_resource_areas a WHERE a.learning_resource_id = ANY($1::uuid[])
           UNION
           SELECT r.id, r.academic_area_id FROM learning_resources r WHERE r.id = ANY($1::uuid[])
         ) x JOIN academic_areas ar ON ar.id = x.aid`,
        [ids],
      ),
      m.query(
        `SELECT s.learning_resource_id AS rid, k.id, k.name FROM learning_resource_skills s JOIN skills k ON k.id = s.skill_id
          WHERE s.learning_resource_id = ANY($1::uuid[])`,
        [ids],
      ),
      perfilId
        ? m.query(`SELECT learning_resource_id AS rid FROM learning_resource_favorites WHERE student_profile_id = $1 AND learning_resource_id = ANY($2::uuid[])`, [perfilId, ids])
        : Promise.resolve([]),
      m.query(`SELECT r.id AS rid, f.storage_key FROM learning_resources r JOIN stored_files f ON f.id = r.image_file_id WHERE r.id = ANY($1::uuid[])`, [ids]),
      // V5-13: el archivo del material, si lo tiene.
      m.query(`SELECT r.id AS rid, f.storage_key, f.original_filename FROM learning_resources r JOIN stored_files f ON f.id = r.file_id WHERE r.id = ANY($1::uuid[])`, [ids]),
    ]);
    const favSet = new Set((favs as { rid: string }[]).map((f) => f.rid));
    return filas.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      provider: r.provider,
      url: r.url,
      resourceType: r.resourceType,
      resourceTypeLabel: LEARNING_RESOURCE_TYPE_LABEL[r.resourceType] ?? r.resourceType,
      areas: (areas as { rid: string; id: string; name: string }[]).filter((a) => a.rid === r.id).map((a) => ({ id: a.id, name: a.name })),
      skills: (skills as { rid: string; id: string; name: string }[]).filter((s) => s.rid === r.id).map((s) => ({ id: s.id, name: s.name })),
      imageUrl: (() => {
        const img = (imagenes as { rid: string; storage_key: string }[]).find((i) => i.rid === r.id);
        return img ? `${FILES_ROUTE}/${img.storage_key}` : null;
      })(),
      ...(() => {
        const f = (archivos as { rid: string; storage_key: string; original_filename: string | null }[]).find((a) => a.rid === r.id);
        return { fileUrl: f ? `${FILES_ROUTE}/${f.storage_key}` : null, fileName: f?.original_filename ?? null };
      })(),
      isFavorite: favSet.has(r.id),
    }));
  }

  /** Guardar como favorito: idempotente. Solo para estudiantes con perfil. */
  async favorito(user: AuthenticatedUser, recursoId: string, guardar: boolean) {
    const perfilId = await this.perfilDe(user);
    if (!perfilId) throw new NotFoundException('Crea tu perfil estudiantil para guardar recursos.');
    const recurso = await this.recursos.findOne({ where: { id: recursoId, status: LearningResourceStatus.ACTIVE } });
    if (!recurso) throw new NotFoundException('Recurso no encontrado.');
    if (guardar) {
      await this.favoritos.createQueryBuilder().insert()
        .values({ studentProfileId: perfilId, learningResourceId: recursoId })
        .orIgnore().execute();
    } else {
      await this.favoritos.delete({ studentProfileId: perfilId, learningResourceId: recursoId });
    }
    return { id: recursoId, isFavorite: guardar };
  }
}
