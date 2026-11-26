/**
 * V7.1 BATCH V7-7 · Requisitos de activación: ninguna falta queda oculta.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_READINESS_ROWS, filaDeRequisito } from '@perfil/shared';
import { READINESS_MESSAGE, projectReadiness } from '../../src/projects/project-readiness.rules';

describe('V7-7 PROY-01 la lista de requisitos cubre todos los códigos', () => {
  it('cada código que la API puede devolver pertenece a una fila', () => {
    for (const code of Object.keys(READINESS_MESSAGE)) assert.ok(filaDeRequisito(code), `sin fila: ${code}`);
  });
  it('«cada área con su tecnología» tiene su propia fila', () => {
    assert.equal(filaDeRequisito('skill_per_area'), 'skill_per_area');
  });
  it('la web muestra exactamente las mismas filas', () => {
    const web = readFileSync(join(__dirname, '../../../web/src/components/ProjectReadiness.tsx'), 'utf8');
    for (const r of PROJECT_READINESS_ROWS) {
      assert.ok(web.includes(`code: '${r.row}'`), `la web no tiene la fila ${r.row}`);
      for (const c of r.codes) assert.ok(web.includes(`'${c}'`), `la web no conoce el código ${c}`);
    }
  });
  it('P01: un área sin tecnología bloquea y dice cuál', () => {
    const r = projectReadiness({
      title: 'Proyecto', areaCount: 2, skillCount: 1, areasWithoutSkill: ['Redes'], repositoryUrl: 'https://github.com/a/b',
      repositoryCheck: 'available' as never, pendingInvitations: 0, members: [], ownContributionConfirmed: true,
      evidenceCount: 1, demoCheck: null as never,
    } as never);
    assert.equal(r.ready, false);
    assert.match(r.missing.find((m) => m.code === 'skill_per_area')?.message ?? '', /Redes/);
  });
});
