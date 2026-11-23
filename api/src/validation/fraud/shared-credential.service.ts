import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { enlaceDeCredencial, normalizarCodigo } from '../credential-integrity.rules';
import { hamming } from '../forensics/image-forensics';

export interface SharedCredentialInput {
  /** Perfil del estudiante dueño de la credencial que se valida. */
  studentProfileId: string;
  certificateId: string;
  fileSha256: string | null;
  /** Códigos declarados, leídos del documento o del QR. */
  credentialIds: (string | null | undefined)[];
  /** Enlaces de verificación: declarado, del QR, del documento, final tras redirecciones. */
  urls: (string | null | undefined)[];
  perceptualHash: string | null;
}

export interface SharedCredentialResult {
  /** El mismo archivo (byte a byte) está en la credencial de otro estudiante. */
  sameFile: number;
  /** El mismo código de credencial lo registró otro estudiante. */
  sameCredentialId: number;
  /** El mismo enlace individual de verificación lo registró otro estudiante. */
  sameUrl: number;
  /** Una imagen casi idéntica (dHash) está en la credencial de otro estudiante. */
  nearDuplicate: number;
}

/** Bits distintos (de 256) por debajo de los cuales dos imágenes son «la misma». */
export const NEAR_DUPLICATE_MAX_BITS = 6;

/**
 * V9 · Antifraude entre estudiantes.
 *
 * El duplicado de V3 (§28) solo miraba al mismo dueño. Aquí se mira a los
 * **demás**: una credencial es de una sola persona, así que el mismo archivo,
 * el mismo código o el mismo enlace individual en dos perfiles distintos es
 * una contradicción fuerte.
 *
 * Privacidad: solo se cuentan coincidencias. Ni el estudiante ni el informe
 * guardan quién es el otro; Dirección lo encuentra con la auditoría.
 *
 * Solo se marca a quien registra **después**: si se marcara también al
 * primero, cualquiera podría perjudicar a otro registrando su código.
 */
@Injectable()
export class SharedCredentialService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async check(i: SharedCredentialInput): Promise<SharedCredentialResult> {
    const [sameFile, sameCredentialId, sameUrl, nearDuplicate] = await Promise.all([
      this.mismoArchivo(i),
      this.mismoCodigo(i),
      this.mismoEnlace(i),
      this.casiIgual(i),
    ]);
    return { sameFile, sameCredentialId, sameUrl, nearDuplicate };
  }

  private async mismoArchivo(i: SharedCredentialInput): Promise<number> {
    if (!i.fileSha256) return 0;
    const r = await this.ds.query(
      `SELECT count(DISTINCT ec.student_profile_id)::int AS n
         FROM external_certificates ec
         JOIN stored_files sf ON sf.id = ec.stored_file_id
        WHERE sf.sha256 = $1 AND ec.student_profile_id <> $2 AND ec.created_at < (
          SELECT created_at FROM external_certificates WHERE id = $3)`,
      [i.fileSha256, i.studentProfileId, i.certificateId],
    );
    return r[0]?.n ?? 0;
  }

  private async mismoCodigo(i: SharedCredentialInput): Promise<number> {
    const codigos = [...new Set(i.credentialIds.map(normalizarCodigo).filter((c): c is string => !!c))];
    if (codigos.length === 0) return 0;
    // Mismo código, declarado o leído del documento, en la credencial de otro
    // estudiante registrada antes.
    const r = await this.ds.query(
      `SELECT count(DISTINCT ec.student_profile_id)::int AS n
         FROM external_certificates ec
         LEFT JOIN validation_records vr
           ON vr.resource_type = 'external_certificate' AND vr.resource_id = ec.id
        WHERE ec.student_profile_id <> $2
          AND ec.created_at < (SELECT created_at FROM external_certificates WHERE id = $3)
          AND (
            regexp_replace(upper(coalesce(ec.credential_id, '')), '[^A-Z0-9]', '', 'g') = ANY($1)
            OR regexp_replace(upper(coalesce(vr.extracted_data->>'credentialId', '')), '[^A-Z0-9]', '', 'g') = ANY($1)
          )`,
      [codigos, i.studentProfileId, i.certificateId],
    );
    return r[0]?.n ?? 0;
  }

  private async mismoEnlace(i: SharedCredentialInput): Promise<number> {
    const claves = [...new Set(i.urls.map(enlaceDeCredencial).filter((c): c is string => !!c))];
    if (claves.length === 0) return 0;
    const filas: { student_profile_id: string; urls: (string | null)[] }[] = await this.ds.query(
      `SELECT ec.student_profile_id,
              ARRAY[ec.certificate_url, vr.credential_check->>'url', vr.credential_check->>'finalUrl'] AS urls
         FROM external_certificates ec
         LEFT JOIN validation_records vr
           ON vr.resource_type = 'external_certificate' AND vr.resource_id = ec.id
        WHERE ec.student_profile_id <> $1
          AND ec.created_at < (SELECT created_at FROM external_certificates WHERE id = $2)
          AND (ec.certificate_url IS NOT NULL OR vr.credential_check IS NOT NULL)`,
      [i.studentProfileId, i.certificateId],
    );
    const buscadas = new Set(claves);
    const otros = new Set<string>();
    for (const f of filas) {
      if (f.urls.some((u) => { const k = enlaceDeCredencial(u); return !!k && buscadas.has(k); })) otros.add(f.student_profile_id);
    }
    return otros.size;
  }

  private async casiIgual(i: SharedCredentialInput): Promise<number> {
    if (!i.perceptualHash) return 0;
    const filas: { student_profile_id: string; h: string }[] = await this.ds.query(
      `SELECT ec.student_profile_id, vr.credential_check->'forensics'->>'perceptualHash' AS h
         FROM validation_records vr
         JOIN external_certificates ec ON ec.id = vr.resource_id
        WHERE vr.resource_type = 'external_certificate'
          AND ec.student_profile_id <> $1
          AND ec.created_at < (SELECT created_at FROM external_certificates WHERE id = $2)
          AND vr.credential_check->'forensics'->>'perceptualHash' IS NOT NULL`,
      [i.studentProfileId, i.certificateId],
    );
    const otros = new Set<string>();
    for (const f of filas) if (hamming(f.h, i.perceptualHash) <= NEAR_DUPLICATE_MAX_BITS) otros.add(f.student_profile_id);
    return otros.size;
  }
}
