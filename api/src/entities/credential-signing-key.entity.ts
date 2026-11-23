import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Claves públicas con las que Afinia firmó alguna vez (V8).
 *
 * Solo la parte pública: la privada vive en la variable de entorno o se
 * deriva al iniciar, nunca en la base. Una clave retirada sigue aquí para
 * que lo que firmó se pueda seguir verificando.
 */
@Entity('credential_signing_keys')
export class CredentialSigningKey {
  /** `key-` + 16 caracteres de la huella SHA-256 de la clave pública. */
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ type: 'varchar', length: 20, default: 'Ed25519' })
  algorithm: 'Ed25519';

  @Column({ name: 'public_key_multibase', type: 'varchar', length: 80 })
  publicKeyMultibase: string;

  /** `configured` (CREDENTIALS_SIGNING_KEY) o `derived` (HKDF del secreto). */
  @Column({ type: 'varchar', length: 20 })
  origin: 'configured' | 'derived';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
