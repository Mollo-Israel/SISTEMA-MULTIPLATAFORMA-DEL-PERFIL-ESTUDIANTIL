/**
 * Hechos del sistema que un criterio de gamificacion puede premiar.
 * Se define en el 40% para permitir la administracion persistente del criterio;
 * el motor que los consume pertenece a una fase posterior.
 */
export enum GamificationTrigger {
  PARTICIPACION_CONFIRMADA = 'participacion_confirmada',
  PROYECTO_REGISTRADO = 'proyecto_registrado',
  EVIDENCIA_ADJUNTA = 'evidencia_adjunta',
  CERTIFICADO_EXTERNO = 'certificado_externo',
  CONSTANCIA_INTERNA = 'constancia_interna',
  PERFIL_COMPLETO = 'perfil_completo',
}
