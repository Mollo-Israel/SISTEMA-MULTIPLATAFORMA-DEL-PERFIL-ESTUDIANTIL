import { EntityManager, In } from 'typeorm';
import { ExternalOpportunityValidationReference } from '../entities/external-opportunity-validation-reference.entity';
import { ReferenceVersionOrigin, ValidationReferenceVersion } from '../entities/validation-reference-version.entity';
import { StoredFileRecord } from '../entities/stored-file.entity';

/**
 * V7.1 D03 · Certificado modelo vigente de una oportunidad y sus versiones.
 *
 * Funciones sobre un `EntityManager`, como las guardas del catálogo: las usan
 * el validador, la elegibilidad y la gestión de actividades sin que esos
 * módulos dependan unos de otros.
 */

export interface ModeloVigente {
  referencia: ExternalOpportunityValidationReference;
  version: ValidationReferenceVersion;
}

/**
 * El modelo que se usa hoy, con su versión. `null` si la oportunidad no tiene.
 *
 * Un modelo cargado antes del versionado (V7.1) no tiene versión: se le
 * registra la suya («previo») la primera vez que hace falta, con el autor y
 * la fecha de la referencia. Es idempotente aunque dos procesos lleguen a la vez.
 */
export async function modeloVigente(em: EntityManager, activityId: string): Promise<ModeloVigente | null> {
  const referencia = await em.findOne(ExternalOpportunityValidationReference, { where: { activityId } });
  if (!referencia?.sampleStoredFileId) return null;

  const ultima = await ultimaVersion(em, activityId);
  if (ultima && ultima.storedFileId === referencia.sampleStoredFileId) return { referencia, version: ultima };

  const archivo = await em.findOne(StoredFileRecord, { where: { id: referencia.sampleStoredFileId } });
  if (!archivo) return null;
  await em.query(
    `INSERT INTO "validation_reference_versions"
       ("activity_id", "version", "stored_file_id", "file_sha256", "file_name", "origin", "reason", "created_by", "created_at")
     VALUES ($1, $2, $3, $4, $5, 'previo', $6, $7, $8)
     ON CONFLICT ("activity_id", "version") DO NOTHING`,
    [
      activityId, (ultima?.version ?? 0) + 1, archivo.id, archivo.sha256, archivo.originalFilename,
      'Modelo cargado antes del versionado de V7.1.', referencia.updatedById, referencia.updatedAt,
    ],
  );
  const registrada = await ultimaVersion(em, activityId);
  return registrada?.storedFileId === referencia.sampleStoredFileId ? { referencia, version: registrada } : null;
}

/** ¿Qué oportunidades de la lista tienen modelo? (para el selector del estudiante) */
export async function conModelo(em: EntityManager, activityIds: string[]): Promise<Set<string>> {
  if (!activityIds.length) return new Set();
  const refs = await em.find(ExternalOpportunityValidationReference, {
    where: { activityId: In(activityIds) },
    select: { id: true, activityId: true, sampleStoredFileId: true },
  });
  return new Set(refs.filter((r) => !!r.sampleStoredFileId).map((r) => r.activityId));
}

export async function ultimaVersion(em: EntityManager, activityId: string): Promise<ValidationReferenceVersion | null> {
  return em.findOne(ValidationReferenceVersion, { where: { activityId }, order: { version: 'DESC' } });
}

export async function versionesDelModelo(em: EntityManager, activityId: string): Promise<ValidationReferenceVersion[]> {
  return em.find(ValidationReferenceVersion, { where: { activityId }, order: { version: 'DESC' }, take: 20 });
}

/**
 * Registra una versión nueva del modelo. Se llama dentro de la transacción que
 * cambia la referencia, con la fila de la referencia bloqueada: así dos
 * cambios simultáneos no compiten por el mismo número.
 */
export async function registrarVersion(
  em: EntityManager,
  datos: {
    activityId: string;
    archivo: Pick<StoredFileRecord, 'id' | 'sha256' | 'originalFilename'> | null;
    origin: ReferenceVersionOrigin;
    reason: string | null;
    actorUserId: string;
  },
): Promise<ValidationReferenceVersion> {
  const ultima = await ultimaVersion(em, datos.activityId);
  return em.save(em.create(ValidationReferenceVersion, {
    activityId: datos.activityId,
    version: (ultima?.version ?? 0) + 1,
    storedFileId: datos.archivo?.id ?? null,
    fileSha256: datos.archivo?.sha256 ?? null,
    fileName: datos.archivo?.originalFilename ?? null,
    origin: datos.origin,
    reason: datos.reason,
    createdById: datos.actorUserId,
  }));
}
