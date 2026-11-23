import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { IsNull, Not, Repository } from 'typeorm';
import { ValidationResourceType } from '@perfil/shared';
import { StudentVerifiedEmail } from '../entities/verified-email.entity';
import { User } from '../entities/user.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { MAIL_PORT, MailPort } from '../mail/mail.port';
import { emailOwnershipMail } from '../mail/templates';
import { maskEmail } from '../mail/mail.service';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { ValidationService } from './validation.service';

/** Correos personales por estudiante (pendientes y comprobados). */
export const MAX_VERIFIED_EMAILS = 3;
/** Vigencia del código. */
export const OWNERSHIP_CODE_MINUTES = 15;
/** Intentos por código antes de invalidarlo. */
export const OWNERSHIP_MAX_ATTEMPTS = 5;
/** Espera mínima entre dos envíos al mismo correo. */
const REENVIO_MS = 60 * 1000;
/** Envíos por correo cada 24 horas. */
const MAX_ENVIOS_DIA = 5;

const CORREO = /^[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

export interface VerifiedEmailView {
  id: string;
  email: string;
  verified: boolean;
  verifiedAt: string | null;
  codeExpiresAt: string | null;
}

/**
 * V9 · Correos personales comprobados del estudiante.
 *
 * Sirven para una sola cosa: reconocer al destinatario de una insignia
 * (Credly y Open Badges guardan el correo como hash con sal). Por eso solo
 * cuentan los comprobados con un código enviado a ese buzón: declarar un
 * correo no basta, porque cualquiera puede escribir el de otra persona.
 */
@Injectable()
export class VerifiedEmailsService {
  constructor(
    @InjectRepository(StudentVerifiedEmail) private readonly emails: Repository<StudentVerifiedEmail>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(ExternalCertificate) private readonly certificates: Repository<ExternalCertificate>,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    private readonly audit: AuditService,
    private readonly validation: ValidationService,
  ) {}

  /** Correos comprobados de un usuario (los que usa el validador). */
  async verifiedFor(userId: string): Promise<string[]> {
    const filas = await this.emails.find({ where: { userId, verifiedAt: Not(IsNull()) } });
    return filas.map((f) => f.email);
  }

  async list(userId: string): Promise<VerifiedEmailView[]> {
    const filas = await this.emails.find({ where: { userId }, order: { createdAt: 'ASC' } });
    return filas.map((f) => this.vista(f));
  }

  /** Agrega el correo (o reenvía el código si ya estaba pendiente). */
  async request(userId: string, crudo: string): Promise<VerifiedEmailView> {
    const email = (crudo ?? '').trim().toLowerCase();
    if (email.length > 254 || !CORREO.test(email)) throw new BadRequestException('Escribe un correo válido.');

    const usuario = await this.users.findOne({ where: { id: userId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    if (usuario.email.toLowerCase() === email) {
      throw new BadRequestException('Ese ya es tu correo institucional: Afinia ya lo reconoce.');
    }

    let fila = await this.emails.findOne({ where: { userId, email } });
    if (fila?.verifiedAt) throw new ConflictException('Ese correo ya está comprobado.');

    // Un correo comprobado por otra cuenta no se puede volver a reclamar. El
    // mensaje no dice de quién es, para no revelar correos ajenos.
    const ajeno = await this.emails.findOne({ where: { email, verifiedAt: Not(IsNull()) } });
    if (ajeno && ajeno.userId !== userId) throw new ConflictException('Ese correo no se puede agregar.');

    if (!fila) {
      const cuantos = await this.emails.count({ where: { userId } });
      if (cuantos >= MAX_VERIFIED_EMAILS) {
        throw new BadRequestException(`Puedes tener hasta ${MAX_VERIFIED_EMAILS} correos personales. Quita uno para agregar otro.`);
      }
      fila = this.emails.create({ userId, email, attempts: 0, sentCount: 0 });
    }

    const ahora = Date.now();
    if (fila.lastSentAt && ahora - fila.lastSentAt.getTime() < REENVIO_MS) {
      throw new HttpException('Espera un minuto antes de pedir otro código.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!fila.lastSentAt || ahora - fila.lastSentAt.getTime() > 24 * 60 * 60 * 1000) fila.sentCount = 0;
    if (fila.sentCount >= MAX_ENVIOS_DIA) {
      throw new HttpException('Pediste demasiados códigos para este correo. Prueba mañana.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    fila.codeExpiresAt = new Date(ahora + OWNERSHIP_CODE_MINUTES * 60 * 1000);
    fila.attempts = 0;
    fila.sentCount += 1;
    fila.lastSentAt = new Date(ahora);
    fila = await this.emails.save(fila);
    fila.codeHash = hashCodigo(fila.id, codigo);
    await this.emails.save(fila);

    try {
      const m = emailOwnershipMail({ firstName: usuario.firstName, code: codigo, minutes: OWNERSHIP_CODE_MINUTES });
      await this.mail.send({ to: email, subject: m.subject, text: m.text, html: m.html, kind: 'email_ownership' });
    } catch {
      throw new ServiceUnavailableException(`No se pudo enviar el código a ${maskEmail(email)}. Inténtalo más tarde.`);
    }
    return this.vista(fila);
  }

  /** Comprueba el código. Al acertar, vuelve a validar las credenciales del estudiante. */
  async confirm(userId: string, id: string, codigo: string): Promise<VerifiedEmailView> {
    const fila = await this.emails.findOne({ where: { id, userId } });
    if (!fila) throw new NotFoundException('Correo no encontrado.');
    if (fila.verifiedAt) return this.vista(fila);
    if (!fila.codeHash || !fila.codeExpiresAt || fila.codeExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('El código venció. Pide otro.');
    }
    if (fila.attempts >= OWNERSHIP_MAX_ATTEMPTS) {
      throw new BadRequestException('Demasiados intentos. Pide otro código.');
    }

    const limpio = String(codigo ?? '').replace(/\D/g, '');
    const esperado = Buffer.from(fila.codeHash, 'hex');
    const recibido = Buffer.from(hashCodigo(fila.id, limpio), 'hex');
    if (limpio.length !== 6 || !timingSafeEqual(esperado, recibido)) {
      fila.attempts += 1;
      if (fila.attempts >= OWNERSHIP_MAX_ATTEMPTS) fila.codeHash = null;
      await this.emails.save(fila);
      throw new BadRequestException('El código no es correcto.');
    }

    // Carrera: otra cuenta pudo comprobarlo mientras tanto. El índice único
    // parcial lo impide en la base; aquí se traduce a un mensaje claro.
    fila.verifiedAt = new Date();
    fila.codeHash = null;
    fila.codeExpiresAt = null;
    try {
      await this.emails.save(fila);
    } catch {
      throw new ConflictException('Ese correo no se puede agregar.');
    }

    await this.audit.record({
      actorUserId: userId,
      eventType: AuditEventType.VERIFIED_EMAIL_ADDED,
      entityType: 'student_verified_email',
      entityId: fila.id,
      metadata: { email: maskEmail(fila.email) },
    });
    await this.revalidar(userId);
    return this.vista(fila);
  }

  async remove(userId: string, id: string): Promise<void> {
    const fila = await this.emails.findOne({ where: { id, userId } });
    if (!fila) throw new NotFoundException('Correo no encontrado.');
    await this.emails.delete({ id: fila.id });
    if (fila.verifiedAt) {
      await this.audit.record({
        actorUserId: userId,
        eventType: AuditEventType.VERIFIED_EMAIL_REMOVED,
        entityType: 'student_verified_email',
        entityId: fila.id,
        metadata: { email: maskEmail(fila.email) },
      });
      // Lo corroborado con ese correo deja de estarlo: se vuelve a comprobar.
      await this.revalidar(userId);
    }
  }

  private async revalidar(userId: string): Promise<void> {
    const perfil = await this.profiles.findOne({ where: { userId } });
    if (!perfil) return;
    const certs = await this.certificates.find({ where: { studentProfileId: perfil.id }, select: { id: true } });
    for (const c of certs) {
      await this.validation.enqueue({ resourceType: ValidationResourceType.EXTERNAL_CERTIFICATE, resourceId: c.id, force: true });
    }
  }

  private vista(f: StudentVerifiedEmail): VerifiedEmailView {
    return {
      id: f.id,
      email: f.email,
      verified: !!f.verifiedAt,
      verifiedAt: f.verifiedAt?.toISOString() ?? null,
      codeExpiresAt: f.verifiedAt ? null : f.codeExpiresAt?.toISOString() ?? null,
    };
  }
}

function hashCodigo(id: string, codigo: string): string {
  return createHash('sha256').update(`afinia-correo:${id}:${codigo}`).digest('hex');
}
