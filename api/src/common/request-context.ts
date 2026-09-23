import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Cabecera por la que entra o sale el identificador de la petición. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Petición con su identificador ya asignado.
 *
 * Se guarda en el objeto de la petición y no en un almacenamiento por contexto
 * porque todo lo que lo necesita —el registro y el filtro de errores— lo recibe
 * como argumento. Un `AsyncLocalStorage` resolvería lo mismo pagando una capa
 * de indirección que aquí no hace falta.
 */
export interface RequestConId extends Request {
  requestId?: string;
}

/**
 * Asigna un identificador a cada petición (§102).
 *
 * §102 pide `request_id` en el registro. Sin él, los mensajes de una petición
 * que falló quedan mezclados con los de otras treinta y no hay forma de
 * reconstruir qué pasó.
 *
 * Si el cliente —o un proxy— ya envió uno, se respeta: así una traza atraviesa
 * varios servicios sin romperse. Se acota a 64 caracteres y a un alfabeto
 * seguro porque ese valor acaba en los registros, y un identificador con saltos
 * de línea permitiría inyectar líneas falsas en ellos.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestConId, res: Response, next: NextFunction): void {
    const entrante = req.headers[REQUEST_ID_HEADER];
    const propuesto = Array.isArray(entrante) ? entrante[0] : entrante;

    const id = this.sanear(propuesto) ?? randomUUID();
    req.requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }

  private sanear(valor: string | undefined): string | null {
    if (!valor) return null;
    const limpio = valor.trim().slice(0, 64);
    return /^[A-Za-z0-9._:-]+$/.test(limpio) ? limpio : null;
  }
}
