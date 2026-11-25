/**
 * V7.1 §4.1: filtros excluyentes de los listados (BATCH V7-1).
 *
 * El estado se elige en un único selector y lo aplica el servidor. Un valor
 * desconocido es un 400 con su campo, nunca un filtro ignorado.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ActivityOrigin, ActivityReviewStatus, ActivityStatus, ActivityType, RolNombre } from '@perfil/shared';
import {
  condicionDeVigencia, ESTADOS_DE_CATALOGO, estadoDeCatalogoPara, leerFiltro,
} from '../../src/common/estado-de-listado';
import { condicionesDeGestion } from '../../src/activities/dto/query-managed-activities.dto';

describe('V7.1 §4.1 leerFiltro', () => {
  it('sin valor deja el comportamiento anterior del endpoint', () => {
    assert.equal(leerFiltro(undefined, ESTADOS_DE_CATALOGO), undefined);
    assert.equal(leerFiltro('', ESTADOS_DE_CATALOGO), undefined);
  });

  it('acepta solo los valores declarados', () => {
    assert.equal(leerFiltro('inactive', ESTADOS_DE_CATALOGO), 'inactive');
    assert.throws(() => leerFiltro('borradas', ESTADOS_DE_CATALOGO), BadRequestException);
  });

  it('el 400 señala el campo del filtro', () => {
    try {
      leerFiltro('x', ESTADOS_DE_CATALOGO, 'status');
      assert.fail('debía rechazar');
    } catch (e) {
      const cuerpo = (e as BadRequestException).getResponse() as { fields: Record<string, string[]>; code: string };
      assert.equal(cuerpo.code, 'INVALID_LIST_FILTER');
      assert.ok(cuerpo.fields.status?.[0]?.includes('active, inactive, all'));
    }
  });
});

describe('V7.1 §4.1 estado de catálogo por rol', () => {
  it('Administración elige; sin filtro recibe todo, como antes', () => {
    assert.equal(estadoDeCatalogoPara(RolNombre.ADMIN, 'inactive'), 'inactive');
    assert.equal(estadoDeCatalogoPara(RolNombre.ADMIN, undefined), 'all');
  });

  it('nadie más ve lo dado de baja, aunque lo pida', () => {
    for (const rol of [RolNombre.CAREER_DIRECTOR, RolNombre.TEACHER, RolNombre.STUDENT, RolNombre.SCIENTIFIC_SOCIETY]) {
      assert.equal(estadoDeCatalogoPara(rol, 'inactive'), 'active');
      assert.equal(estadoDeCatalogoPara(rol, 'all'), 'active');
    }
  });

  it('cada estado es una condición exclusiva sobre isActive', () => {
    assert.deepEqual(condicionDeVigencia('active'), { isActive: true });
    assert.deepEqual(condicionDeVigencia('inactive'), { isActive: false });
    assert.deepEqual(condicionDeVigencia('all'), {});
  });
});

describe('V7.1 §4.1 actividades: ciclo de vida y revisión por separado', () => {
  it('sin filtros, una sola condición vacía (respuesta de siempre)', () => {
    assert.deepEqual(condicionesDeGestion({}), [{}]);
  });

  it('tipo, origen y estado se combinan en la misma condición', () => {
    assert.deepEqual(
      condicionesDeGestion({ type: ActivityType.ACADEMICA, originType: ActivityOrigin.EXTERNAL, status: ActivityStatus.DRAFT }),
      [{ type: ActivityType.ACADEMICA, originType: ActivityOrigin.EXTERNAL, status: ActivityStatus.DRAFT }],
    );
  });

  it('«sin enviar» es la que requiere revisión y todavía no tiene estado', () => {
    assert.deepEqual(condicionesDeGestion({ review: 'unsubmitted' }), [{ requiresReview: true, reviewStatus: IsNull() }]);
  });

  it('«no requiere revisión» incluye lo publicado sin pasar por Dirección', () => {
    assert.deepEqual(condicionesDeGestion({ review: ActivityReviewStatus.NOT_REQUIRED, status: ActivityStatus.OPEN }), [
      { status: ActivityStatus.OPEN, requiresReview: false },
      { status: ActivityStatus.OPEN, reviewStatus: ActivityReviewStatus.NOT_REQUIRED },
    ]);
  });

  it('un estado de revisión se combina con el ciclo de vida (borrador + pendiente)', () => {
    assert.deepEqual(condicionesDeGestion({ status: ActivityStatus.DRAFT, review: ActivityReviewStatus.PENDING }), [
      { status: ActivityStatus.DRAFT, requiresReview: true, reviewStatus: ActivityReviewStatus.PENDING },
    ]);
  });
});
