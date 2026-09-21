export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  role: string;
  createdAt: string;
  updatedAt: string;
  /** Solo para usuarios con rol docente. */
  semesters?: number[];
  /**
   * Solo en desarrollo sin SMTP configurado: el enlace de activación que en
   * producción llega por correo. Permite probar el alta sin servidor de correo.
   */
  activationToken?: string;
}

/** Ciclo de vida de una cuenta (§12). Solo `active` puede operar. */
export type UserStatus = 'pending_activation' | 'active' | 'suspended' | 'inactive';

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  pending_activation: 'Pendiente de activación',
  active: 'Activa',
  suspended: 'Suspendida',
  inactive: 'Inactiva',
};

export interface AuthResult {
  accessToken: string;
  /** Token de larga duración y revocable con el que se renueva el acceso (§14). */
  refreshToken: string;
  /** Vida del access token en segundos. */
  expiresIn: number;
  user: PublicUser;
}

/* ------------------------------------------------------------------ */
/* Importación de padrón (§10)                                         */
/* ------------------------------------------------------------------ */

/** Veredicto de una fila del padrón. Solo NEW y UPDATE escriben algo. */
export type ImportRowStatus = 'NEW' | 'UPDATE' | 'UNCHANGED' | 'CONFLICT' | 'INVALID';

export interface ImportRow {
  rowNumber: number;
  universityCode: string | null;
  institutionalEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  semester: number | null;
  status: ImportRowStatus;
  /** Motivo del rechazo o del conflicto; null cuando la fila es limpia. */
  message: string | null;
}

export type ImportCounts = Record<ImportRowStatus, number>;

export interface ImportPreview {
  batchId: string;
  counts: ImportCounts;
  totalRows: number;
  rows: ImportRow[];
}

export interface ImportBatchDetail {
  id: string;
  filename: string;
  status: 'PREVIEWED' | 'APPLIED' | 'DISCARDED';
  counts: ImportCounts;
  totalRows: number;
  createdAt: string;
  appliedAt: string | null;
  rows: ImportRow[];
}

export interface ImportBatchSummary {
  id: string;
  filename: string;
  status: 'PREVIEWED' | 'APPLIED' | 'DISCARDED';
  totalRows: number;
  counts: ImportCounts;
  importedBy: string | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface ImportApplyResult {
  batchId: string;
  created: number;
  updated: number;
  message: string;
}

export interface AcademicArea {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  isActive: boolean;
}

/** Categoría del catálogo administrable de actividades (RF4). */
export interface ActivityCategoryItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** null = la categoría sirve para ambos tipos de actividad. */
  appliesTo: 'academica' | 'extracurricular' | null;
  isActive: boolean;
}

/** Interés declarado en texto libre por el estudiante (RF5). */
export interface FreeInterest {
  id: string;
  name: string;
  description: string | null;
}

export interface GamificationCriterion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  trigger: string;
  points: number;
  academicAreaId: string | null;
  academicArea?: AcademicArea | null;
  isActive: boolean;
}

export interface Skill {
  id: string;
  name: string;
  academicAreaId: string | null;
  academicArea?: AcademicArea | null;
  isActive: boolean;
}

/** Autoevaluación en tres niveles (§21.1). Siempre autodeclarada. */
export type SkillLevel = 'basic' | 'intermediate' | 'advanced';

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  basic: 'Básico',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

/** Disponibilidad declarada para colaborar (§17.2). */
export type AvailabilityStatus = 'looking' | 'open' | 'busy' | 'unspecified';

export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  looking: 'Busco equipo',
  open: 'Abierto a propuestas',
  busy: 'Sin disponibilidad',
  unspecified: 'Sin declarar',
};

export type CollaborationMode = 'remote' | 'in_person' | 'hybrid';

export const COLLABORATION_MODE_LABEL: Record<CollaborationMode, string> = {
  remote: 'Remoto',
  in_person: 'Presencial',
  hybrid: 'Híbrido',
};

