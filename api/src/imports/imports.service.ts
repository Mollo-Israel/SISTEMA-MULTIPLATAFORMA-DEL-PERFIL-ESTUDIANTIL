import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  ImportBatchStatus,
  ImportRowStatus,
  RolNombre,
  UserStatus,
} from '@perfil/shared';
import { ImportBatch, ImportBatchRow } from '../entities/import-batch.entity';
import { User } from '../entities/user.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { Role } from '../entities/role.entity';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { ActivationService } from '../identity/activation.service';
import {
  institutionalEmailDomains,
  isInstitutionalEmail,
} from '../config/identity.config';
import { NAME_RE } from '../common/validation';
import { parseCsv } from './csv.parser';

/** Columnas mínimas de la plantilla (§10). */
const REQUIRED_HEADERS = [
  'university_code',
  'first_name',
  'last_name',
  'institutional_email',
  'semester',
] as const;

interface EvaluatedRow {
  lineNumber: number;
  universityCode: string | null;
  institutionalEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  semester: number | null;
  status: ImportRowStatus;
  message: string | null;
  /** Usuario existente al que corresponde la fila, si se identificó. */
  existingUserId: string | null;
}

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(ImportBatch) private readonly batches: Repository<ImportBatch>,
    @InjectRepository(ImportBatchRow) private readonly rows: Repository<ImportBatchRow>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly activation: ActivationService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // ======================================================================
  //  Previsualización
  // ======================================================================

  /**
   * Analiza el archivo y persiste el veredicto de cada fila **sin aplicar
   * nada** (§10).
   *
   * Que la previsualización se guarde en base de datos no es un capricho: lo
   * que se aplica después es exactamente lo que se mostró, no un segundo
   * análisis que podría diferir si los datos cambiaron entre medias.
   */
  async preview(
    adminUserId: string,
    file: { buffer: Buffer; originalname: string },
  ): Promise<{ batchId: string; counts: Record<string, number>; totalRows: number; rows: unknown[] }> {
    const content = file.buffer.toString('utf8');
    const parsed = parseCsv(content);

    const missing = REQUIRED_HEADERS.filter((h) => !parsed.headers.includes(h));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Faltan columnas obligatorias: ${missing.join(', ')}. `
          + `La plantilla mínima es: ${REQUIRED_HEADERS.join(', ')}.`,
      );
    }
    if (parsed.rows.length === 0) {
      throw new BadRequestException('El archivo no contiene filas de datos.');
    }

    const evaluated = await this.evaluateRows(parsed.rows);
    const counts = this.countByStatus(evaluated);

    const batch = await this.batches.save(
      this.batches.create({
        originalFilename: file.originalname,
        fileSha256: createHash('sha256').update(file.buffer).digest('hex'),
        status: ImportBatchStatus.PREVIEWED,
        importedByUserId: adminUserId,
        counts,
        totalRows: evaluated.length,
      }),
    );

    await this.rows.save(
      evaluated.map((row) =>
        this.rows.create({
          batchId: batch.id,
          rowNumber: row.lineNumber,
          universityCode: row.universityCode,
          institutionalEmail: row.institutionalEmail,
          firstName: row.firstName,
          lastName: row.lastName,
          semester: row.semester,
          status: row.status,
          message: row.message,
          userId: row.existingUserId,
        }),
      ),
    );

    await this.audit.record({
      actorUserId: adminUserId,
      eventType: AuditEventType.IMPORT_PREVIEWED,
      entityType: 'import_batch',
      entityId: batch.id,
      metadata: { filename: file.originalname, totalRows: evaluated.length, counts },
    });

    return {
      batchId: batch.id,
      counts,
      totalRows: evaluated.length,
      rows: evaluated.map((r) => ({
        rowNumber: r.lineNumber,
        universityCode: r.universityCode,
        institutionalEmail: r.institutionalEmail,
        firstName: r.firstName,
        lastName: r.lastName,
        semester: r.semester,
        status: r.status,
        message: r.message,
      })),
    };
  }

  /**
   * Decide qué es cada fila.
   *
   * La identificación es por `university_code` y, como control secundario, por
   * correo normalizado (§10.1). Si ambos apuntan a usuarios distintos la fila
   * es CONFLICT: resolverlo automáticamente podría fusionar dos personas.
   */
  private async evaluateRows(
    parsed: { lineNumber: number; values: Record<string, string> }[],
  ): Promise<EvaluatedRow[]> {
    const domains = institutionalEmailDomains(this.config);

    const codes = parsed.map((r) => r.values.university_code?.trim()).filter(Boolean) as string[];
    const emails = parsed
      .map((r) => r.values.institutional_email?.trim().toLowerCase())
      .filter(Boolean) as string[];

    const [profilesByCode, usersByEmail] = await Promise.all([
      codes.length
        ? this.profiles.find({ where: { universityCode: In(codes) }, relations: { user: true } })
        : Promise.resolve([]),
      emails.length ? this.users.find({ where: { email: In(emails) } }) : Promise.resolve([]),
    ]);

    const byCode = new Map(profilesByCode.map((p) => [p.universityCode!, p]));
    const byEmail = new Map(usersByEmail.map((u) => [u.email, u]));

    // Duplicados dentro del propio archivo: la segunda aparición es conflicto,
    // porque aplicar ambas dejaría un resultado dependiente del orden.
    const seenCodes = new Set<string>();
    const seenEmails = new Set<string>();

    const out: EvaluatedRow[] = [];

    for (const { lineNumber, values } of parsed) {
      const universityCode = values.university_code?.trim() || null;
      const email = values.institutional_email?.trim().toLowerCase() || null;
      const firstName = values.first_name?.trim() || null;
      const lastName = values.last_name?.trim() || null;
      const semesterRaw = values.semester?.trim() || '';
      const semester = semesterRaw ? Number(semesterRaw) : null;

      const base = {
        lineNumber,
        universityCode,
        institutionalEmail: email,
        firstName,
        lastName,
        semester: Number.isFinite(semester) ? semester : null,
        existingUserId: null as string | null,
      };

      // ---- formato ----
      const invalid = this.validateRow({ universityCode, email, firstName, lastName, semesterRaw, semester, domains });
      if (invalid) {
        out.push({ ...base, status: ImportRowStatus.INVALID, message: invalid });
        continue;
      }

      // ---- duplicado dentro del archivo ----
      if (seenCodes.has(universityCode!) || (email && seenEmails.has(email))) {
        out.push({
          ...base,
          status: ImportRowStatus.CONFLICT,
          message: 'La fila repite un código o un correo que ya aparece antes en este archivo.',
        });
        continue;
      }
      seenCodes.add(universityCode!);
      if (email) seenEmails.add(email);

      // ---- identificación ----
      const byCodeMatch = byCode.get(universityCode!);
      const byEmailMatch = email ? byEmail.get(email) : undefined;

      if (byCodeMatch && byEmailMatch && byCodeMatch.userId !== byEmailMatch.id) {
        out.push({
          ...base,
          status: ImportRowStatus.CONFLICT,
          message:
            'El código universitario y el correo corresponden a dos cuentas distintas. '
            + 'Debe resolverse manualmente.',
        });
        continue;
      }

      if (!byCodeMatch && byEmailMatch) {
        // El correo ya existe en otra cuenta que no lleva este código.
        const profile = await this.profiles.findOne({ where: { userId: byEmailMatch.id } });
        if (profile?.universityCode && profile.universityCode !== universityCode) {
          out.push({
            ...base,
            status: ImportRowStatus.CONFLICT,
            message: `El correo ya pertenece a la cuenta con código ${profile.universityCode}.`,
          });
          continue;
        }
      }

      const existing = byCodeMatch ?? (byEmailMatch ? { userId: byEmailMatch.id } : null);

      if (!existing) {
        out.push({ ...base, status: ImportRowStatus.NEW, message: null });
        continue;
      }

      // ---- ¿cambia algo? ----
      const user = byCodeMatch?.user ?? byEmailMatch ?? (await this.users.findOne({ where: { id: existing.userId } }));
      const profile = byCodeMatch ?? (await this.profiles.findOne({ where: { userId: existing.userId } }));

      const changes: string[] = [];
      if (user && firstName && user.firstName !== firstName) changes.push('nombre');
      if (user && lastName && user.lastName !== lastName) changes.push('apellido');
      if (user && email && user.email !== email) changes.push('correo');
      if (profile && semester !== null && profile.semester !== semester) changes.push('semestre');
      if (profile && !profile.universityCode && universityCode) changes.push('código');

      out.push({
        ...base,
        existingUserId: existing.userId,
        status: changes.length > 0 ? ImportRowStatus.UPDATE : ImportRowStatus.UNCHANGED,
        message: changes.length > 0 ? `Actualiza: ${changes.join(', ')}.` : null,
      });
    }

    return out;
  }

  private validateRow(input: {
    universityCode: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    semesterRaw: string;
    semester: number | null;
    domains: string[];
  }): string | null {
    if (!input.universityCode) return 'Falta el código universitario.';
    if (input.universityCode.length > 40) return 'El código universitario es demasiado largo.';
    if (!input.firstName) return 'Falta el nombre.';
    if (!input.lastName) return 'Falta el apellido.';
    if (!NAME_RE.test(input.firstName)) return 'El nombre contiene caracteres no permitidos.';
    if (!NAME_RE.test(input.lastName)) return 'El apellido contiene caracteres no permitidos.';
    if (!input.email) return 'Falta el correo institucional.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return 'El correo no tiene un formato válido.';
    if (!isInstitutionalEmail(input.email, input.domains)) {
      return 'El correo no pertenece a un dominio institucional autorizado.';
    }
    if (!input.semesterRaw) return 'Falta el semestre.';
    if (
      input.semester === null
      || !Number.isInteger(input.semester)
      || input.semester < 1
      || input.semester > 12
    ) {
      return 'El semestre debe ser un número entero entre 1 y 12.';
    }
    return null;
  }

  // ======================================================================
  //  Aplicación
  // ======================================================================

  /**
   * Aplica una previsualización.
   *
   * Solo toca NEW y UPDATE. UNCHANGED, CONFLICT e INVALID se dejan como están:
   * reimportar el mismo archivo no vuelve a crear nada (§10.1), y una ausencia
   * en el archivo nuevo **no desactiva** a nadie (§10.3).
   */
  async apply(adminUserId: string, batchId: string) {
    const batch = await this.batches.findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Lote de importación no encontrado.');
    if (batch.status === ImportBatchStatus.APPLIED) {
      throw new BadRequestException('Este lote ya se aplicó.');
    }
    if (batch.status === ImportBatchStatus.DISCARDED) {
      throw new BadRequestException('Este lote fue descartado. Vuelva a subir el archivo.');
    }

    const rows = await this.rows.find({
      where: { batchId, status: In([ImportRowStatus.NEW, ImportRowStatus.UPDATE]) },
      order: { rowNumber: 'ASC' },
    });

    const studentRole = await this.roles.findOne({ where: { name: RolNombre.STUDENT } });
    if (!studentRole) throw new BadRequestException('No existe el rol de estudiante.');

    const created: User[] = [];
    let updated = 0;

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const profileRepo = manager.getRepository(StudentProfile);
      const rowRepo = manager.getRepository(ImportBatchRow);

      for (const row of rows) {
        if (row.status === ImportRowStatus.NEW) {
          // Contraseña imposible de adivinar y jamás comunicada: la real la
          // fija el titular al activar. Así la cuenta nunca queda accesible
          // con un valor por defecto.
          const placeholder = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

          const user = await userRepo.save(
            userRepo.create({
              firstName: row.firstName!,
              lastName: row.lastName!,
              email: row.institutionalEmail!,
              passwordHash: placeholder,
              roleId: studentRole.id,
              status: UserStatus.PENDING_ACTIVATION,
            }),
          );
          await profileRepo.save(
            profileRepo.create({
              userId: user.id,
              universityCode: row.universityCode,
              semester: row.semester,
            }),
          );
          await rowRepo.update({ id: row.id }, { userId: user.id });
          created.push(user);
          continue;
        }

        // UPDATE: solo datos institucionales. §10.2 prohíbe tocar contraseña,
        // proyectos, afinidades, evidencias, certificados y preferencias.
        const userId = row.userId;
        if (!userId) continue;

        await userRepo.update(
          { id: userId },
          {
            firstName: row.firstName!,
            lastName: row.lastName!,
            email: row.institutionalEmail!,
          },
        );
        const profile = await profileRepo.findOne({ where: { userId } });
        if (profile) {
          await profileRepo.update(
            { id: profile.id },
            {
              semester: row.semester,
              universityCode: profile.universityCode ?? row.universityCode,
            },
          );
        } else {
          await profileRepo.save(
            profileRepo.create({
              userId,
              universityCode: row.universityCode,
              semester: row.semester,
            }),
          );
        }
        updated++;
      }

      await manager.getRepository(ImportBatch).update(
        { id: batchId },
        { status: ImportBatchStatus.APPLIED, appliedAt: new Date() },
      );

      await this.audit.record(
        {
          actorUserId: adminUserId,
          eventType: AuditEventType.IMPORT_APPLIED,
          entityType: 'import_batch',
          entityId: batchId,
          metadata: { created: created.length, updated },
        },
        manager,
      );
    });

    // Los correos van fuera de la transacción: un SMTP lento o caído no debe
    // deshacer un padrón ya aplicado (RNF09). Quien no reciba el correo puede
    // pedir el reenvío.
    for (const user of created) {
      await this.activation.issueAndSendActivation(user);
      await this.audit.record({
        actorUserId: adminUserId,
        eventType: AuditEventType.USER_PROVISIONED,
        entityType: 'user',
        entityId: user.id,
        metadata: { email: user.email, via: 'import', batchId },
      });
    }

    return {
      batchId,
      created: created.length,
      updated,
      message:
        `Importación aplicada: ${created.length} cuenta(s) nueva(s) y ${updated} actualizada(s). `
        + 'Las nuevas recibieron su enlace de activación.',
    };
  }

  /** Descarta una previsualización sin aplicarla. */
  async discard(batchId: string) {
    const batch = await this.batches.findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Lote de importación no encontrado.');
    if (batch.status === ImportBatchStatus.APPLIED) {
      throw new BadRequestException('Este lote ya se aplicó: no puede descartarse.');
    }
    await this.batches.update({ id: batchId }, { status: ImportBatchStatus.DISCARDED });
    return { message: 'Previsualización descartada.' };
  }

  async listBatches(limit = 20) {
    const rows = await this.batches.find({
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
      relations: { importedBy: true },
    });
    return rows.map((b) => ({
      id: b.id,
      filename: b.originalFilename,
      status: b.status,
      totalRows: b.totalRows,
      counts: b.counts,
      importedBy: b.importedBy ? `${b.importedBy.firstName} ${b.importedBy.lastName}` : null,
      createdAt: b.createdAt,
      appliedAt: b.appliedAt,
    }));
  }

  async getBatch(batchId: string) {
    const batch = await this.batches.findOne({
      where: { id: batchId },
      relations: { importedBy: true },
    });
    if (!batch) throw new NotFoundException('Lote de importación no encontrado.');
    const rows = await this.rows.find({ where: { batchId }, order: { rowNumber: 'ASC' } });
    return {
      id: batch.id,
      filename: batch.originalFilename,
      status: batch.status,
      counts: batch.counts,
      totalRows: batch.totalRows,
      createdAt: batch.createdAt,
      appliedAt: batch.appliedAt,
      rows: rows.map((r) => ({
        rowNumber: r.rowNumber,
        universityCode: r.universityCode,
        institutionalEmail: r.institutionalEmail,
        firstName: r.firstName,
        lastName: r.lastName,
        semester: r.semester,
        status: r.status,
        message: r.message,
      })),
    };
  }

  private countByStatus(rows: EvaluatedRow[]): Record<string, number> {
    const counts: Record<string, number> = {
      [ImportRowStatus.NEW]: 0,
      [ImportRowStatus.UPDATE]: 0,
      [ImportRowStatus.UNCHANGED]: 0,
      [ImportRowStatus.CONFLICT]: 0,
      [ImportRowStatus.INVALID]: 0,
    };
    for (const row of rows) counts[row.status]++;
    return counts;
  }
}
