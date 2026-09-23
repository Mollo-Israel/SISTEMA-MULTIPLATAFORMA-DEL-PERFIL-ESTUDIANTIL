import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Lo que §65 sugiere si nadie configura otra cosa. */
const POR_DEFECTO = 5;

/** Una fila cuyo grupo era demasiado pequeño para describirlo. */
export interface FilaProtegida {
  suppressed: true;
  reason: string;
}

/**
 * Umbral de privacidad en analítica (§65).
 *
 * §65 pide un umbral configurable para grupos pequeños. La razón no es
 * burocrática: una analítica agregada deja de ser agregada cuando el grupo es
 * diminuto. «El 100 % de los estudiantes de octavo semestre tiene afinidad baja
 * con Redes» es una estadística si son cuarenta y es una ficha personal si son
 * dos, y quien la lee sabe perfectamente de quién habla.
 *
 * Por eso lo que se suprime es la **distribución**, no la existencia del grupo:
 * la dirección necesita saber que octavo semestre tiene dos estudiantes —eso es
 * gestión—, pero no cómo se reparten sus afinidades.
 *
 * El umbral no protege de quien ya tiene acceso individual legítimo: un docente
 * puede ver el perfil de sus estudiantes uno por uno, y eso lo gobierna el
 * alcance académico (§68), no esto. Protege de deducir a una persona a partir
 * de un número que se presentó como colectivo.
 */
@Injectable()
export class AnalyticsPrivacyService {
  private readonly logger = new Logger(AnalyticsPrivacyService.name);

  constructor(private readonly config: ConfigService) {}

  /** Tamaño mínimo de grupo para publicar su desglose (§65). */
  get minGroupSize(): number {
    const crudo = Number(this.config.get<string>('ANALYTICS_MIN_GROUP_SIZE'));
    if (!Number.isFinite(crudo) || crudo < 1) return POR_DEFECTO;
    return Math.floor(crudo);
  }

  /** ¿Este grupo es demasiado pequeño para describirlo? */
  isSmall(tamano: number): boolean {
    return tamano < this.minGroupSize;
  }

  /**
   * Suprime el desglose de los grupos pequeños, conservando lo que los
   * identifica como grupo.
   *
   * `conservar` son las claves que sobreviven —normalmente la etiqueta y el
   * tamaño—. Todo lo demás desaparece y la fila queda marcada, para que la
   * pantalla pueda decir por qué falta en vez de mostrar un hueco.
   */
  protect<T extends Record<string, unknown>>(
    filas: T[],
    tamanoDe: (fila: T) => number,
    conservar: (keyof T)[],
  ): (T | (Partial<T> & FilaProtegida))[] {
    return filas.map((fila) => {
      const tamano = tamanoDe(fila);
      if (!this.isSmall(tamano)) return fila;

      const reducida: Partial<T> = {};
      conservar.forEach((clave) => {
        reducida[clave] = fila[clave];
      });
      return {
        ...reducida,
        suppressed: true as const,
        reason:
          `Grupo de ${tamano} ${tamano === 1 ? 'estudiante' : 'estudiantes'}: `
          + `por debajo del mínimo de ${this.minGroupSize}, el detalle no se publica.`,
      };
    });
  }

  /**
   * Nota que acompaña a todo reporte agregado.
   *
   * Va en la respuesta y no solo en la documentación porque quien lee un
   * número necesita saber en el mismo sitio qué no significa. §63 y §64
   * prohíben el lenguaje predictivo: esto es la mitad visible de esa regla.
   */
  get notice() {
    return {
      minGroupSize: this.minGroupSize,
      privacy:
        `Los grupos de menos de ${this.minGroupSize} estudiantes no se desglosan: `
        + 'con tan pocos, un agregado deja de serlo.',
      scope:
        'Indicadores descriptivos de lo registrado en la plataforma. No miden '
        + 'rendimiento académico, no predicen resultados y no sirven para decisiones '
        + 'académicas formales.',
    };
  }
}
