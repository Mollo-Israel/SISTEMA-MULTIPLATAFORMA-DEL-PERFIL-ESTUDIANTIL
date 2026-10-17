import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ActivityModality,
  ActivityOrigin,
  ActivityOutcomePolicy,
  ActivityStatus,
  ActivityType,
  GamificationTrigger,
  RegistrationMode,
} from '@perfil/shared';
import { cleanLine, cleanText, IsPlaceName, trim, trimUniqueArray } from '../../common/validation';

/** Dominio de un emisor: `netacad.com`, `credly.com` (sin esquema ni ruta). */
const DOMINIO_RE = /^(?=.{3,120}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const minusculas = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [...new Set(value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : v)).filter(Boolean))]
    : value;

/** V3.2 §11.4: habilidad y área en la que se trabaja. */
export class SkillContextDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Habilidad no válida.' })
  skillId: string;

  @ApiProperty()
  @IsUUID('4', { message: 'Área no válida.' })
  areaId: string;
}

/** Regla de puntos de la actividad (V2 §31.2): un hecho permitido y sus puntos. */
export class ActivityGamificationRuleDto {
  @ApiProperty({ enum: [GamificationTrigger.PARTICIPACION_CONFIRMADA] })
  @IsEnum(GamificationTrigger, { message: 'El hecho de la regla no es válido.' })
  trigger: GamificationTrigger;

  @ApiProperty({ minimum: 1, example: 15 })
  @Type(() => Number)
  @IsInt({ message: 'Los puntos deben ser un número entero, sin letras ni decimales.' })
  @Min(1, { message: 'Una regla da al menos 1 punto.' })
  points: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4', { message: 'La insignia no es válida.' })
  badgeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300, { message: 'La descripción de la regla no puede superar 300 caracteres.' })
  description?: string;
}

/** V3.2 §18.2: un enlace de apoyo (guía, material, sitio, patrocinador). */
export class ResourceLinkDto {
  @ApiProperty({ example: 'Guía del taller' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'Ponle un nombre al enlace.' })
  @MaxLength(80, { message: 'El nombre del enlace no puede superar 80 caracteres.' })
  label: string;

  @ApiProperty({ example: 'https://univalle.edu/guia.pdf' })
  @Transform(trim)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Cada enlace debe ser una URL https válida.' })
  @MaxLength(500, { message: 'El enlace es demasiado largo.' })
  url: string;
}

