import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';
import { AccountTokenPurpose, UserStatus } from '@perfil/shared';
import { MailJob, MailJobKind, MailJobStatus } from '../entities/mail-job.entity';
import { User } from '../entities/user.entity';
import { MAIL_PORT, MailPort, RecipientRejectedError } from '../mail/mail.port';
import { activationMail, passwordResetMail } from '../mail/templates';
import { appTimezone, identityConfig, webAppUrl } from '../config/identity.config';
import { AccountTokensService } from './account-tokens.service';

/** Reintentos tras un fallo del proveedor: 1, 5, 15 y 60 minutos. */
const ESPERAS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const MAX_INTENTOS = ESPERAS_MS.length + 1;

/** Un envío que quedó «enviándose» más de esto es de un proceso que murió. */
const ATASCADO_MS = 5 * 60_000;

export type FinalJobState = MailJobStatus | 'timeout';

/** Lo que el administrador ve del último correo de una cuenta. */
export interface LatestMail {
  kind: MailJobKind;
  status: MailJobStatus;
  lastError: string | null;
  sentAt: Date | null;
  updatedAt: Date;
}

export interface RequestCheck {
  allowed: boolean;
  /** Segundos hasta poder pedir otro; 0 si se puede ya. */
  retryAfterSeconds: number;
  reason?: 'cooldown' | 'daily_limit' | 'already_queued';
}

const PURPOSE: Record<MailJobKind, AccountTokenPurpose> = {
  account_activation: AccountTokenPurpose.ACCOUNT_ACTIVATION,
  password_reset: AccountTokenPurpose.PASSWORD_RESET,
};

/**
 * Cola de los correos de cuenta: activaciones y recuperaciones.
 *
 * Toda petición de correo de cuenta entra aquí y la atiende un worker dentro
 * del monolito, igual que la validación (§76): sin Redis, con la base como
 * cola. El token se emite en el momento de enviar, así que la cola nunca
 * guarda un enlace utilizable.
 *
 * El worker arranca en cuanto alguien encola —la espera típica es de
 * milisegundos— y además barre cada medio minuto los reintentos pendientes.
 */
