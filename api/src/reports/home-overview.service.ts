import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  ActivityReviewStatus,
  ConstancyStatus,
  ImportBatchStatus,
  ManualReviewStatus,
  RolNombre,
  UserStatus,
} from '@perfil/shared';

const n = (v: unknown) => Number(v ?? 0);

/**
 * Resúmenes breves para el «Inicio» de Administración y Dirección (V3 §52, §54).
 *
 * Solo conteos operativos: qué hay que atender y cuánto hay de cada cosa. No
 * hay datos de estudiantes individuales ni indicadores de rendimiento; la
 * analítica está en su propia pantalla.
 */
@Injectable()
export class HomeOverviewService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /** V3 §54: Inicio de Administración. */
  async admin() {
    const q = (sql: string, params: unknown[] = []) => this.dataSource.query(sql, params);
    const [usuarios, revision, importaciones, auditoria, credenciales] = await Promise.all([
      q(`SELECT r.name AS role, u.status, COUNT(*)::int AS count
           FROM users u JOIN roles r ON r.id = u.role_id GROUP BY r.name, u.status`),
      q(`SELECT COUNT(*)::int AS count FROM activities WHERE review_status = $1`, [ActivityReviewStatus.PENDING]),
      q(`SELECT status, created_at FROM import_batches ORDER BY created_at DESC LIMIT 1`),
      q(`SELECT COUNT(*)::int AS count FROM audit_events WHERE created_at >= now() - interval '7 days'`),
      q(`SELECT COUNT(*)::int AS count FROM validation_records WHERE manual_review_status = $1`, [ManualReviewStatus.REQUESTED]),
    ]);

    const roles = Object.values(RolNombre).map((role) => {
      const filas = usuarios.filter((f: any) => f.role === role);
      return {
        role,
        total: filas.reduce((a: number, f: any) => a + n(f.count), 0),
        active: n(filas.find((f: any) => f.status === UserStatus.ACTIVE)?.count),
        pendingActivation: n(filas.find((f: any) => f.status === UserStatus.PENDING_ACTIVATION)?.count),
      };
    });

    // Solo el modo de correo, nunca credenciales.
    const transporte = (this.config.get<string>('MAIL_TRANSPORT') || 'auto').toLowerCase();
    const smtp = !!this.config.get<string>('SMTP_HOST');
    return {
      users: roles,
      attention: {
        activitiesPendingReview: n(revision[0]?.count),
        credentialsPendingManualReview: n(credenciales[0]?.count),
        pendingActivation: roles.reduce((a, r) => a + r.pendingActivation, 0),
      },
      lastImport: importaciones[0]
        ? { status: importaciones[0].status as ImportBatchStatus, createdAt: importaciones[0].created_at }
        : null,
      auditEventsLast7Days: n(auditoria[0]?.count),
      mail: { mode: transporte === 'console' || (transporte === 'auto' && !smtp) ? 'simulated' : 'smtp' },
    };
  }

  /** V3 §52: lo que Dirección tiene pendiente, para su Inicio. */
  async directorPending() {
    const q = (sql: string, params: unknown[] = []) => this.dataSource.query(sql, params);
    const [revision, observadas, credenciales, constancias] = await Promise.all([
      q(`SELECT COUNT(*)::int AS count FROM activities WHERE review_status = $1`, [ActivityReviewStatus.PENDING]),
      q(`SELECT COUNT(*)::int AS count FROM activities WHERE review_status = $1`, [ActivityReviewStatus.OBSERVED]),
      q(`SELECT COUNT(*)::int AS count FROM validation_records WHERE manual_review_status = $1`, [ManualReviewStatus.REQUESTED]),
      q(`SELECT COUNT(*)::int AS count FROM internal_constancies WHERE status = $1`, [ConstancyStatus.PENDING]),
    ]);
    return {
      activitiesPendingReview: n(revision[0]?.count),
      activitiesObserved: n(observadas[0]?.count),
      credentialsPendingManualReview: n(credenciales[0]?.count),
      constanciesPending: n(constancias[0]?.count),
    };
  }
}
