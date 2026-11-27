/**
 * V7.1 BATCH V7-12 · Inicio de Dirección (§13, H12, H13).
 *
 * Sin base de datos: una conexión simulada que registra el SQL. Comprueba que
 * el Inicio de Dirección usa su propio alcance (no el de Administración), que
 * sus conjuntos son una lista cerrada sin tarjetas de Administración, que una
 * tarjeta que falla no apaga a las demás y que las tarjetas de estudiantes no
 * leen correos ni códigos.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { DirectorHomeService, SEGMENTOS_DIRECCION } from '../../src/reports/director-home.service';
import { SEGMENTOS } from '../../src/reports/admin-home.service';

const DIRECTOR = '00000000-0000-0000-0000-0000000000d1';

function conexion(fallaEn?: string) {
  const sql: { texto: string; params: unknown[] }[] = [];
  const dataSource = {
    query: async (texto: string, params: unknown[] = []) => {
      sql.push({ texto, params });
      if (fallaEn && texto.includes(fallaEn)) throw new Error('relación no disponible');
      return [{ c: 2 }];
    },
  };
  return { servicio: new DirectorHomeService(dataSource as never), sql };
}

describe('V7-12 · Inicio de Dirección', () => {
  it('§13: las diez tarjetas de Dirección y ninguna exclusiva de Administración', async () => {
    const { servicio } = conexion();
    const { tarjetas } = await servicio.resumen(DIRECTOR);
    const propias = ['aprobaciones', 'credenciales', 'estudiantes', 'proyectos', 'actividades', 'participaciones', 'recursos', 'autonomia', 'puntos', 'analitica'];
    assert.deepEqual(Object.keys(tarjetas).sort(), [...propias].sort());
    assert.deepEqual(Object.keys(SEGMENTOS_DIRECCION).sort(), [...propias].sort());
    for (const soloAdmin of ['cuentas', 'roles', 'padron', 'auditoria', 'catalogo', 'pedidos', 'categorias', 'gamificacion']) {
      assert.ok(soloAdmin in SEGMENTOS, soloAdmin);
      assert.equal(soloAdmin in SEGMENTOS_DIRECCION, false, soloAdmin);
    }
  });

  it('H13: si una tarjeta falla, llega con su error y las demás siguen con sus totales', async () => {
    const { servicio } = conexion('approval_policies');
    const { tarjetas } = await servicio.resumen(DIRECTOR);
    assert.deepEqual(tarjetas.autonomia, { error: 'No se pudo cargar este resumen.' });
    assert.equal('total' in tarjetas.autonomia, false);
    assert.equal(typeof tarjetas.proyectos.total, 'number');
  });

  it('H12: una tarjeta de Administración o un conjunto inventado no llegan a la base', async () => {
    const { servicio, sql } = conexion();
    await assert.rejects(servicio.detalle(DIRECTOR, 'cuentas', 'pendientes'), NotFoundException);
    await assert.rejects(servicio.detalle(DIRECTOR, 'auditoria', 'recientes'), NotFoundException);
    await assert.rejects(servicio.detalle(DIRECTOR, 'aprobaciones', "academica'; DROP TABLE users; --"), NotFoundException);
    await assert.rejects(servicio.detalle(DIRECTOR, 'constructor', 'recientes'), NotFoundException);
    assert.equal(sql.length, 0);
  });

  it('las actividades usan la visibilidad de la gestión de Dirección, con su ID como parámetro', async () => {
    const { servicio, sql } = conexion();
    await servicio.detalle(DIRECTOR, 'actividades', 'academica');
    const consulta = sql.map((s) => s.texto).join('\n');
    assert.match(consulta, /a\.requires_review AND a\.review_status = 'approved'/);
    assert.match(consulta, /activity_responsibles/);
    assert.ok(sql.every((s) => s.params[0] === DIRECTOR));
    // No es el predicado de Administración (que ve las propuestas en revisión).
    assert.doesNotMatch(consulta, /a\.review_status IS NOT NULL\)\)/);
  });

  it('«Actividades por aprobar» lee toda la bandeja pendiente, como Aprobaciones', async () => {
    const { servicio, sql } = conexion();
    await servicio.detalle(DIRECTOR, 'aprobaciones', 'externa');
    const consulta = sql.map((s) => s.texto).join('\n');
    assert.match(consulta, /a\.origin_type = 'external' AND a\.review_status = 'pending'/);
    assert.match(consulta, /ORDER BY COALESCE\(a\.submitted_at, a\.created_at\) DESC, a\.id DESC LIMIT 10/);
  });

  it('los proyectos son los de la galería de Dirección: sin los visibles solo a docentes', async () => {
    const { servicio, sql } = conexion();
    await servicio.detalle(DIRECTOR, 'proyectos', 'recientes');
    const consulta = sql.map((s) => s.texto).join('\n');
    assert.match(consulta, /p\.visibility IN \('profile', 'public_link'\)/);
    assert.doesNotMatch(consulta, /'teachers'/);
  });

  it('las tarjetas de estudiantes no leen correos, códigos ni contraseñas', async () => {
    const { servicio, sql } = conexion();
    await servicio.detalle(DIRECTOR, 'estudiantes', 'semestres');
    await servicio.detalle(DIRECTOR, 'estudiantes', 'recientes');
    await servicio.detalle(DIRECTOR, 'participaciones', 'recientes');
    assert.doesNotMatch(sql.map((s) => s.texto).join('\n'), /email|university_code|password|token/);
  });
});
