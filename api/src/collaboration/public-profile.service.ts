import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import {
  AffinityLevel,
  DEFAULT_PUBLIC_VISIBILITY,
  ProjectVisibility,
  PUBLIC_SLUG_ALPHABET,
  PUBLIC_SLUG_LENGTH,
  PublicProfileField,
} from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { Project } from '../entities/project.entity';
import { StudentSkill } from '../entities/student-skill.entity';
import { AffinitySnapshot } from '../entities/affinity-snapshot.entity';
import { encodeQr, qrToSvg } from './qr-encoder';

/** Intentos antes de rendirse al sortear un identificador libre. */
const MAX_INTENTOS_SLUG = 20;

/**
 * Perfil compartible y su identificador público (§43, §44).
 *
 * Dos reglas gobiernan todo lo de aquí:
 *
 * 1. §43 — el identificador es **opaco**. Ni correo, ni código universitario,
 *    ni el UUID interno. Se puede rotar, y rotarlo invalida los QR impresos
 *    antes, que es exactamente para lo que sirve.
 * 2. §44 — **nada se expone por omisión**. El perfil compartible nace apagado y
 *    cada campo nace oculto; lo que se publica es lo que el estudiante activó,
 *    uno por uno.
 *
 * Lo que §44 prohíbe exponer —correo, archivos, certificados completos, chats,
 * tokens, identificadores internos— no aparece en este servicio en absoluto. No
 * hay una bandera que pudiera encenderse por error: sencillamente no se lee.
 */
