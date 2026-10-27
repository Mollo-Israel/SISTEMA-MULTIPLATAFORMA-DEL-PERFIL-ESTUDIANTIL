/**
 * V5 §6: reglas puras de inscripción, admisión y asistencia, con el reloj fijado.
 */
import { ActivityOrigin, RegistrationMode, RegistrationStatus } from '@perfil/shared';
import {
  admisionAutomatica,
  admitidoParaAsistencia,
  bloqueoAsistencia,
  inicioYaPaso,
  yaEmpezo,
} from '../../../src/activities/registration.rules';

const AHORA = new Date('2026-10-27T18:33:23.000Z');
const min = (m: number) => new Date(AHORA.getTime() + m * 60_000);
const dias = (d: number) => new Date(AHORA.getTime() + d * 86_400_000);

const interna = (extra: Partial<Parameters<typeof admisionAutomatica>[0]> = {}) => ({
  originType: ActivityOrigin.INTERNAL,
  registrationMode: RegistrationMode.OPEN,
  capacity: null,
  eventDate: min(-30),
  endAt: min(60),
  attendanceStatus: 'open',
  ...extra,
});

describe('V5 §6.1 · admisión automática', () => {
  it('una interna abierta y sin cupo admite sola (C06)', () => {
    expect(admisionAutomatica(interna())).toBe(true);
  });
  it('con cupo decide el responsable, aunque sea abierta', () => {
    expect(admisionAutomatica(interna({ capacity: 20 }))).toBe(false);
  });
  it('en modo por aprobación decide el responsable', () => {
    expect(admisionAutomatica(interna({ registrationMode: RegistrationMode.APPROVAL }))).toBe(false);
  });
  it('en una externa la aceptación es del proveedor: nunca automática', () => {
    expect(admisionAutomatica(interna({ originType: ActivityOrigin.EXTERNAL }))).toBe(false);
  });
});

describe('V5 §5.5 · «ya empezó» se compara al minuto con tolerancia', () => {
  it('el mismo minuto cuenta como empezado aunque pasaron 23 s (B04)', () => {
    expect(yaEmpezo(new Date('2026-10-27T18:33:00.000Z'), AHORA, 0)).toBe(true);
  });
  it('dentro de la tolerancia (2 min) cuenta como empezado', () => {
    expect(yaEmpezo(min(2), AHORA, 2)).toBe(true);
  });
  it('fuera de la tolerancia todavía no empezó', () => {
    expect(yaEmpezo(min(3), AHORA, 2)).toBe(false);
  });
  it('sin fecha no empezó', () => {
    expect(yaEmpezo(null, AHORA, 2)).toBe(false);
  });
});

describe('V5 §5.5 · publicar con inicio «ahora» (B04, B05)', () => {
  it('B04: hora local 18:33 y selector 18:33 (pasaron 23 s) → se puede publicar', () => {
    expect(inicioYaPaso(new Date('2026-10-27T18:33:00.000Z'), AHORA, 2)).toBe(false);
  });
  it('dentro de la tolerancia (hace 2 min) todavía se puede', () => {
    expect(inicioYaPaso(min(-2), AHORA, 2)).toBe(false);
  });
  it('fuera de la tolerancia (hace 3 min) ya no', () => {
    expect(inicioYaPaso(min(-3), AHORA, 2)).toBe(true);
  });
  it('B05: a las 23:59, un evento de las 08:00 no se publica como futuro', () => {
    const noche = new Date('2026-10-27T23:59:30.000Z');
    expect(inicioYaPaso(new Date('2026-10-27T08:00:00.000Z'), noche, 2)).toBe(true);
  });
});

describe('V5 §6 / ND-06 · cuándo se registra la asistencia', () => {
  it('no antes de que empiece el evento (C03)', () => {
    const b = bloqueoAsistencia(interna({ eventDate: dias(2), endAt: dias(2) }), AHORA, 2, 7);
    expect(b?.code).toBe('ATTENDANCE_BEFORE_START');
  });
  it('sí durante el evento', () => {
    expect(bloqueoAsistencia(interna(), AHORA, 2, 7)).toBeNull();
  });
  it('sí dentro de la ventana de regularización después del fin (C07)', () => {
    expect(bloqueoAsistencia(interna({ eventDate: dias(-6), endAt: dias(-6) }), AHORA, 2, 7)).toBeNull();
  });
  it('vencida la ventana, la corrige Dirección (C07)', () => {
    const b = bloqueoAsistencia(interna({ eventDate: dias(-9), endAt: dias(-8) }), AHORA, 2, 7);
    expect(b?.code).toBe('ATTENDANCE_WINDOW_CLOSED');
  });
  it('con el acta cerrada, nunca por la vía ordinaria', () => {
    expect(bloqueoAsistencia(interna({ attendanceStatus: 'locked' }), AHORA, 2, 7)?.code).toBe('ATTENDANCE_LOCKED');
  });
});

describe('V5 §6 · la asistencia exige admisión', () => {
  it('una solicitud pendiente con cupo no tiene asistencia hasta que la admitan', () => {
    expect(admitidoParaAsistencia(interna({ capacity: 10 }), RegistrationStatus.REGISTERED)).toBe(false);
  });
  it('una solicitud anterior a V5 en una abierta sin cupo cuenta como admitida', () => {
    expect(admitidoParaAsistencia(interna(), RegistrationStatus.REGISTERED)).toBe(true);
  });
  it('admitido sí', () => {
    expect(admitidoParaAsistencia(interna({ capacity: 10 }), RegistrationStatus.ACCEPTED)).toBe(true);
  });
  it('no admitido, interesado o dado de baja, no (C08)', () => {
    for (const s of [RegistrationStatus.REJECTED, RegistrationStatus.INTERESTED, RegistrationStatus.CANCELLED]) {
      expect(admitidoParaAsistencia(interna(), s)).toBe(false);
    }
  });
});