export class CreateActivityDto {
  @ApiProperty({ example: 'Taller de NestJS' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres.' })
  @MaxLength(160, { message: 'El título no puede superar 160 caracteres.' })
  // V3.2 §6.4: un título hecho solo de símbolos o números no dice nada.
  @Matches(/\p{L}/u, { message: 'El título no puede contener solo símbolos.' })
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(2000, { message: 'La descripción no puede superar 2000 caracteres.' })
  description?: string;

  @ApiProperty({ enum: ActivityType })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({
    description: 'ID de la categoría del catálogo administrable (RF4).',
    example: '9e3f1c2a-0000-4000-8000-000000000000',
  })
  @IsUUID('4', { message: 'Debe seleccionar una categoría del catálogo.' })
  categoryId: string;

  @ApiProperty({ enum: ActivityModality, required: false, default: ActivityModality.PRESENCIAL })
  @IsOptional()
  @IsEnum(ActivityModality)
  modality?: ActivityModality;

  @ApiProperty({ required: false, example: '2026-06-15T15:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  activityDate?: string;

  @ApiProperty({ required: false, example: 'Aula 301' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(200, { message: 'La ubicación no puede superar 200 caracteres.' })
  @IsPlaceName()
  location?: string;

  @ApiProperty({ required: false, example: 30, minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt({ message: 'El cupo debe ser un número entero.' })
  @Min(1, { message: 'El cupo mínimo es 1.' })
  @Max(1000, { message: 'El cupo máximo es 1000.' })
  capacity?: number;

  @ApiProperty({ required: false, description: 'ID del área académica principal (compatibilidad; preferir areaIds)' })
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  /** V3 §12.1 `areas[]`: una oportunidad puede tocar varias áreas. La primera es la principal. */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6, { message: 'Como máximo 6 áreas.' })
  @ArrayUnique({ message: 'No repitas áreas.' })
  @IsUUID('4', { each: true, message: 'Área no válida.' })
  areaIds?: string[];

  /** V3 §12: interna (la organiza la carrera) o externa (un proveedor). */
  @ApiProperty({ required: false, enum: ActivityOrigin, default: ActivityOrigin.INTERNAL })
  @IsOptional()
  @IsEnum(ActivityOrigin, { message: 'El origen debe ser interno o externo.' })
  originType?: ActivityOrigin;

  /** V3 §14: qué genera al terminar. Sustituye a `internalConstancyEnabled` (que se sigue aceptando). */
  @ApiProperty({ required: false, enum: ActivityOutcomePolicy })
  @IsOptional()
  @IsEnum(ActivityOutcomePolicy, { message: 'Política de resultado no válida.' })
  outcomePolicy?: ActivityOutcomePolicy;

  /** V3 §12.1 · Externa: proveedor (obligatorio si es externa). */
  @ApiProperty({ required: false, example: 'Cisco Networking Academy' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(160, { message: 'El proveedor es demasiado largo.' })
  provider?: string;

  /** V3 §12.1 · Externa: si al terminar se espera una credencial del proveedor. */
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  credentialExpected?: boolean;

  /** V3 §12.1 · Dominios oficiales del emisor (para validar la credencial). */
  @ApiProperty({ required: false, type: [String], example: ['netacad.com', 'credly.com'] })
  @IsOptional()
  @Transform(minusculas)
  @IsArray()
  @ArrayMaxSize(10, { message: 'Como máximo 10 dominios.' })
  @Matches(DOMINIO_RE, { each: true, message: 'Cada dominio debe tener la forma «proveedor.com».' })
  expectedIssuerDomains?: string[];

  /** V3 §12.1 · Palabras que se esperan en la credencial (nombre del curso…). */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @Transform(trimUniqueArray)
  @IsArray()
  @ArrayMaxSize(15, { message: 'Como máximo 15 palabras clave.' })
  @IsString({ each: true })
  @MaxLength(60, { each: true, message: 'Cada palabra clave es demasiado larga.' })
  expectedKeywords?: string[];

  /**
   * V3 §6.5, §12.2: responsable de la oportunidad. Obligatorio cuando la crea
   * Administración —que no es emisor académico—; en los demás casos es quien
   * la crea.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4', { message: 'El responsable no es válido.' })
  responsibleUserId?: string;

  /**
   * V3.2 §16–§17: responsables académicos u operativos (1..N). El primero es
   * el principal. Si no se indican, es quien crea (salvo Administración).
   */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Como máximo 5 responsables.' })
  @ArrayUnique({ message: 'No repitas responsables.' })
  @IsUUID('4', { each: true, message: 'Responsable no válido.' })
  responsibleUserIds?: string[];

  /** V3.2 §16: personas de contacto visibles para el estudiante (0..N). */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Como máximo 5 contactos.' })
  @ArrayUnique({ message: 'No repitas contactos.' })
  @IsUUID('4', { each: true, message: 'Contacto no válido.' })
  contactUserIds?: string[];

  /** V3.2 §18.1–§18.2: enlace de la reunión (virtual o híbrida). `null` lo quita. */
  @ApiProperty({ required: false, nullable: true, example: 'https://meet.google.com/abc-defg-hij' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  @ValidateIf((o: CreateActivityDto) => o.meetingUrl !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'El enlace de la reunión debe ser una URL https válida.' })
  @MaxLength(500, { message: 'El enlace de la reunión es demasiado largo.' })
  meetingUrl?: string | null;

  /** V3.2 §18.2: enlaces de apoyo (0..N). */
  @ApiProperty({ required: false, type: () => [ResourceLinkDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Como máximo 10 enlaces.' })
  @ValidateNested({ each: true })
  @Type(() => ResourceLinkDto)
  resourceLinks?: ResourceLinkDto[];

  /** V3.2 §18.3: imagen ilustrativa (id de un archivo subido). `null` la quita. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((o: CreateActivityDto) => o.imageFileId !== null)
  @IsUUID('4', { message: 'La imagen no es válida.' })
  imageFileId?: string | null;

  /**
   * V4.1 A41-006: hasta cinco imágenes, en orden; la primera es la portada
   * (también queda en `imageFileId`). `[]` las quita todas. Si no se envía,
   * se respeta `imageFileId` como hasta ahora.
   */
  @ApiProperty({ required: false, type: [String], maxItems: 5 })
  @IsOptional()
  @IsArray({ message: 'Las imágenes deben ser una lista.' })
  @ArrayMaxSize(5, { message: 'Puedes agregar hasta 5 imágenes.' })
  @ArrayUnique({ message: 'Hay imágenes repetidas.' })
  @IsUUID('4', { each: true, message: 'Una de las imágenes no es válida.' })
  imageFileIds?: string[];

  /** V3.2 §28.3: emisor real del certificado institucional. */
  @ApiProperty({ required: false, example: 'Universidad del Valle — Facultad de Informática' })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MaxLength(200, { message: 'El emisor no puede superar 200 caracteres.' })
  certificateIssuer?: string;

  /** V3.2 §21.6: motivo de la cancelación (obligatorio al cancelar). */
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MinLength(10, { message: 'Explica el motivo en al menos 10 caracteres.' })
  @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres.' })
  cancellationReason?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @Transform(trimUniqueArray)
  @IsArray()
  @ArrayMaxSize(15, { message: 'Máximo 15 etiquetas.' })
  @ArrayUnique({ message: 'No se permiten etiquetas duplicadas.' })
  @IsString({ each: true })
  @MaxLength(40, { each: true, message: 'Cada etiqueta es demasiado larga.' })
  tags?: string[];

  @ApiProperty({ required: false, example: 'https://evento.example.com' })
  @IsOptional()
  @Transform(trim)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'El enlace externo debe ser una URL http o https válida.' },
  )
  @MaxLength(500, { message: 'El enlace externo es demasiado largo.' })
  externalUrl?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  evidenceRequired?: boolean;

  @ApiProperty({
    enum: ActivityStatus,
    required: false,
    default: ActivityStatus.DRAFT,
    description: 'Estado inicial (por defecto draft)',
  })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  /** Fin de la actividad (§22, `end_at`). */
  @ApiProperty({ required: false, example: '2026-04-12T18:00:00.000Z' })
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de fin no es válida.' })
  endAt?: string;

  /**
   * Semestres a los que va dirigida (§22, `semester_scope`).
   *
   * Para un docente no es informativo: delimita qué puede gestionar. El
   * servidor rechaza los semestres fuera de su alcance habilitado.
   */
  @ApiProperty({ required: false, type: [Number], example: [4, 5] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8, { message: 'La carrera tiene 8 semestres.' })
  @ArrayUnique({ message: 'No repita semestres.' })
  @IsInt({ each: true, message: 'Cada semestre debe ser un número.' })
  @Min(1, { each: true, message: 'El semestre mínimo es 1.' })
  @Max(8, { each: true, message: 'El semestre máximo es 8.' })
  semesterScope?: number[];

  /** Habilidades que la actividad trabaja (§22, §73.3). */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Máximo 20 habilidades por actividad.' })
  @ArrayUnique({ message: 'No repita habilidades.' })
  @IsUUID('4', { each: true })
  skillIds?: string[];

  @ApiProperty({
    required: false,
    type: () => [SkillContextDto],
    description:
      'V3.2 §11.4: área en la que se trabaja cada habilidad, cuando pertenece a varias de las elegidas. '
      + 'Lo que no se indica se deduce (su área principal si está elegida).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SkillContextDto)
  skillContexts?: SkillContextDto[];

  @ApiProperty({ enum: RegistrationMode, required: false, default: RegistrationMode.OPEN })
  @IsOptional()
  @IsEnum(RegistrationMode, { message: 'Modo de inscripción no válido.' })
  registrationMode?: RegistrationMode;

  /** Requisitos previos (§22, `requirements`). */
  @ApiProperty({ required: false, example: 'Conocer fundamentos de JavaScript.' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(500, { message: 'Los requisitos no pueden superar 500 caracteres.' })
  requirements?: string;

  /** La actividad emite constancias internas (V2 §30). */
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  internalConstancyEnabled?: boolean;

  /** Puntos propios de la actividad (V2 §31.2); para Docente/Sociedad los revisa Dirección. */
  @ApiProperty({ required: false, type: [ActivityGamificationRuleDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, { message: 'Como máximo 3 reglas por actividad.' })
  @ValidateNested({ each: true })
  @Type(() => ActivityGamificationRuleDto)
  gamificationRules?: ActivityGamificationRuleDto[];
}
