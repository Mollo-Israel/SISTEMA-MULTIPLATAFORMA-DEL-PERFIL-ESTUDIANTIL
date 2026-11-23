import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Política de emisión de registros verificables (V5 ND-01, V8).
 *
 * V5 §1.2 dejó a Afinia sin emitir documentos con apariencia oficial
 * «mientras Dirección no defina su política». Esta tabla es esa política:
 * cada decisión de Dirección es una fila nueva, con su justificación, y la
 * vigente es la última. Sin filas, la emisión está apagada.
 */
@Entity('credential_issuance_policies')
export class CredentialIssuancePolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'boolean' })
  enabled: boolean;

  @Column({ type: 'varchar', length: 500 })
  justification: string;

  @Column({ name: 'decided_by', type: 'uuid' })
  decidedBy: string;

  @Column({ name: 'decided_at', type: 'timestamptz', default: () => 'now()' })
  decidedAt: Date;
}