export type CollaborationInterest =
  | 'projects' | 'research' | 'competitions' | 'study_groups' | 'volunteering';

export const COLLABORATION_INTEREST_LABEL: Record<CollaborationInterest, string> = {
  projects: 'Proyectos',
  research: 'Investigación',
  competitions: 'Competencias',
  study_groups: 'Grupos de estudio',
  volunteering: 'Voluntariado',
};

export interface CollaborationPreferences {
  modes: CollaborationMode[];
  interests: CollaborationInterest[];
  hoursPerWeek: number | null;
  notes: string | null;
}

export interface StudentProfile {
  id: string;
  userId: string;
  /** Institucional: llega del padrón y el estudiante no lo edita (§17.1). */
  universityCode: string | null;
  /** Institucional: lo fija el administrador o el padrón (§17.1). */
  semester: number | null;
  bio: string | null;
  status: string;
  completionPercentage: number;
  improvementAreaIds: string[] | null;
  availability: AvailabilityStatus;
  collaborationPreferences: CollaborationPreferences | null;
  peerDiscoverable: boolean;
}

/* ------------------------------------------------------------------ */
/* Cuestionario de orientación (§16)                                   */
/* ------------------------------------------------------------------ */

export interface OnboardingOption {
  code: string;
  label: string;
}

export interface OnboardingQuestion {
  code: string;
  text: string;
  help: string | null;
  type: 'single' | 'multiple';
  maxChoices: number | null;
  options: OnboardingOption[];
}

export interface Questionnaire {
  version: number;
  totalQuestions: number;
  questions: OnboardingQuestion[];
}

export interface SuggestedArea {
  academicAreaId: string;
  name: string;
  score: number;
}

export interface OnboardingRun {
  id: string;
  version: number;
  status: 'completed' | 'confirmed' | 'superseded';
  suggestedAreas: SuggestedArea[];
  confirmedAreaIds: string[];
  answers: { questionCode: string; optionCodes: string[] }[];
  createdAt: string;
  confirmedAt: string | null;
  message?: string;
}

/* ------------------------------------------------------------------ */
/* Privacidad (§44)                                                    */
/* ------------------------------------------------------------------ */

export type PublicProfileField =
  | 'bio' | 'areas' | 'affinities' | 'support_level'
  | 'projects' | 'skills' | 'availability' | 'trajectory';

export const PUBLIC_FIELD_LABEL: Record<PublicProfileField, string> = {
  bio: 'Mi descripción',
  areas: 'Mis áreas principales',
  affinities: 'Mis afinidades calculadas',
  support_level: 'Mi nivel de respaldo',
  projects: 'Mis proyectos visibles',
  skills: 'Mis tecnologías y experiencia',
  availability: 'Mi disponibilidad',
  trajectory: 'Mi resumen de trayectoria',
};

export interface VisibilitySettings {
  publicProfileEnabled: boolean;
  fields: Record<PublicProfileField, boolean>;
  /** Lo que el sistema nunca comparte, se configure lo que se configure. */
  neverShared: string[];
}

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  type: string;
  /** Categoría del catálogo (RF4). */
  category: ActivityCategoryItem;
  categoryId: string;
  modality: string;
  academicAreaId: string | null;
  academicArea?: AcademicArea | null;
  creatorId: string;
  eventDate: string | null;
  location: string | null;
  capacity: number | null;
  status: string;
  tags: string[] | null;
  externalUrl: string | null;
  evidenceRequired: boolean;
  creator?: { id: string; firstName: string; lastName: string } | null;
  /** Presentes en los listados; el detalle del estudiante trae los suyos. */
  registrationCount?: number;
  confirmedCount?: number;
  seatsLeft?: number | null;
  registrationBlockReason?: string | null;
}

export interface Participant {
  id: string;
  studentProfileId: string;
  status: string;
  studentName: string | null;
  semester: number | null;
  createdAt: string;
}

