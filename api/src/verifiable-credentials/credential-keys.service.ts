import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { KeyObject } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { CredentialSigningKey } from '../entities/credential-signing-key.entity';
import { resolveJwtSecret } from '../config/security.config';
import { CredentialLedgerService } from './credential-ledger.service';
import { Ed25519KeyPair, deriveSeed, ed25519FromSeed, ed25519PublicFromRaw, fromMultikey, keyIdOf, parseSeed, toMultikey } from './crypto/keys';

export interface ActiveSigner {
  kid: string;
  pair: Ed25519KeyPair;
  multikey: string;
  origin: 'configured' | 'derived';
}

/**
 * Claves de firma de Afinia (V8).
 *
 * La clave privada nunca toca la base ni los registros: se lee de
 * `CREDENTIALS_SIGNING_KEY` o, si falta, se deriva del secreto JWT con HKDF.
 * Al iniciar, su clave pública se registra (y queda en la bitácora). Las
 * claves anteriores no se borran: lo que firmaron se sigue verificando.
 */
@Injectable()
export class CredentialKeysService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CredentialKeysService.name);
  private signer: ActiveSigner | null = null;
  private readonly cache = new Map<string, KeyObject>();

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(CredentialSigningKey) private readonly keys: Repository<CredentialSigningKey>,
    private readonly ledger: CredentialLedgerService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureSigner();
    } catch (e) {
      // Sin clave no se emite, pero la API arranca: lo demás no depende de esto.
      this.logger.error(`No se pudo preparar la clave de firma de credenciales: ${(e as Error).message}`);
    }
  }

  /** La clave activa, registrada en la base. */
  async ensureSigner(): Promise<ActiveSigner> {
    if (this.signer) return this.signer;
    const configurada = this.config.get<string>('CREDENTIALS_SIGNING_KEY')?.trim();
    let origin: ActiveSigner['origin'];
    let pair: Ed25519KeyPair;
    if (configurada) {
      pair = ed25519FromSeed(parseSeed(configurada));
      origin = 'configured';
    } else {
      pair = ed25519FromSeed(deriveSeed(resolveJwtSecret(this.config), 'ed25519-signing-key-v1'));
      origin = 'derived';
      const msg = 'CREDENTIALS_SIGNING_KEY sin configurar: la clave de firma se deriva del secreto JWT. '
        + 'Si ese secreto cambia, lo ya firmado se sigue verificando, pero conviene una clave propia.';
      if ((this.config.get<string>('NODE_ENV') ?? 'development') === 'production') this.logger.warn(msg);
      else this.logger.debug(msg);
    }
    const kid = keyIdOf(pair.publicRaw);
    const multikey = toMultikey(pair.publicRaw);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CredentialSigningKey);
      // Candado: dos instancias que arrancan a la vez no registran la clave dos veces.
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext('afinia:credential-keys')::bigint)`);
      const existente = await repo.findOne({ where: { id: kid } });
      if (existente) {
        if (existente.publicKeyMultibase !== multikey) {
          throw new Error(`La clave ${kid} ya existe con otro material: posible colisión o manipulación.`);
        }
        return;
      }
      await repo.save(repo.create({ id: kid, algorithm: 'Ed25519', publicKeyMultibase: multikey, origin }));
      await this.ledger.append(manager, {
        event: 'KEY_REGISTERED',
        data: { kid, algorithm: 'Ed25519', publicKeyMultibase: multikey, origin },
      });
      this.logger.log(`Clave de firma de credenciales registrada: ${kid} (${origin}).`);
    });

    this.signer = { kid, pair, multikey, origin };
    this.cache.set(kid, pair.publicKey);
    return this.signer;
  }

  /** Clave pública de un `kid` propio, o `null` si Afinia nunca firmó con ella. */
  async publicKey(kid: string): Promise<KeyObject | null> {
    const enCache = this.cache.get(kid);
    if (enCache) return enCache;
    if (!/^key-[A-Za-z0-9_-]{16}$/.test(kid)) return null;
    const fila = await this.keys.findOne({ where: { id: kid } });
    if (!fila) return null;
    const raw = fromMultikey(fila.publicKeyMultibase);
    // La huella del material tiene que coincidir con su identificador.
    if (keyIdOf(raw) !== kid) return null;
    const key = ed25519PublicFromRaw(raw);
    this.cache.set(kid, key);
    return key;
  }

  listPublic(): Promise<CredentialSigningKey[]> {
    return this.keys.find({ order: { createdAt: 'ASC' } });
  }
}
