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
  normalizeUniversityCode,
  universityCodeProblem,
} from '@perfil/shared';
import { ImportBatch, ImportBatchRow } from '../entities/import-batch.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { TeacherSemesterAccess } from '../entities/teacher-semester-access.entity';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { ActivationService } from '../identity/activation.service';
import { institutionalEmailDomains, isInstitutionalEmail } from '../config/identity.config';
import { NAME_RE } from '../common/validation';
import { parseCsv } from './csv.parser';

/** Columnas del padrón de docentes (V3 §7.1). */
export const TEACHER_IMPORT_HEADERS = [
  'university_code',
  'first_name',
  'last_name',
  'institutional_email',
  'authorized_semesters',
] as const;

/** Semestres que un docente puede tener habilitados (como en la pantalla de Usuarios). */
const SEMESTRE_MAX = 8;

/**
 * Lee la celda de semestres autorizados. Acepta `1;5`, `1|5`, `1 5` o `1,5`
 * entre comillas. Vacía significa «ninguno todavía», que es válido: el docente
 * existe aunque aún no acompañe a ningún semestre.
 */
export function parseAuthorizedSemesters(raw: string | undefined): number[] | string {
  const texto = (raw ?? '').trim();
  if (!texto) return [];
  const partes = texto.split(/[|;,\s/]+/).filter(Boolean);
  const numeros: number[] = [];
  for (const p of partes) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > SEMESTRE_MAX) {
      return `Semestre autorizado no válido: «${p}». Usa números del 1 al ${SEMESTRE_MAX} separados por «;» o «|».`;
    }
    numeros.push(n);
  }
  return [...new Set(numeros)].sort((a, b) => a - b);
}

interface FilaEvaluada {
  lineNumber: number;
  universityCode: string | null;
  institutionalEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  semesters: number[] | null;
  status: ImportRowStatus;
  message: string | null;
  existingUserId: string | null;
}

/**
 * Importación del padrón de **docentes** (V3 §7.1).
 *
 * Mismo circuito que el de estudiantes —previsualizar, aplicar, descartar,
 * idempotente— sobre las mismas tablas de lotes, distinguidas por `kind`. Lo
 * que cambia es el esquema: en lugar del semestre que cursa, los semestres que
 * el docente acompaña, que se convierten en su alcance (`teacher_semester_access`).
 */
