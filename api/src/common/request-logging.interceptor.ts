import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { RequestConId } from './request-context';

/** Rutas que no se registran: su ruido tapa lo que importa. */
const SILENCIOSAS = ['/api/health'];

/**
 * Registro estructurado de peticiones (§102).
 *
 * §102 pide exactamente estos campos: `request_id`, `user_id` cuando
 * corresponda, `route`, `status`, `duration` y `error_code`. Se registran esos
 * y **nada más**.
 *
 * Lo que la misma sección prohíbe —JWT completos, contraseñas, tokens de
 * activación, tokens de refresco, binarios— no se cumple filtrando: no se toca
 * el cuerpo de la petición ni las cabeceras en ningún punto de este archivo. Un
 * filtro de secretos hay que mantenerlo al día cada vez que aparece un campo
 * nuevo, y basta olvidarse una vez para que una contraseña acabe en un archivo
 * de registro que se rota a saber dónde.
 *
 * El `user_id` sí se registra: identifica a quien hizo la petición, que es
 * justo lo que §70 necesita para auditar, y no es un secreto — es el mismo
 * identificador que viaja en cada respuesta.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Request');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<RequestConId & { user?: { userId?: string } }>();
    const res = http.getResponse<Response>();

    if (SILENCIOSAS.some((ruta) => req.originalUrl?.startsWith(ruta))) {
      return next.handle();
    }

    const inicio = Date.now();
    const registrar = (estado: number, codigo?: string) => {
      const partes = [
        `request_id=${req.requestId ?? '-'}`,
        `user_id=${req.user?.userId ?? '-'}`,
        `route=${req.method} ${req.route?.path ?? req.originalUrl ?? '-'}`,
        `status=${estado}`,
        `duration=${Date.now() - inicio}ms`,
      ];
      if (codigo) partes.push(`error_code=${codigo}`);
      this.logger.log(partes.join(' '));
    };

    return next.handle().pipe(
      tap({
        next: () => registrar(res.statusCode),
        // El código del error lo pone el filtro; aquí basta con el estado, que
        // es lo que §102 pide. Duplicar la traducción sería otra copia de la
        // misma tabla, y las dos copias acabarían divergiendo.
        error: (e) => registrar(Number(e?.status ?? e?.statusCode ?? 500), e?.name),
      }),
    );
  }
}