export interface Registration {
  id: string;
  activityId: string;
  studentProfileId: string;
  status: string;
  studentProfile?: { id: string; user?: PublicUser };
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  technologies: string[] | null;
  academicAreaId: string | null;
  academicArea?: AcademicArea | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
  members?: ProjectMember[];
  evidences?: ProjectEvidence[];
  /** Comentarios docentes recibidos (RF16). Lo calcula GET /projects/mine. */
  feedbackCount?: number;
}

export interface ProjectMember {
  id: string;
  userId: string;
  role: string | null;
  contribution: string | null;
}

export interface ProjectEvidence {
  id: string;
  evidenceType: 'file' | 'link';
  description: string | null;
  fileUrl: string | null;
  externalUrl: string | null;
}

export interface AffinityResult {
  id: string;
  academicAreaId: string;
  academicArea?: AcademicArea;
  score: number | string;
  level: 'low' | 'medium' | 'high';
}

export interface StudentDirectoryRow {
  profileId: string;
  studentName: string;
  email: string;
  semester: number | null;
  status: string;
  completionPercentage: number;
}

export interface StudentDirectory {
  /** restricted=true cuando el rol solo ve ciertos semestres (docente). */
  scope: { restricted: boolean; semesters: number[] };
  students: StudentDirectoryRow[];
}

export interface ProfileSummary {
  profile: { id: string; semester: number | null; bio: string | null; status: string; completionPercentage: number };
  improvementAreas: { id: string; name: string }[];
  interests: {
    academicAreaId: string; area: string | null; priority: number;
    source?: 'onboarding' | 'manual';
  }[];
  preferredAreas?: {
    academicAreaId: string; area: string | null; priority: number;
    source?: 'onboarding' | 'manual';
  }[];
  /** Autoevaluación (§21.1) junto a la experiencia que la respalda (§21.2). */
  skills: {
    skillId: string;
    skill: string | null;
    academicAreaId?: string | null;
    level: SkillLevel;
    selfAssessed?: boolean;
    backing?: {
      projects: number; activities: number; certificates: number;
      evidences: number; total: number;
    };
  }[];
  projects: { id: string; title: string; status: string; technologies: string[] | null }[];
  evidences: unknown[];
  activities: { activityId: string; title: string | null; type: string | null; status: string }[];
  externalCertificates: { id: string; certificateName: string; issuer: string }[];
  internalConstancies: { id: string; description: string; status: string }[];
  affinities: { academicAreaId: string; area: string | null; score: number; level: string }[];
}

/**
 * Archivo subido (§27.2).
 *
 * Ya no trae una URL: trae un identificador. La URL de descarga la publica
 * después la evidencia o el certificado al que se adjunte, porque es el
 * servidor quien decide cómo se sirve un archivo y a quién.
 */
export interface StoredFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  /** Huella del contenido (§28). */
  sha256: string;
  /** Id del archivo idéntico que ya había subido esta persona, si lo hay. */
  duplicateOfId: string | null;
  createdAt: string;
}

/** Niveles de respaldo de un documento (§30). */
export type BackingTier = 'declared' | 'supported' | 'corroborated';

export const BACKING_TIER_LABEL: Record<BackingTier, string> = {
  declared: 'Aportado',
  supported: 'Respaldado',
  corroborated: 'Corroborado',
};

export const BACKING_TIER_HELP: Record<BackingTier, string> = {
  declared: 'Adjuntaste el documento, pero el sistema no pudo comprobar nada por sí mismo.',
  supported: 'El documento se leyó y sus datos coinciden con lo que declaraste.',
  corroborated: 'Además, el enlace de verificación del emisor respondió.',
};

export type ValidationStatus =
  | 'pending' | 'processing' | 'completed' | 'inconclusive' | 'failed';

