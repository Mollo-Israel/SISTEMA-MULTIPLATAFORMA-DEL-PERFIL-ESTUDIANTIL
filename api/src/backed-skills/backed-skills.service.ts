import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Una tecnología respaldada por trayectoria (V2 §34, §55, §61). */
export interface BackedSkill {
  skillId: string;
  name: string;
  academicAreaId: string | null;
  /** De qué familias sale: proyectos, actividades confirmadas y certificados con respaldo. */
  sources: ('project' | 'activity' | 'certificate')[];
  /** Cuántos eventos distintos la respaldan. */
  evidenceCount: number;
}

/**
 * Tecnologías respaldadas por trayectoria.
 *
 * La V2 retira la autoevaluación de nivel (§22): lo que alguien *dice* saber
 * ya no se muestra ni se usa como competencia. Cuando una pantalla o un motor
 * necesita «qué tecnologías ha usado» —perfil compartible, equipos (§55),
 * compañeros sugeridos, CV (§61), analítica de Dirección (§63)— la respuesta
 * sale de aquí, y solo de dos fuentes:
 *
 *   - **proyectos**: las `skills_used` que el propio integrante confirmó
 *     (§33, §34), en proyectos con respaldo (`SUPPORTED` o mejor; ni
 *     `DECLARED` ni `FLAGGED`, §36);
 *   - **actividades**: las tecnologías de actividades con participación
 *     `CONFIRMED` (§29);
 *   - **certificados** (V2 §41): las tecnologías de un certificado externo
 *     cuya validación lo dejó `SUPPORTED` o `CORROBORATED`. Uno solo
 *     declarado no respalda nada.
 *
 * No es una certificación: dice dónde aparece la tecnología en la trayectoria
 * respaldada, no cuánto se domina (§5.2).
 */
@Injectable()
export class BackedSkillsService {
  constructor(private readonly dataSource: DataSource) {}

  async forProfiles(profileIds: string[]): Promise<Map<string, BackedSkill[]>> {
    const salida = new Map<string, BackedSkill[]>();
    if (profileIds.length === 0) return salida;

    const filas: {
      profile_id: string;
      skill_id: string;
      name: string;
      academic_area_id: string | null;
      source: 'project' | 'activity' | 'certificate';
      source_id: string;
    }[] = await this.dataSource.query(
      `SELECT sp.id AS profile_id, s.id AS skill_id, s.name, s.academic_area_id,
              'project' AS source, p.id AS source_id
         FROM project_member_skills pms
         JOIN project_members pm ON pm.id = pms.project_member_id
         JOIN projects p ON p.id = pm.project_id
         JOIN student_profiles sp ON sp.user_id = pm.user_id
         JOIN skills s ON s.id = pms.skill_id
        WHERE sp.id = ANY($1)
          AND pm.contribution_confirmed_at IS NOT NULL
          AND p.backing_tier IN ('supported', 'corroborated', 'reviewed')
       UNION ALL
       SELECT r.student_profile_id AS profile_id, s.id AS skill_id, s.name, s.academic_area_id,
              'activity' AS source, r.activity_id AS source_id
         FROM activity_registrations r
         JOIN activity_skills a_s ON a_s.activity_id = r.activity_id
         JOIN skills s ON s.id = a_s.skill_id
        WHERE r.student_profile_id = ANY($1)
          AND r.status = 'confirmed'
       UNION ALL
       SELECT c.student_profile_id AS profile_id, s.id AS skill_id, s.name, s.academic_area_id,
              'certificate' AS source, c.id AS source_id
         FROM external_certificate_skills cs
         JOIN external_certificates c ON c.id = cs.certificate_id
         JOIN skills s ON s.id = cs.skill_id
        WHERE c.student_profile_id = ANY($1)
          AND EXISTS (
            SELECT 1 FROM validation_records vr
             WHERE vr.resource_type = 'external_certificate' AND vr.resource_id = c.id
               AND vr.backing_tier IN ('supported', 'corroborated'))`,
      [profileIds],
    );

    const porPerfil = new Map<string, Map<string, BackedSkill & { eventos: Set<string> }>>();
    for (const f of filas) {
      const mapa = porPerfil.get(f.profile_id) ?? new Map();
      porPerfil.set(f.profile_id, mapa);
      const actual = mapa.get(f.skill_id) ?? {
        skillId: f.skill_id,
        name: f.name,
        academicAreaId: f.academic_area_id,
        sources: [],
        evidenceCount: 0,
        eventos: new Set<string>(),
      };
      if (!actual.sources.includes(f.source)) actual.sources.push(f.source);
      actual.eventos.add(`${f.source}:${f.source_id}`);
      actual.evidenceCount = actual.eventos.size;
      mapa.set(f.skill_id, actual);
    }
    for (const [perfil, mapa] of porPerfil) {
      salida.set(
        perfil,
        [...mapa.values()]
          .map(({ eventos: _e, ...resto }) => resto)
          .sort((a, b) => b.evidenceCount - a.evidenceCount || a.name.localeCompare(b.name)),
      );
    }
    return salida;
  }

  async forProfile(profileId: string): Promise<BackedSkill[]> {
    return (await this.forProfiles([profileId])).get(profileId) ?? [];
  }
}
