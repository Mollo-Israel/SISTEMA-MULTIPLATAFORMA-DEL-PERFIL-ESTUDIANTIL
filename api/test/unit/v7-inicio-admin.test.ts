/**
 * V7.1 BATCH V7-11 · Inicio de Administración (§3.1, H01, H13).
 *
 * Sin base de datos: una conexión simulada que registra el SQL y puede fallar
 * en una tabla concreta. Comprueba que una tarjeta que falla no apaga a las
 * demás ni se disfraza de cero, que los conjuntos son una lista cerrada y que
 * la auditoría nunca lee los metadatos de los eventos.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { AdminHomeService, SEGMENTOS } from '../../src/reports/admin-home.service';

function conexion(fallaEn?: string) {
  const sql: string[] = [];
  const dataSource = {
    query: async (texto: string) => {
      sql.push(texto);
      if (fallaEn && texto.includes(fallaEn)) throw new Error('relación no disponible');
      return [{ c: 3 }];
    },
  };
  return { servicio: new AdminHomeService(dataSource as never), sql };
}

describe('V7-11 · Inicio de Administración', () => {
  it('H13: si una tarjeta falla, llega con su error y las demás siguen con sus totales', async () => {
    const { servicio } = conexion('skill_requests');
    const { tarjetas } = await servicio.resumen('00000000-0000-0000-0000-000000000001');
    assert.deepEqual(tarjetas.pedidos, { error: 'No se pudo cargar este resumen.' });
    assert.equal(tarjetas.cuentas.total, 3);
    assert.equal(tarjetas.categorias.total, 3);
    // Nunca un cero «válido» en lugar del error.
    assert.equal('total' in tarjetas.pedidos, false);
  });

  it('§3.1: quince tarjetas del contrato más la de revisión global, sin la de correo', async () => {
    const { servicio } = conexion();
    const { tarjetas } = await servicio.resumen('00000000-0000-0000-0000-000000000001');
    for (const t of ['cuentas', 'roles', 'padron', 'auditoria', 'catalogo', 'pedidos', 'categorias', 'academicas',
      'extracurriculares', 'externas', 'credenciales', 'recursos', 'puntos', 'gamificacion', 'proyectos', 'revision']) {
      assert.ok(t in tarjetas, t);
      assert.ok(t in SEGMENTOS, t);
    }
    assert.equal('mail' in tarjetas, false);
    assert.equal('correo' in tarjetas, false);
  });

  it('un conjunto que no está en la lista no llega a la base', async () => {
    const { servicio, sql } = conexion();
    await assert.rejects(servicio.detalle('x', 'cuentas', 'todas'), NotFoundException);
    await assert.rejects(servicio.detalle('x', 'mail', 'estado'), NotFoundException);
    await assert.rejects(servicio.detalle('x', 'cuentas', "pendientes'; DROP TABLE users; --"), NotFoundException);
    await assert.rejects(servicio.detalle('x', 'roles', 'ROOT'), NotFoundException);
    assert.equal(sql.length, 0);
  });

  it('H01: como máximo 10 filas, orden estable por fecha y desempate por ID', async () => {
    const { servicio, sql } = conexion();
    const d = await servicio.detalle('x', 'catalogo', 'tecnologias');
    assert.equal(d.total, 3);
    assert.ok(d.filas.length <= 10);
    assert.match(sql.join('\n'), /ORDER BY s\.created_at DESC, s\.id DESC LIMIT 10/);
  });

  it('la auditoría muestra quién, qué y cuándo, pero nunca lee los metadatos', async () => {
    const { servicio, sql } = conexion();
    await servicio.detalle('x', 'auditoria', 'recientes');
    assert.doesNotMatch(sql.join('\n'), /metadata/);
  });

  it('el estado de un rol se pasa como parámetro y uno desconocido se lee como «todas»', async () => {
    const { servicio, sql } = conexion();
    await servicio.detalle('x', 'roles', 'TEACHER', "active' OR 1=1 --");
    assert.doesNotMatch(sql.join('\n'), /OR 1=1/);
    assert.match(sql.join('\n'), /r\.name = \$1/);
  });
});
