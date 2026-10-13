/**
 * V3.2 §59-§60: superficie técnica de Administración.
 *
 * El diagnóstico del correo responde 404 en producción salvo con el modo
 * técnico explícito, y la auditoría se traduce a palabras sin volcar códigos.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailDiagnosticsGuard } from '../../src/mail/mail.controller';
import { AUDIT_EVENT_LABEL, auditDetail, eventTypesOf, eventTypesWithResult } from '../../src/audit/audit-labels';
import { AuditEventType } from '../../src/audit/audit.service';

const guard = (env: Record<string, string>) => new MailDiagnosticsGuard(new ConfigService(env));

describe('V3.2 §60 diagnóstico de correo', () => {
  it('en desarrollo está disponible (sigue exigiendo rol Admin)', () => {
    assert.equal(guard({ NODE_ENV: 'development' }).canActivate(), true);
    assert.equal(guard({}).canActivate(), true);
  });

  it('en producción responde 404 sin el modo técnico', () => {
    assert.throws(() => guard({ NODE_ENV: 'production' }).canActivate(), NotFoundException);
    assert.throws(() => guard({ NODE_ENV: 'production', MAIL_DIAGNOSTICS_ENABLED: 'false' }).canActivate(), NotFoundException);
  });

  it('en producción, solo con MAIL_DIAGNOSTICS_ENABLED=true', () => {
    assert.equal(guard({ NODE_ENV: 'production', MAIL_DIAGNOSTICS_ENABLED: 'true' }).canActivate(), true);
  });
});

describe('V3.2 §59 auditoría legible', () => {
  it('todo tipo de evento tiene módulo y acción en palabras', () => {
    for (const tipo of Object.values(AuditEventType)) {
      const e = AUDIT_EVENT_LABEL[tipo];
      assert.ok(e, `sin etiqueta: ${tipo}`);
      assert.doesNotMatch(e.accion, /^[A-Z_]+$/);
    }
  });

  it('los filtros por módulo y por resultado devuelven sus tipos', () => {
    assert.ok(eventTypesOf('cuentas').includes('USER_PROVISIONED'));
    assert.deepEqual(eventTypesOf('inexistente'), []);
    assert.ok(eventTypesWithResult('rechazado').includes('ACTIVITY_REJECTED'));
    assert.ok(!eventTypesWithResult('correcto').includes('ACTIVITY_REJECTED'));
  });

  it('el detalle se lee como pares, sin JSON y con identificadores abreviados', () => {
    const d = auditDetail({ de: 'draft', a: 'open', automatico: true, activityId: '0f8fad5b-d9cb-469f-a165-70867728950e' });
    assert.deepEqual(d, [
      { campo: 'Antes', valor: 'draft' },
      { campo: 'Después', valor: 'open' },
      { campo: 'Automático', valor: 'Sí' },
      { campo: 'Actividad', valor: '#0f8fad5b' },
    ]);
    assert.deepEqual(auditDetail(null), []);
  });
});