@Injectable()
export class PublicProfileService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(AffinityResult) private readonly affinities: Repository<AffinityResult>,
    @InjectRepository(AffinitySnapshot) private readonly snapshots: Repository<AffinitySnapshot>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(StudentSkill) private readonly skills: Repository<StudentSkill>,
  ) {}

  /** Base pública desde la que se sirve la web, para componer el enlace. */
  private baseUrl(): string {
    const origenes = (this.config.get<string>('WEB_ORIGINS') ?? '').split(',');
    const primero = origenes.map((o) => o.trim()).filter(Boolean)[0];
    return (primero ?? 'http://localhost:5173').replace(/\/+$/, '');
  }

  private enlaceDe(slug: string): string {
    return `${this.baseUrl()}/p/${slug}`;
  }

  /**
   * El enlace y el QR del propio estudiante (§43).
   *
   * El QR lleva **solo** la URL. Nada de nombre, correo ni identificadores: si
   * llevara más, cualquiera que fotografiase el código obtendría datos que el
   * estudiante no decidió publicar.
   */
  async myLink(studentProfileId: string) {
    const perfil = await this.findOwn(studentProfileId);
    const url = this.enlaceDe(perfil.publicProfileSlug);
    const qr = encodeQr(url);
    return {
      slug: perfil.publicProfileSlug,
      url,
      enabled: perfil.publicProfileEnabled,
      qrSvg: qrToSvg(qr),
      qrSize: qr.size,
      /** El contenido exacto del código, para poder comprobarlo. */
      qrPayload: url,
    };
  }

  /**
   * Cambia el identificador por otro (§43, «El slug puede rotarse»).
   *
   * Es la única defensa del estudiante cuando un QR suyo acabó donde no debía:
   * el papel impreso deja de llevar a ninguna parte.
   */
  async rotateSlug(studentProfileId: string) {
    const perfil = await this.findOwn(studentProfileId);
    perfil.publicProfileSlug = await this.nuevoSlug();
    await this.profiles.save(perfil);
    return this.myLink(studentProfileId);
  }

  /**
   * El perfil compartible de alguien, por su identificador público.
   *
   * Responde 404 cuando el perfil no está publicado, no 403: decir «existe pero
   * está cerrado» ya es contar algo de una persona que decidió no contarlo.
   */
  async findBySlug(slug: string) {
    const perfil = await this.profiles.findOne({
      where: { publicProfileSlug: slug },
      relations: { user: true },
    });
    if (!perfil || !perfil.publicProfileEnabled) {
      throw new NotFoundException('No existe un perfil compartible con ese enlace.');
    }

    const visible: Record<PublicProfileField, boolean> = {
      ...DEFAULT_PUBLIC_VISIBILITY,
      ...(perfil.publicVisibilityConfig ?? {}),
    };

    // El nombre es lo único que se muestra siempre: un perfil compartible sin
    // nombre no identifica a nadie y no sirve para lo que existe.
    const salida: Record<string, unknown> = {
      slug: perfil.publicProfileSlug,
      name: perfil.user ? `${perfil.user.firstName} ${perfil.user.lastName}` : 'Estudiante',
      semester: perfil.semester,
    };

    if (visible[PublicProfileField.BIO]) salida.bio = perfil.bio;

    if (visible[PublicProfileField.AVAILABILITY]) {
      salida.availability = perfil.availability;
      salida.collaborationModes = perfil.collaborationPreferences?.modes ?? [];
      salida.collaborationInterests = perfil.collaborationPreferences?.interests ?? [];
    }

    const necesitaAfinidad =
      visible[PublicProfileField.AREAS]
      || visible[PublicProfileField.AFFINITIES]
      || visible[PublicProfileField.SUPPORT_LEVEL];

    if (necesitaAfinidad) {
      const filas = await this.affinities.find({
        where: { studentProfileId: perfil.id },
        relations: { academicArea: true },
        order: { score: 'DESC' },
        take: 5,
      });
      salida.areas = filas.map((r) => ({
        area: r.academicArea?.name ?? null,
        // §44 separa «áreas principales» de «afinidades» y de «nivel de
        // respaldo». Cada uno se publica solo si su casilla está activa: quien
        // quiera enseñar en qué trabaja sin enseñar sus números, puede.
        ...(visible[PublicProfileField.AFFINITIES] ? { score: Number(r.score) } : {}),
        ...(visible[PublicProfileField.SUPPORT_LEVEL]
          ? { supportLevel: r.supportLevel ?? AffinityLevel.LOW }
          : {}),
      }));
    }

    if (visible[PublicProfileField.SKILLS]) {
      const filas = await this.skills.find({
        where: { studentProfileId: perfil.id },
        relations: { skill: true },
      });
      salida.skills = filas
        .filter((s) => s.skill)
        .map((s) => ({ name: s.skill.name, level: s.level }));
    }

    if (visible[PublicProfileField.PROJECTS]) {
      /*
       * §106: la visibilidad del proyecto se aplica aquí, no ocultando un
       * botón. Un proyecto privado no aparece aunque el estudiante haya
       * activado la casilla de proyectos.
       *
       * `TEACHERS` tampoco: significa «visible para los docentes», que es una
       * decisión distinta de publicarlo en un enlace que puede abrir
       * cualquiera. Solo sale lo marcado como visible en el perfil.
       */
      const filas = await this.projects.find({
        where: {
          createdByProfileId: perfil.id,
          visibility: ProjectVisibility.PROFILE,
        },
        order: { createdAt: 'DESC' },
        take: 10,
      });
      salida.projects = filas.map((p) => ({
        title: p.title,
        description: p.description,
        technologies: p.technologies ?? [],
        backingTier: p.backingTier,
      }));
    }

    if (visible[PublicProfileField.TRAJECTORY]) {
      const snapshot = await this.snapshots.findOne({
        where: { studentProfileId: perfil.id },
        order: { calculatedAt: 'DESC' },
      });
      salida.trajectory = snapshot
        ? {
            areasCount: snapshot.areasCount,
            signalsCount: snapshot.signalsCount,
            averageSupport: snapshot.averageSupport,
            calculatedAt: snapshot.calculatedAt,
          }
        : null;
    }

    return salida;
  }

  /** El perfil estudiantil del propio usuario, o 404. */
  private async findOwn(studentProfileId: string): Promise<StudentProfile> {
    const perfil = await this.profiles.findOne({ where: { id: studentProfileId } });
    if (!perfil) {
      throw new NotFoundException('Perfil no encontrado.');
    }
    return perfil;
  }

  /**
   * Sortea un identificador libre.
   *
   * `randomInt` y no `Math.random`: el identificador es lo único que protege un
   * perfil compartible de ser encontrado por quien no recibió el enlace, y un
   * generador predecible lo convertiría en un número de serie.
   */
  private async nuevoSlug(): Promise<string> {
    for (let intento = 0; intento < MAX_INTENTOS_SLUG; intento++) {
      let candidato = '';
      for (let i = 0; i < PUBLIC_SLUG_LENGTH; i++) {
        candidato += PUBLIC_SLUG_ALPHABET[randomInt(PUBLIC_SLUG_ALPHABET.length)];
      }
      const existe = await this.profiles.exists({
        where: { publicProfileSlug: candidato },
      });
      if (!existe) return candidato;
    }
    throw new Error('No se pudo generar un identificador público libre.');
  }
}
