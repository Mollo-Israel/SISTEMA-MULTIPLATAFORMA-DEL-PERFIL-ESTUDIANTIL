import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { REQUEST_ID_HEADER, RequestConId } from './request-context';

/** Código estable por estado, para que el cliente no tenga que leer el texto. */
const CODIGO_POR_ESTADO: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

/**
 * Respuesta de error, con la forma que fija §103.
 *
 * `code`, `message`, `details` opcional y `requestId` opcional. La forma es la
 * misma para los cuatrocientos y para los quinientos: un cliente que tiene que
 * distinguir dos formatos según el estado acaba tratando mal uno de los dos.
 */
export interface RespuestaDeError {
  code: string;
  message: string;
  details?: unknown;
  /** Mensajes agrupados por campo del formulario. */
  fields?: Record<string, string[]>;
  /** Segundos de espera, cuando el error es «demasiado pronto». */
  retryAfterSeconds?: number;
  requestId?: string;
}

function esMapaDeCampos(valor: unknown): valor is Record<string, string[]> {
  return (
    typeof valor === 'object'
    && valor !== null
    && !Array.isArray(valor)
    && Object.values(valor).every((v) => Array.isArray(v) && v.every((m) => typeof m === 'string'))
  );
}

/**
 * Formato de error consistente (§103) y registro sin secretos (§102).
 *
 * §103 pide una forma única y **no exponer trazas en producción**. Eso último
 * no es cosmético: una traza revela rutas del sistema de archivos, versiones de
 * dependencias y, cuando el error viene de la base, fragmentos de la consulta
 * con los valores dentro.
 *
 * Por eso un error no controlado se responde con un mensaje genérico y su
 * `requestId`: quien lo reporta da ese identificador y el registro del servidor
 * tiene el detalle completo. El usuario obtiene lo justo para pedir ayuda, y
 * nadie obtiene un mapa del sistema.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  constructor(private readonly config: ConfigService) {}

  private get esProduccion(): boolean {
    return (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestConId>();
    const requestId = req?.requestId ?? (res.getHeader(REQUEST_ID_HEADER) as string | undefined);

    const { status, cuerpo, paraRegistro } = this.traducir(exception, requestId);

    // §102: se registra la ruta, el estado y el código; nunca el cuerpo de la
    // petición, que es donde viajan las contraseñas y los tokens.
    const linea =
      `${req?.method ?? '?'} ${req?.originalUrl ?? '?'} ${status} `
      + `code=${cuerpo.code} request_id=${requestId ?? '-'}`;

    if (status >= 500) {
      this.logger.error(linea, paraRegistro);
    } else if (status !== 404) {
      this.logger.warn(linea);
    }

    res.status(status).json(cuerpo);
  }

  private traducir(
    exception: unknown,
    requestId: string | undefined,
  ): { status: number; cuerpo: RespuestaDeError; paraRegistro?: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const respuesta = exception.getResponse();

      // El ValidationPipe devuelve `{ message: string[] }`: ese arreglo es el
      // `details` de §103, y el mensaje principal se queda legible.
      if (typeof respuesta === 'object' && respuesta !== null) {
        const objeto = respuesta as Record<string, unknown>;
        const mensajes = objeto.message;
        // Errores por campo: el formulario los coloca debajo de cada casilla.
        const fields = esMapaDeCampos(objeto.fields) ? objeto.fields : undefined;
        const retryAfterSeconds =
          typeof objeto.retryAfterSeconds === 'number' ? objeto.retryAfterSeconds : undefined;
        if (Array.isArray(mensajes)) {
          return {
            status,
            cuerpo: {
              code: CODIGO_POR_ESTADO[status] ?? 'VALIDATION_ERROR',
              message:
                mensajes.length === 1
                  ? String(mensajes[0])
                  : 'Revisa los campos marcados: hay datos que no son válidos.',
              details: mensajes,
              ...(fields ? { fields } : {}),
              requestId,
            },
          };
        }
        return {
          status,
          cuerpo: {
            code: String(objeto.code ?? CODIGO_POR_ESTADO[status] ?? 'ERROR'),
            message: String(mensajes ?? exception.message),
            ...(fields ? { fields } : {}),
            // Datos estructurados que construye el propio servicio (p. ej. el
            // área sugerida): nunca una traza ni un error de base.
            ...(objeto.details !== undefined ? { details: objeto.details } : {}),
            ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
            requestId,
          },
        };
      }

      return {
        status,
        cuerpo: {
          code: CODIGO_POR_ESTADO[status] ?? 'ERROR',
          message: String(respuesta ?? exception.message),
          requestId,
        },
      };
    }

    /*
     * Un fallo de la base nunca llega tal cual al cliente. El mensaje de
     * PostgreSQL suele incluir el nombre de la restricción, el de la tabla y a
     * veces los valores que chocaron: es un plano de la base servido a quien
     * mandó la petición.
     */
    if (exception instanceof QueryFailedError) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        cuerpo: {
          code: 'INTERNAL_ERROR',
          message: 'No se pudo completar la operación. Vuelva a intentarlo.',
          requestId,
        },
        paraRegistro: `${exception.message}\n${exception.stack ?? ''}`,
      };
    }

    /*
     * Express lanza sus propios errores —el del limite de cuerpo, entre
     * otros— con un `status` numerico pero sin ser `HttpException`. Sin esto,
     * un cuerpo demasiado grande se responderia como un 500, que le dice al
     * cliente «fallo el servidor» cuando en realidad fallo su peticion.
     */
    const conEstado = exception as { status?: unknown; statusCode?: unknown; message?: unknown };
    const estadoExpress = Number(conEstado?.status ?? conEstado?.statusCode);
    if (Number.isInteger(estadoExpress) && estadoExpress >= 400 && estadoExpress < 500) {
      return {
        status: estadoExpress,
        cuerpo: {
          code: CODIGO_POR_ESTADO[estadoExpress] ?? 'BAD_REQUEST',
          message:
            estadoExpress === HttpStatus.PAYLOAD_TOO_LARGE
              ? 'El contenido enviado es demasiado grande.'
              : 'La petición no pudo procesarse.',
          requestId,
        },
      };
    }

    const error = exception instanceof Error ? exception : null;
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      cuerpo: {
        code: 'INTERNAL_ERROR',
        message: this.esProduccion
          ? 'Ocurrió un error inesperado. Si vuelve a pasar, informe este identificador.'
          : (error?.message ?? 'Error inesperado.'),
        requestId,
      },
      paraRegistro: error?.stack ?? String(exception),
    };
  }
}
