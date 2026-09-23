import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * Frases con las que `class-validator` redacta sus mensajes por omisión.
 *
 * Detectar el idioma por estas marcas es más fiable que intentar adivinar si un
 * mensaje es nuestro: ninguna de ellas aparece en un texto escrito en español, y
 * todas aparecen en los que la librería genera sola.
 */
const MARCAS_INGLESAS = [
  ' must be ',
  ' should not ',
  ' must not ',
  ' must contain ',
  ' must match ',
  ' must have ',
  'each value in ',
];

/**
 * Traducción de las restricciones que se dejan sin mensaje.
 *
 * La mayoría son comprobaciones de tipo: en un DTO se escribe el mensaje de lo
 * que el usuario puede equivocarse —un correo mal puesto, un texto demasiado
 * largo— y no el de «esto debía ser una cadena», que solo ocurre cuando alguien
 * manda algo raro a mano.
 */
const TRADUCCION: Record<string, (campo: string) => string> = {
  isString: (c) => `«${c}» debe ser texto.`,
  isBoolean: (c) => `«${c}» debe ser verdadero o falso.`,
  isInt: (c) => `«${c}» debe ser un número entero.`,
  isNumber: (c) => `«${c}» debe ser un número.`,
  isArray: (c) => `«${c}» debe ser una lista.`,
  isEnum: (c) => `«${c}» tiene un valor que no está permitido.`,
  isUuid: (c) => `«${c}» debe ser un identificador válido.`,
  isDateString: (c) => `«${c}» debe ser una fecha válida.`,
  isIso8601: (c) => `«${c}» debe ser una fecha válida.`,
  isNotEmpty: (c) => `«${c}» es obligatorio.`,
  isEmail: (c) => `«${c}» debe ser un correo electrónico válido.`,
  isUrl: (c) => `«${c}» debe ser un enlace http o https válido.`,
  isObject: (c) => `«${c}» debe ser un objeto.`,
  arrayUnique: (c) => `«${c}» no puede repetir valores.`,
  arrayMaxSize: (c) => `«${c}» tiene demasiados elementos.`,
  arrayMinSize: (c) => `«${c}» necesita más elementos.`,
  maxLength: (c) => `«${c}» es demasiado largo.`,
  minLength: (c) => `«${c}» es demasiado corto.`,
  max: (c) => `«${c}» supera el valor máximo permitido.`,
  min: (c) => `«${c}» está por debajo del valor mínimo permitido.`,
  matches: (c) => `«${c}» no tiene el formato esperado.`,
  whitelistValidation: (c) => `«${c}» no es un campo admitido.`,
};

/**
 * Convierte los errores de validación en mensajes en español.
 *
 * Se hace en un solo sitio y no decorador por decorador. Poner un mensaje en
 * cada `@IsString()` de cada DTO serían doscientas ediciones que además hay que
 * repetir en cada DTO nuevo; basta olvidarse una vez para que al usuario le
 * llegue «password must be a string», que es justo lo que pasaba.
 *
 * Un mensaje escrito a mano en el DTO gana siempre: aquí solo se traduce lo que
 * la librería redactó sola.
 */
export function mensajesDeValidacion(errores: ValidationError[]): BadRequestException {
  return new BadRequestException(recolectar(errores));
}

function recolectar(errores: ValidationError[], prefijo = ''): string[] {
  const salida: string[] = [];

  for (const error of errores) {
    const campo = prefijo ? `${prefijo}.${error.property}` : error.property;

    for (const [restriccion, mensaje] of Object.entries(error.constraints ?? {})) {
      salida.push(traducir(restriccion, campo, String(mensaje)));
    }

    // Los DTO anidados llegan con sus propios errores dentro.
    if (error.children?.length) {
      salida.push(...recolectar(error.children, campo));
    }
  }

  return salida;
}

function traducir(restriccion: string, campo: string, mensaje: string): string {
  const esDeLaLibreria = MARCAS_INGLESAS.some((marca) => mensaje.includes(marca));
  if (!esDeLaLibreria) return mensaje;

  const traduccion = TRADUCCION[restriccion];
  if (traduccion) return traduccion(campo);

  // Una restricción que no está en la tabla: mejor una frase genérica en
  // español que el texto en inglés. Que aparezca es la señal de que falta una
  // entrada arriba.
  return `«${campo}» no es válido.`;
}
