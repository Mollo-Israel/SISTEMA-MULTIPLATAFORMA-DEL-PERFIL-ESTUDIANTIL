/**
 * V7.1 BATCH V7-9 · Búsqueda de personas por nombre (§11, base de §12.1).
 *
 * «Quispe, Ana», «ana quispe» y «Ána Quíspe» encuentran a la misma persona;
 * una sola letra no lista a nadie y el texto del usuario nunca se interpola.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  condicionDeNombre, MIN_LETRAS_NOMBRE, nombreNormalizadoSql, normalizarNombre, palabrasDeNombre,
} from '../../src/common/busqueda-nombre';

describe('V7-9 · palabras de un nombre', () => {
  it('quita tildes, mayúsculas, comas y espacios repetidos', () => {
    assert.equal(normalizarNombre('  Núñez,   BÁRBARA  '), 'nunez barbara');
    assert.deepEqual(palabrasDeNombre('Quíspe, Ána'), ['quispe', 'ana']);
  });

  it('el orden no importa: las mismas palabras en otro orden', () => {
    assert.deepEqual([...palabrasDeNombre('Ana Quispe')].sort(), [...palabrasDeNombre('Quispe, Ana')].sort());
  });

  it('el guion separa apellidos compuestos', () => {
    assert.deepEqual(palabrasDeNombre('Pérez-Gómez'), ['perez', 'gomez']);
  });

  it(`con menos de ${MIN_LETRAS_NOMBRE} letras no busca a nadie`, () => {
    assert.deepEqual(palabrasDeNombre('a'), []);
    assert.deepEqual(palabrasDeNombre(' , - '), []);
    assert.deepEqual(palabrasDeNombre(undefined), []);
    assert.deepEqual(palabrasDeNombre('al'), ['al']);
  });

  it('comodines y comillas no llegan a la consulta', () => {
    assert.deepEqual(palabrasDeNombre("%_' OR 1=1 --"), ['or', '1']);
  });

  it('acota palabras repetidas, cantidad y largo', () => {
    assert.deepEqual(palabrasDeNombre('ana ana ANA'), ['ana']);
    assert.equal(palabrasDeNombre('a b c d e f g h').length, 5);
    assert.equal(palabrasDeNombre('x'.repeat(90))[0].length, 40);
  });
});

describe('V7-9 · condición SQL', () => {
  it('una condición LIKE por palabra, con parámetros y sin el texto del usuario', () => {
    const c = condicionDeNombre('u', ['quispe', 'ana'], 'r');
    assert.match(c.sql, /LIKE :r0 AND .* LIKE :r1/);
    assert.deepEqual(c.params, { r0: '%quispe%', r1: '%ana%' });
    assert.ok(!c.sql.includes('quispe'));
  });

  it('sin palabras no restringe (quien llama ya devolvió vacío)', () => {
    assert.equal(condicionDeNombre('u', []).sql, 'TRUE');
  });

  it('las tablas de tildes de translate() están alineadas', () => {
    const sql = nombreNormalizadoSql('u');
    const [, con, sin] = /'([^']+)', '([^']+)'\)\)$/.exec(sql) ?? [];
    assert.equal([...con].length, [...sin].length);
    for (let i = 0; i < [...con].length; i++) {
      assert.equal(normalizarNombre([...con][i]), [...sin][i].toLowerCase(), `posición ${i}`);
    }
  });
});