@Injectable()
export class AccountMailService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('ColaDeCorreo');
  private readonly enabled: boolean;
  private trabajando = false;
  private otraVuelta = false;
  private detenido = false;
  private temporizador: NodeJS.Timeout | null = null;
  private readonly esperas = new Map<string, Array<(estado: MailJobStatus) => void>>();

  constructor(
    @InjectRepository(MailJob) private readonly jobs: Repository<MailJob>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    private readonly tokens: AccountTokensService,
    private readonly config: ConfigService,
  ) {
    this.enabled = config.get<string>('MAIL_WORKER_ENABLED', 'true') !== 'false';
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Cola de correo desactivada por configuración (MAIL_WORKER_ENABLED=false).');
      return;
    }
    // Lo que quedó a medio enviar cuando se detuvo el proceso anterior vuelve
    // a la cola: si no, esa activación no saldría nunca.
    await this.jobs
      .query(
        `UPDATE mail_jobs SET status = 'pending', next_attempt_at = now()
          WHERE status = 'sending' AND updated_at < now() - ($1 || ' milliseconds')::interval`,
        [String(ATASCADO_MS)],
      )
      .catch((error) => this.logger.error(`No se pudo recuperar la cola: ${String(error)}`));
    this.programar(2_000);
  }

  onApplicationShutdown(): void {
    this.detenido = true;
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  // =========================================================================
  //  Encolar
  // =========================================================================

  /**
   * ¿Puede pedirse ahora otro correo de este tipo para este usuario?
   *
   * Lo consultan las solicitudes públicas —que responden igual se pueda o no,
   * para no delatar cuentas— y el reenvío del administrador, que sí recibe el
   * motivo porque ya sabe que la cuenta existe.
   */
  async check(userId: string, kind: MailJobKind): Promise<RequestCheck> {
    const enCola = await this.jobs.exists({
      where: { userId, kind, status: In(['pending', 'sending'] as MailJobStatus[]) },
    });
    if (enCola) return { allowed: false, retryAfterSeconds: 0, reason: 'already_queued' };

    const purpose = PURPOSE[kind];
    const restante = await this.tokens.cooldownRemaining(userId, purpose);
    if (restante > 0) return { allowed: false, retryAfterSeconds: restante, reason: 'cooldown' };

    const enviados = await this.tokens.sentInLastDay(userId, purpose);
    if (enviados >= identityConfig.maxSendsPerDay(this.config)) {
      return { allowed: false, retryAfterSeconds: 60 * 60, reason: 'daily_limit' };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Encola un correo de cuenta y despierta al worker. Devuelve el id del envío. */
  async enqueue(userId: string, kind: MailJobKind, requestedBy: string | null): Promise<string> {
    // `next_attempt_at` lo pone la base (DEFAULT now()): el reclamo compara
    // contra now() de PostgreSQL, y con la hora de Node bastaba que el reloj de
    // la base fuera unos milisegundos atrasado para que el envío recién
    // encolado no se viera elegible y esperara a la vuelta siguiente.
    const job = await this.jobs.save(
      this.jobs.create({ userId, kind, status: 'pending', requestedBy }),
    );
    this.despertar();
    return job.id;
  }

  /**
   * Espera a que un envío termine, como mucho `ms` milisegundos.
   *
   * Lo usa el alta desde administración para poder decir «enviado» o «falló:
   * motivo» en la misma respuesta, en lugar de un «en cola» que no informa.
   */
  waitFor(jobId: string, ms: number): Promise<FinalJobState> {
    return new Promise<FinalJobState>((resolve) => {
      const reloj = setTimeout(() => {
        quitar();
        resolve('timeout');
      }, ms);
      const alTerminar = (estado: MailJobStatus) => {
        clearTimeout(reloj);
        resolve(estado);
      };
      const lista = this.esperas.get(jobId) ?? [];
      lista.push(alTerminar);
      this.esperas.set(jobId, lista);
      const quitar = () => {
        const actual = this.esperas.get(jobId)?.filter((f) => f !== alTerminar) ?? [];
        if (actual.length) this.esperas.set(jobId, actual);
        else this.esperas.delete(jobId);
      };
      // Pudo terminar antes de que nadie esperara.
      void this.jobs.findOne({ where: { id: jobId } }).then((j) => {
        if (j && ['sent', 'failed', 'skipped'].includes(j.status)) {
          quitar();
          alTerminar(j.status);
        }
      });
    });
  }

  async findJob(jobId: string): Promise<MailJob | null> {
    return this.jobs.findOne({ where: { id: jobId } });
  }

  /** El último envío de cada usuario, para que el administrador vea en qué quedó. */
  async latestFor(userIds: string[]): Promise<Map<string, LatestMail>> {
    if (userIds.length === 0) return new Map();
    const filas: Array<{
      user_id: string;
      kind: MailJobKind;
      status: MailJobStatus;
      last_error: string | null;
      sent_at: Date | null;
      updated_at: Date;
    }> = await this.jobs.query(
      `SELECT DISTINCT ON (user_id) user_id, kind, status, last_error, sent_at, updated_at
         FROM mail_jobs
        WHERE user_id = ANY($1::uuid[])
        ORDER BY user_id, created_at DESC`,
      [userIds],
    );
    return new Map(
      filas.map((f) => [
        f.user_id,
        {
          kind: f.kind,
          status: f.status,
          lastError: f.last_error,
          sentAt: f.sent_at,
          updatedAt: f.updated_at,
        },
      ]),
    );
  }

  // =========================================================================
  //  Worker
  // =========================================================================

  private programar(ms: number): void {
    if (this.detenido || !this.enabled) return;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.vuelta(), ms);
    this.temporizador.unref?.();
  }

  private despertar(): void {
    if (!this.enabled || this.detenido) return;
    if (this.trabajando) {
      this.otraVuelta = true;
      return;
    }
    setImmediate(() => void this.vuelta());
  }

  private async vuelta(): Promise<void> {
    if (this.trabajando || this.detenido) return;
    this.trabajando = true;
    try {
      do {
        this.otraVuelta = false;
        // Uno detrás de otro: el ritmo lo marca el proveedor, no el worker.
        while (!this.detenido) {
          const job = await this.reclamar();
          if (!job) break;
          await this.procesar(job);
        }
      } while (this.otraVuelta && !this.detenido);
    } catch (error) {
      this.logger.error(`La cola de correo falló esta vuelta: ${String(error)}`);
    } finally {
      this.trabajando = false;
      this.programar(30_000);
    }
  }

  /** Reclamo atómico: dos procesos no se llevan el mismo envío. */
  private async reclamar(): Promise<MailJob | null> {
    const resultado = await this.jobs.query(
      `UPDATE mail_jobs SET status = 'sending', attempts = attempts + 1, updated_at = now()
        WHERE id = (
          SELECT id FROM mail_jobs
           WHERE status = 'pending' AND next_attempt_at <= now()
           ORDER BY created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1)
        RETURNING id`,
    );
    const filas = Array.isArray(resultado?.[0]) ? resultado[0] : resultado;
    const id = filas?.[0]?.id as string | undefined;
    return id ? this.jobs.findOne({ where: { id } }) : null;
  }

  private async procesar(job: MailJob): Promise<void> {
    const user = await this.users.findOne({ where: { id: job.userId } });
    if (!user) return this.terminar(job, 'skipped', 'La cuenta ya no existe.');

    // Lo que se pidió puede haber dejado de tener sentido mientras esperaba.
    if (job.kind === 'account_activation' && user.status !== UserStatus.PENDING_ACTIVATION) {
      return this.terminar(job, 'skipped', 'La cuenta ya estaba activada o suspendida.');
    }
    if (job.kind === 'password_reset' && user.status !== UserStatus.ACTIVE) {
      return this.terminar(job, 'skipped', 'La cuenta no está activa.');
    }

    try {
      const purpose = PURPOSE[job.kind];
      const { token, code, expiresAt } = await this.tokens.issue(user.id, purpose);
      const base = webAppUrl(this.config);
      const ruta = job.kind === 'account_activation' ? '/activar' : '/restablecer';
      const link = `${base}${ruta}?token=${encodeURIComponent(token)}`;
      const horas =
        job.kind === 'account_activation'
          ? identityConfig.activationTtlHours(this.config)
          : identityConfig.passwordResetTtlMinutes(this.config) / 60;
      const params = {
        firstName: user.firstName,
        link,
        code,
        expiresAt,
        hours: horas,
        timezone: appTimezone(this.config),
      };
      const mensaje = job.kind === 'account_activation' ? activationMail(params) : passwordResetMail(params);

      await this.mail.send({ to: user.email, ...mensaje, kind: job.kind });
      return this.terminar(job, 'sent', null);
    } catch (error) {
      const motivo = (error as Error).message.slice(0, 300);
      // Un destinatario fuera de política no mejora reintentando.
      if (error instanceof RecipientRejectedError || job.attempts >= MAX_INTENTOS) {
        return this.terminar(job, 'failed', motivo);
      }
      const espera = ESPERAS_MS[Math.min(job.attempts - 1, ESPERAS_MS.length - 1)];
      // Mismo reloj que el reclamo: el de la base.
      await this.jobs.query(
        `UPDATE mail_jobs
            SET status = 'pending', last_error = $2, next_attempt_at = now() + ($3 || ' milliseconds')::interval,
                updated_at = now()
          WHERE id = $1`,
        [job.id, motivo, String(espera)],
      );
      this.logger.warn(
        `Correo a reintentar en ${Math.round(espera / 60_000)} min (intento ${job.attempts}): ${motivo}`,
      );
    }
  }

  private async terminar(job: MailJob, estado: MailJobStatus, motivo: string | null): Promise<void> {
    await this.jobs.update(
      { id: job.id },
      { status: estado, lastError: motivo, sentAt: estado === 'sent' ? new Date() : null },
    );
    const esperando = this.esperas.get(job.id);
    if (esperando) {
      this.esperas.delete(job.id);
      esperando.forEach((f) => f(estado));
    }
  }
}
