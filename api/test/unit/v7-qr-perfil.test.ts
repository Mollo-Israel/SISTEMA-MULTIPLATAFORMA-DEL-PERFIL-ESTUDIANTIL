/**
 * V7.1 BATCH V7-10 · El móvil solo acepta QR de perfiles de Afinia (T04, T05).
 *
 * La regla vive en mobile/src/qrPerfil.ts (sin dependencias de React Native) y
 * debe coincidir con el identificador que genera la API.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_SLUG_ALPHABET, PUBLIC_SLUG_LENGTH } from '@perfil/shared';
import {
  ALFABETO_IDENTIFICADOR, LARGO_IDENTIFICADOR, leerQrDePerfil, servidorDe,
} from '../../../mobile/src/qrPerfil';

const PROPIO = 'https://afinia.univalle.edu/p/bcdfghjkmnpq';

describe('V7-10 · QR de perfil en el móvil', () => {
  it('usa el mismo identificador que la API', () => {
    assert.equal(ALFABETO_IDENTIFICADOR, PUBLIC_SLUG_ALPHABET);
    assert.equal(LARGO_IDENTIFICADOR, PUBLIC_SLUG_LENGTH);
  });

  it('acepta el enlace de un perfil del mismo servidor', () => {
    assert.deepEqual(leerQrDePerfil('https://afinia.univalle.edu/p/23456789bcdf', PROPIO), { tipo: 'perfil', slug: '23456789bcdf' });
    assert.deepEqual(leerQrDePerfil('  HTTPS://Afinia.Univalle.edu/p/23456789bcdf/ ', PROPIO), { tipo: 'perfil', slug: '23456789bcdf' });
  });

  it('en desarrollo, el servidor incluye el puerto', () => {
    assert.equal(servidorDe('http://localhost:5173/p/x'), 'localhost:5173');
    assert.equal(leerQrDePerfil('http://localhost:5173/p/23456789bcdf', 'http://localhost:5173/p/bcdfghjkmnpq').tipo, 'perfil');
    assert.equal(leerQrDePerfil('http://localhost:9999/p/23456789bcdf', 'http://localhost:5173/p/bcdfghjkmnpq').tipo, 'descartado');
  });

  it('descarta otros sitios, imitaciones y esquemas peligrosos', () => {
    for (const qr of [
      'https://afinia.univalle.edu.malo.com/p/23456789bcdf',
      'https://afinia.univalle.edu@malo.com/p/23456789bcdf',
      'https://usuario:clave@afinia.univalle.edu/p/23456789bcdf',
      'javascript:alert(1)',
      'intent://afinia.univalle.edu/p/23456789bcdf',
      'https://afinia.univalle.edu/p/23456789bcdf?redirigir=https://malo.com',
      'https://afinia.univalle.edu/p/23456789bcdf#x',
      'https://afinia.univalle.edu/proyecto/23456789bcdf',
      'WIFI:S:red;T:WPA;P:clave;;',
      '',
      'x'.repeat(400),
    ]) {
      assert.equal(leerQrDePerfil(qr, PROPIO).tipo, 'descartado', qr);
    }
  });

  it('descarta identificadores mal formados con un mensaje propio', () => {
    const r = leerQrDePerfil('https://afinia.univalle.edu/p/ABC', PROPIO);
    assert.equal(r.tipo, 'descartado');
    assert.match((r as { mensaje: string }).mensaje, /identificador de perfil válido/);
    assert.equal(leerQrDePerfil('https://afinia.univalle.edu/p/0000000000aa', PROPIO).tipo, 'descartado');
  });

  it('sin el enlace propio no se puede saber cuál es Afinia: no se acepta nada', () => {
    assert.equal(leerQrDePerfil('https://afinia.univalle.edu/p/23456789bcdf', null).tipo, 'descartado');
  });
});
