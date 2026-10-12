/**
 * Pruebas unitarias de la importación de padrón (V3.2 BATCH 1, §7.3–§7.6).
 *
 * Lo que una suite e2e no puede provocar sin romper la base: que una
 * aplicación falle a mitad de camino y quede FAILED con su motivo.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImportBatchStatus, ImportRowStatus } from '@perfil/shared';
import { codificacionProblema, columnasProblema, parseCsv } from '../../src/imports/csv.parser';
import { ImportsService } from '../../src/imports/imports.service';

describe('V3.2 §7.6 · Columnas y codificación del CSV', () => {
  it('cuenta las columnas reales de cada fila', () => {
    const p = parseCsv('a,b,c\n1,2,3\n1,2\n1,2,3,4\n');
    assert.deepEqual(p.rows.map((r) => r.columns), [3, 2, 4]);
  });

  it('acepta la fila con tantas columnas como la cabecera', () => {
    assert.equal(columnasProblema({ columns: 5 }, 5), null);
  });

  it('explica la columna que falta y la que sobra', () => {
    assert.match(columnasProblema({ columns: 4 }, 5) ?? '', /falta/);
    assert.match(columnasProblema({ columns: 6 }, 5) ?? '', /sobra/);
  });

  it('una coma entre comillas no cuenta como columna de más', () => {
    const p = parseCsv('a,b,c\n1,"Rojas, Ana",3\n');
    assert.equal(columnasProblema(p.rows[0], p.headers.length), null);
  });

  it('detecta un archivo que no es UTF-8', () => {
    const latin1 = Buffer.from([0x4a, 0x6f, 0x73, 0xe9]).toString('utf8');
    assert.ok(codificacionProblema(latin1));
    assert.equal(codificacionProblema('José Peña'), null);
  });
});

describe('V3.2 §7.3 / §7.5 · Resumen y lote fallido', () => {
  const servicio = (actualizaciones: unknown[]) => {
    const s = Object.create(ImportsService.prototype) as ImportsService;
    (s as unknown as { batches: unknown }).batches = {
      update: async (where: unknown, cambios: unknown) => {
        actualizaciones.push({ where, cambios });
      },
    };
    return s;
  };

  it('el resumen informa lo que entró y lo que quedó fuera', () => {
    const r = servicio([]).resumen(
      { [ImportRowStatus.NEW]: 3, [ImportRowStatus.UNCHANGED]: 200, [ImportRowStatus.CONFLICT]: 2, [ImportRowStatus.INVALID]: 1 },
      3,
      0,
    );
    assert.deepEqual(r.summary, { inserted: 3, updated: 0, unchanged: 200, skippedConflict: 2, invalid: 1 });
  });

  it('una aplicación que falla queda FAILED con su motivo, sin correos', async () => {
    const hechas: { where: unknown; cambios: { status: string; failureReason: string } }[] = [];
    await servicio(hechas).marcarFallido('lote-1', new Error('duplicate key: ana.rojas@est.univalle.edu ya existe'));
    assert.equal(hechas.length, 1);
    assert.deepEqual(hechas[0].where, { id: 'lote-1' });
    assert.equal(hechas[0].cambios.status, ImportBatchStatus.FAILED);
    assert.ok(!hechas[0].cambios.failureReason.includes('@'));
    assert.match(hechas[0].cambios.failureReason, /\[correo\]/);
  });

  it('el motivo se recorta a 300 caracteres', async () => {
    const hechas: { cambios: { failureReason: string } }[] = [];
    await servicio(hechas as never).marcarFallido('lote-2', new Error('x'.repeat(1000)));
    assert.equal(hechas[0].cambios.failureReason.length, 300);
  });
});