@Injectable()
export class TeacherImportService {
  constructor(
    @InjectRepository(ImportBatch) private readonly batches: Repository<ImportBatch>,
    @InjectRepository(ImportBatchRow) private readonly rows: Repository<ImportBatchRow>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(TeacherSemesterAccess) private readonly access: Repository<TeacherSemesterAccess>,
    private readonly activation: ActivationService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async preview(adminUserId: string, file: { buffer: Buffer; originalname: string }) {
    const parsed = parseCsv(file.buffer.toString('utf8'));
    const faltan = TEACHER_IMPORT_HEADERS.filter((h) => !parsed.headers.includes(h));
    if (faltan.length > 0) {
      throw new BadRequestException(
        `Faltan columnas obligatorias: ${faltan.join(', ')}. `
          + `La plantilla de docentes es: ${TEACHER_IMPORT_HEADERS.join(', ')}.`,
      );
    }
    if (parsed.rows.length === 0) throw new BadRequestException('El archivo no contiene filas de datos.');

    const evaluadas = await this.evaluar(parsed.rows);
    const counts = this.contar(evaluadas);
    const batch = await this.batches.save(
      this.batches.create({
        kind: 'teachers',
        originalFilename: file.originalname,
        fileSha256: createHash('sha256').update(file.buffer).digest('hex'),
        status: ImportBatchStatus.PREVIEWED,
        importedByUserId: adminUserId,
        counts,
        totalRows: evaluadas.length,
      }),
    );
    await this.rows.save(
      evaluadas.map((r) =>
        this.rows.create({
          batchId: batch.id,
          rowNumber: r.lineNumber,
          universityCode: r.universityCode,
          institutionalEmail: r.institutionalEmail,
          firstName: r.firstName,
          lastName: r.lastName,
          semester: null,
          semesters: r.semesters,
          status: r.status,
          message: r.message,
          userId: r.existingUserId,
        }),
      ),
    );
    await this.audit.record({
      actorUserId: adminUserId,
      eventType: AuditEventType.IMPORT_PREVIEWED,
      entityType: 'import_batch',
      entityId: batch.id,
      metadata: { kind: 'teachers', filename: file.originalname, totalRows: evaluadas.length, counts },
    });
    return {
      batchId: batch.id,
      kind: 'teachers',
      counts,
      totalRows: evaluadas.length,
      rows: evaluadas.map((r) => ({
        rowNumber: r.lineNumber,
        universityCode: r.universityCode,
        institutionalEmail: r.institutionalEmail,
        firstName: r.firstName,
        lastName: r.lastName,
        semesters: r.semesters,
        status: r.status,
        message: r.message,
      })),
    };
  }

  private async evaluar(parsed: { lineNumber: number; values: Record<string, string> }[]): Promise<FilaEvaluada[]> {
    const dominios = institutionalEmailDomains(this.config);
    const codigos = parsed.map((r) => normalizeUniversityCode(r.values.university_code)).filter(Boolean);
    const correos = parsed.map((r) => r.values.institutional_email?.trim().toLowerCase()).filter(Boolean) as string[];

    const [porCodigo, porCorreo] = await Promise.all([
      codigos.length
        ? this.users.find({ where: { universityCode: In(codigos) }, relations: { role: true } })
        : Promise.resolve([] as User[]),
      correos.length
        ? this.users.find({ where: { email: In(correos) }, relations: { role: true } })
        : Promise.resolve([] as User[]),
    ]);
    const cuentaPorCodigo = new Map(porCodigo.map((u) => [u.universityCode, u]));
    const cuentaPorCorreo = new Map(porCorreo.map((u) => [u.email, u]));
    const docentes = [...new Set([...porCodigo, ...porCorreo].filter((u) => u.role?.name === RolNombre.TEACHER).map((u) => u.id))];
    const semestresActuales = new Map<string, number[]>();
    if (docentes.length) {
      const filas = await this.access.find({ where: { teacherId: In(docentes) }, order: { semester: 'ASC' } });
      for (const f of filas) semestresActuales.set(f.teacherId, [...(semestresActuales.get(f.teacherId) ?? []), f.semester]);
    }

    const vistosCodigo = new Set<string>();
    const vistosCorreo = new Set<string>();
    const out: FilaEvaluada[] = [];

    for (const { lineNumber, values } of parsed) {
      const universityCode = normalizeUniversityCode(values.university_code) || null;
      const email = values.institutional_email?.trim().toLowerCase() || null;
      const firstName = values.first_name?.trim() || null;
      const lastName = values.last_name?.trim() || null;
      const semestres = parseAuthorizedSemesters(values.authorized_semesters);
      const base = {
        lineNumber,
        universityCode,
        institutionalEmail: email,
        firstName,
        lastName,
        semesters: Array.isArray(semestres) ? semestres : null,
        existingUserId: null as string | null,
      };

      const invalida = this.validar({ universityCode, email, firstName, lastName, dominios })
        ?? (typeof semestres === 'string' ? semestres : null);
      if (invalida) {
        out.push({ ...base, status: ImportRowStatus.INVALID, message: invalida });
        continue;
      }
      if (vistosCodigo.has(universityCode!) || vistosCorreo.has(email!)) {
        out.push({
          ...base,
          status: ImportRowStatus.CONFLICT,
          message: 'La fila repite un código o un correo que ya aparece antes en este archivo.',
        });
        continue;
      }
      vistosCodigo.add(universityCode!);
      vistosCorreo.add(email!);

      const porCod = cuentaPorCodigo.get(universityCode!);
      const porMail = cuentaPorCorreo.get(email!);
      const conflicto =
        (porCod && porCod.role?.name !== RolNombre.TEACHER && 'Ese código universitario pertenece a una cuenta que no es docente.')
        || (porMail && porMail.role?.name !== RolNombre.TEACHER && 'Ese correo pertenece a una cuenta que no es docente.')
        || (porCod && porMail && porCod.id !== porMail.id
          && 'El código y el correo corresponden a dos cuentas distintas. Debe resolverse manualmente.')
        || (!porCod && porMail && porMail.universityCode !== universityCode
          && `El correo ya pertenece a la cuenta con código ${porMail.universityCode}.`)
        || null;
      if (conflicto) {
        out.push({ ...base, status: ImportRowStatus.CONFLICT, message: conflicto });
        continue;
      }

      const cuenta = porCod ?? porMail;
      if (!cuenta) {
        out.push({ ...base, status: ImportRowStatus.NEW, message: null });
        continue;
      }
      const cambios: string[] = [];
      if (cuenta.firstName !== firstName) cambios.push('nombre');
      if (cuenta.lastName !== lastName) cambios.push('apellido');
      if (cuenta.email !== email) cambios.push('correo');
      const actuales = semestresActuales.get(cuenta.id) ?? [];
      if (actuales.join() !== (base.semesters ?? []).join()) cambios.push('semestres autorizados');
      out.push({
        ...base,
        existingUserId: cuenta.id,
        status: cambios.length ? ImportRowStatus.UPDATE : ImportRowStatus.UNCHANGED,
        message: cambios.length ? `Actualiza: ${cambios.join(', ')}.` : null,
      });
    }
    return out;
  }

  private validar(i: {
    universityCode: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    dominios: string[];
  }): string | null {
    if (!i.universityCode) return 'Falta el código universitario.';
    const problema = universityCodeProblem(i.universityCode, RolNombre.TEACHER);
    if (problema) return problema;
    if (!i.firstName) return 'Falta el nombre.';
    if (!i.lastName) return 'Falta el apellido.';
    if (!NAME_RE.test(i.firstName)) return 'El nombre contiene caracteres no permitidos.';
    if (!NAME_RE.test(i.lastName)) return 'El apellido contiene caracteres no permitidos.';
    if (!i.email) return 'Falta el correo institucional.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email)) return 'El correo no tiene un formato válido.';
    if (!isInstitutionalEmail(i.email, i.dominios)) {
      return 'El correo no pertenece a un dominio institucional autorizado.';
    }
    return null;
  }

  /** Aplica NEW y UPDATE de un lote de docentes. Idempotente. */
  async apply(adminUserId: string, batchId: string) {
    const batch = await this.batches.findOne({ where: { id: batchId } });
    if (!batch || batch.kind !== 'teachers') throw new NotFoundException('Lote de importación de docentes no encontrado.');
    if (batch.status === ImportBatchStatus.APPLIED) throw new BadRequestException('Este lote ya se aplicó.');
    if (batch.status === ImportBatchStatus.DISCARDED) {
      throw new BadRequestException('Este lote fue descartado. Vuelva a subir el archivo.');
    }
    const filas = await this.rows.find({
      where: { batchId, status: In([ImportRowStatus.NEW, ImportRowStatus.UPDATE]) },
      order: { rowNumber: 'ASC' },
    });
    const rolDocente = await this.roles.findOne({ where: { name: RolNombre.TEACHER } });
    if (!rolDocente) throw new BadRequestException('No existe el rol docente.');

    const creados: User[] = [];
    let actualizados = 0;
    await this.dataSource.transaction(async (manager) => {
      const usuarios = manager.getRepository(User);
      const acceso = manager.getRepository(TeacherSemesterAccess);
      const reemplazarSemestres = async (teacherId: string, semestres: number[]) => {
        await acceso.delete({ teacherId });
        if (semestres.length) {
          await acceso.save(semestres.map((semester) => acceso.create({ teacherId, semester, grantedById: adminUserId })));
        }
      };

      for (const fila of filas) {
        const semestres = fila.semesters ?? [];
        if (fila.status === ImportRowStatus.NEW) {
          const placeholder = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
          const docente = await usuarios.save(
            usuarios.create({
              firstName: fila.firstName!,
              lastName: fila.lastName!,
              email: fila.institutionalEmail!,
              passwordHash: placeholder,
              roleId: rolDocente.id,
              universityCode: fila.universityCode!,
              semester: null,
              status: UserStatus.PENDING_ACTIVATION,
            }),
          );
          await reemplazarSemestres(docente.id, semestres);
          await manager.getRepository(ImportBatchRow).update({ id: fila.id }, { userId: docente.id });
          creados.push(docente);
          continue;
        }
        if (!fila.userId) continue;
        await usuarios.update(
          { id: fila.userId },
          { firstName: fila.firstName!, lastName: fila.lastName!, email: fila.institutionalEmail! },
        );
        await reemplazarSemestres(fila.userId, semestres);
        await this.audit.record(
          {
            actorUserId: adminUserId,
            eventType: AuditEventType.TEACHER_SCOPE_CHANGED,
            entityType: 'user',
            entityId: fila.userId,
            metadata: { semesters: semestres, via: 'import', batchId },
          },
          manager,
        );
        actualizados++;
      }
      await manager.getRepository(ImportBatch).update({ id: batchId }, { status: ImportBatchStatus.APPLIED, appliedAt: new Date() });
      await this.audit.record(
        {
          actorUserId: adminUserId,
          eventType: AuditEventType.IMPORT_APPLIED,
          entityType: 'import_batch',
          entityId: batchId,
          metadata: { kind: 'teachers', created: creados.length, updated: actualizados },
        },
        manager,
      );
    });

    // Como en el padrón de estudiantes: el correo sale fuera de la transacción.
    for (const docente of creados) {
      docente.role = rolDocente;
      await this.activation.queueActivation(docente, adminUserId);
      await this.audit.record({
        actorUserId: adminUserId,
        eventType: AuditEventType.USER_PROVISIONED,
        entityType: 'user',
        entityId: docente.id,
        metadata: { email: docente.email, role: RolNombre.TEACHER, via: 'import', batchId },
      });
    }
    return {
      batchId,
      created: creados.length,
      updated: actualizados,
      message:
        `Importación de docentes aplicada: ${creados.length} cuenta(s) nueva(s) y ${actualizados} actualizada(s). `
        + 'Las nuevas recibieron su enlace de activación.',
    };
  }

  private contar(filas: FilaEvaluada[]): Record<string, number> {
    const counts: Record<string, number> = {
      [ImportRowStatus.NEW]: 0,
      [ImportRowStatus.UPDATE]: 0,
      [ImportRowStatus.UNCHANGED]: 0,
      [ImportRowStatus.CONFLICT]: 0,
      [ImportRowStatus.INVALID]: 0,
    };
    for (const f of filas) counts[f.status]++;
    return counts;
  }
}