export const VALIDATION_STATUS_LABEL: Record<ValidationStatus, string> = {
  pending: 'En cola',
  processing: 'Procesando',
  completed: 'Verificado',
  inconclusive: 'Sin poder concluir',
  failed: 'Error al procesar',
};

export type IdentityMatchStatus = 'match' | 'partial_match' | 'mismatch' | 'unknown';

export const IDENTITY_MATCH_LABEL: Record<IdentityMatchStatus, string> = {
  match: 'El nombre coincide',
  partial_match: 'El nombre coincide en parte',
  mismatch: 'El nombre no corresponde',
  unknown: 'No se pudo leer el nombre',
};

export type LinkCheckStatus = 'unverified' | 'available' | 'unavailable' | 'blocked';

export const LINK_CHECK_LABEL: Record<LinkCheckStatus, string> = {
  unverified: 'Sin comprobar',
  available: 'El enlace responde',
  unavailable: 'El enlace no responde',
  blocked: 'No se consultó por seguridad',
};

/** Veredicto del Motor de Validación (§26). */
export interface ValidationVerdict {
  resourceType: string;
  resourceId: string;
  status: ValidationStatus;
  backingTier: BackingTier;
  identityMatchStatus: IdentityMatchStatus;
  extractedData: {
    holderName: string | null;
    issuer: string | null;
    certificateTitle: string | null;
    issueDate: string | null;
    credentialId: string | null;
    verificationUrl: string | null;
    source: 'pdf_text' | 'ocr' | 'qr' | 'none';
    textLength: number;
  } | null;
  linkCheck: {
    status: LinkCheckStatus;
    finalUrl: string | null;
    httpStatus: number | null;
    title: string | null;
    blockedReason: string | null;
    checkedAt: string;
  } | null;
  isDuplicate: boolean;
  validatorVersion: number;
  attempts: number;
  errorCode: string | null;
  finishedAt: string | null;
  disclaimer: string;
}

export interface Evidence {
  id: string;
  evidenceType: 'file' | 'link';
  description: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  externalUrl: string | null;
  projectId: string | null;
  project?: { id: string; title: string } | null;
  activityId: string | null;
  activity?: { id: string; title: string } | null;
  academicAreaId: string | null;
  academicArea?: AcademicArea | null;
  createdAt: string;
}

export interface ExternalCertificate {
  id: string;
  certificateName: string;
  issuer: string;
  certificateUrl: string | null;
  issueDate: string | null;
  description: string | null;
  academicAreaId: string | null;
  academicArea?: AcademicArea | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
}

export interface EligibleParticipant {
  studentProfileId: string;
  studentName: string | null;
  semester: number | null;
  registrationId: string;
  hasConstancy: boolean;
}

export interface InternalConstancy {
  id: string;
  studentProfileId: string;
  activityId: string | null;
  activity?: { id: string; title: string } | null;
  studentProfile?: { id: string; user?: { firstName: string; lastName: string } } | null;
  description: string;
  status: string;
  createdAt: string;
}

/** Integrante aceptado de un proyecto (RF14). */
export interface ProjectMemberItem {
  id: string;
  userId: string;
  name: string | null;
  role: string | null;
  contribution: string | null;
  joinedAt: string;
}

/** Retroalimentación académica sobre un proyecto (RF16). */
export interface ProjectFeedbackItem {
  id: string;
  comment: string;
  teacher: string | null;
  teacherUserId: string;
  createdAt: string;
  editedAt: string | null;
  /** true solo para el docente que la escribió. */
  canEdit: boolean;
}

/** Fila del portafolio institucional que consulta el docente (RF15). */
export interface InstitutionalProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  technologies: string[] | null;
  area: string | null;
  academicAreaId: string | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
  updatedAt: string;
  student: string | null;
  semester: number | null;
}

export interface InstitutionalPortfolio {
  scope: { restricted: boolean; semesters: number[] };
  projects: InstitutionalProject[];
}
