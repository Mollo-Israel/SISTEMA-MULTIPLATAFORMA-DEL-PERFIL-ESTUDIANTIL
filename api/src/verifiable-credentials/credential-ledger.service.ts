import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import { CredentialLedgerEntry, LedgerEvent } from '../entities/credential-ledger-entry.entity';
import { canonicalize } from './crypto/jcs';

/** Hash con el que empieza la cadena: 64 ceros. */
export const GENESIS_HASH = '0'.repeat(64);

/** El hash de una entrada: depende de la anterior, de su número, del evento y de sus datos. */
export function ledgerEntryHash(prevHash: string, seq: string | number, event: string, publicCode: string | null, data: unknown): string {
  return createHash('sha256')
    .update(`${prevHash}|${seq}|${event}|${publicCode ?? ''}|${canonicalize(data)}`, 'utf8')
    .digest('hex');
}

export interface LedgerVerification {
  ok: boolean;
  entries: number;
  head: { seq: string; hash: string; at: string } | null;
  /** Primera entrada rota y por qué; `null` si la cadena está entera. */
  brokenAt: { seq: string; reason: string } | null;
}

/**
 * Bitácora de transparencia encadenada (V8).
 *
 * Funciona como un registro de transparencia: cada entrada sella a la
 * anterior. La cabeza (último hash) se publica sin sesión, de modo que un
 * tercero que la anote hoy puede comprobar mañana que nadie reescribió el
 * pasado. La base, además, impide modificar o borrar entradas.
 */
@Injectable()
export class CredentialLedgerService {
  constructor(@InjectRepository(CredentialLedgerEntry) private readonly entries: Repository<CredentialLedgerEntry>) {}

  /**
   * Agrega una entrada dentro de la transacción de quien llama.
   *
   * El candado de transacción serializa a los que escriben a la vez: dos
   * entradas nunca reclaman el mismo número ni el mismo hash anterior.
   */
  async append(
    manager: EntityManager,
    input: { event: LedgerEvent; publicCode?: string | null; data: Record<string, unknown>; actorUserId?: string | null },
  ): Promise<CredentialLedgerEntry> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext('afinia:credential-ledger')::bigint)`);
    const [ultima] = await manager.query(`SELECT "seq", "entry_hash" FROM "credential_ledger" ORDER BY "seq" DESC LIMIT 1`);
    const seq = ultima ? (BigInt(ultima.seq) + 1n).toString() : '1';
    const prevHash: string = ultima ? ultima.entry_hash : GENESIS_HASH;
    const publicCode = input.publicCode ?? null;
    const entryHash = ledgerEntryHash(prevHash, seq, input.event, publicCode, input.data);
    const repo = manager.getRepository(CredentialLedgerEntry);
    return repo.save(repo.create({
      seq,
      event: input.event,
      publicCode,
      data: input.data,
      prevHash,
      entryHash,
      actorUserId: input.actorUserId ?? null,
    }));
  }

  async head(): Promise<LedgerVerification['head']> {
    const [u] = await this.entries.query(`SELECT "seq", "entry_hash", "created_at" FROM "credential_ledger" ORDER BY "seq" DESC LIMIT 1`);
    return u ? { seq: String(u.seq), hash: u.entry_hash, at: new Date(u.created_at).toISOString() } : null;
  }

  /** Entradas de un código, en orden. */
  forCode(publicCode: string): Promise<CredentialLedgerEntry[]> {
    return this.entries.find({ where: { publicCode }, order: { seq: 'ASC' } });
  }

  /** Comprueba una entrada aislada: su hash y que enlaza con la anterior. */
  async verifyEntry(entry: CredentialLedgerEntry): Promise<boolean> {
    if (ledgerEntryHash(entry.prevHash, entry.seq, entry.event, entry.publicCode, entry.data) !== entry.entryHash) return false;
    if (entry.seq === '1') return entry.prevHash === GENESIS_HASH;
    const anterior = await this.entries.findOne({ where: { seq: (BigInt(entry.seq) - 1n).toString() } });
    return !!anterior && anterior.entryHash === entry.prevHash;
  }

  /**
   * Recorre la cadena entera, por lotes, y devuelve la primera rotura.
   * Detecta un hash recalculado a mano, un hueco en la numeración y un
   * eslabón que no apunta a la entrada anterior.
   */
  async verifyChain(): Promise<LedgerVerification> {
    const LOTE = 1000;
    let prevHash = GENESIS_HASH;
    let esperado = 1n;
    let total = 0;
    let ultima: CredentialLedgerEntry | null = null;
    for (;;) {
      const lote = await this.entries
        .createQueryBuilder('l')
        .where('l.seq >= :desde', { desde: esperado.toString() })
        .orderBy('l.seq', 'ASC')
        .limit(LOTE)
        .getMany();
      if (lote.length === 0) break;
      for (const e of lote) {
        const seq = BigInt(e.seq);
        if (seq !== esperado) {
          return { ok: false, entries: total, head: null, brokenAt: { seq: esperado.toString(), reason: 'Falta una entrada en la numeración.' } };
        }
        if (e.prevHash !== prevHash) {
          return { ok: false, entries: total, head: null, brokenAt: { seq: e.seq, reason: 'La entrada no apunta al hash de la anterior.' } };
        }
        if (ledgerEntryHash(e.prevHash, e.seq, e.event, e.publicCode, e.data) !== e.entryHash) {
          return { ok: false, entries: total, head: null, brokenAt: { seq: e.seq, reason: 'El contenido de la entrada no corresponde a su hash.' } };
        }
        prevHash = e.entryHash;
        esperado += 1n;
        total += 1;
        ultima = e;
      }
      if (lote.length < LOTE) break;
    }
    return {
      ok: true,
      entries: total,
      head: ultima ? { seq: ultima.seq, hash: ultima.entryHash, at: new Date(ultima.createdAt).toISOString() } : null,
      brokenAt: null,
    };
  }
}
