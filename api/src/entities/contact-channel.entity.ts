import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ContactChannelType } from '@perfil/shared';
import { StudentProfile } from './student-profile.entity';
import { Contact } from './collaboration.entity';

/**
 * Un canal de contacto que el estudiante decidió compartir (V2 §59).
 *
 * Lo ven sus contactos aceptados. En el perfil público aparece solo si marcó
 * `isPublic`: el correo institucional nunca se expone por omisión.
 */
@Entity('student_contact_channels')
@Unique('uq_contact_channel', ['studentProfileId', 'channel'])
export class StudentContactChannel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'student_profile_id', type: 'uuid' })
  studentProfileId: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_profile_id' })
  studentProfile: StudentProfile;

  @Column({ type: 'varchar', length: 20 })
  channel: ContactChannelType;

  @Column({ type: 'varchar', length: 300 })
  value: string;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * Lo que cada uno anota de un contacto (V2 §56): alias, contexto y canal
 * preferido. Es personal: A y B tienen cada uno su nota sobre el otro.
 */
@Entity('contact_notes')
@Unique('uq_contact_note_owner', ['contactId', 'ownerProfileId'])
export class ContactNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contact_id', type: 'uuid' })
  contactId: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @Column({ name: 'owner_profile_id', type: 'uuid' })
  ownerProfileId: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_profile_id' })
  owner: StudentProfile;

  @Column({ type: 'varchar', length: 60, nullable: true })
  alias: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  context: string | null;

  @Column({ name: 'preferred_channel', type: 'varchar', length: 20, nullable: true })
  preferredChannel: ContactChannelType | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
