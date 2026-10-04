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
  /** Semestre institucional. Solo para estudiantes. */
  semester?: number | null;
  /** Código universitario. Solo para estudiantes. */
  universityCode?: string | null;
  /**
   * En qué quedó el último correo de cuenta. Nunca trae el enlace ni el
   * código: esos solo viajan al buzón institucional del titular.
   */
  invitation?: InvitationView;
}

export interface InvitationView {
  /** Estado del intento (V2 §19): aceptado por SMTP no es «entregado». */
  deliveryState?: 'QUEUED' | 'SENT_TO_SMTP' | 'FAILED';
  status: 'sent' | 'queued' | 'failed' | 'skipped';
  sentTo?: string;
  /** El correo está en modo simulado: no salió a ningún buzón. */
  simulated?: boolean;
  error?: string | null;
  at?: string | null;
}

/** Estado del envío de correo, para el panel de administración. */
export interface MailStatus {
  transport: 'smtp' | 'console';
  realDelivery: boolean;
  safeForAutomatedTests: boolean;
  host: string | null;
  port: number | null;
  secure: boolean | null;
  authType: 'none' | 'login' | 'oauth2' | null;
  user: string | null;
  from: string;
  replyTo: string | null;
  allowedDomains: string[];
  captureEnabled: boolean;
  connection: 'ok' | 'error' | 'checking' | 'not_applicable';
  lastError: string | null;
  problems: string[];
  warnings: string[];
}

/** Estado de un enlace de activación o recuperación. */
export interface TokenCheck {
  state: 'valid' | 'used' | 'expired' | 'replaced' | 'locked' | 'suspended' | 'invalid';
  message: string | null;
  firstName?: string;
  email?: string;
  expiresAt?: string;
}

/** Respuesta genérica de las solicitudes públicas de correo. */
export interface MailRequestResult {
  message: string;
  /** Segundos antes de poder pedir otro: el mismo para todos. */
  retryAfterSeconds: number;
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
  /** Solo para clientes sin cookie (móvil). La web lo recibe en una cookie HttpOnly. */
  refreshToken?: string;
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
  /** Identificador estable y único (p. ej. «bases_de_datos»). */
  code: string;
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
  /** Otros nombres de la misma tecnología (V2 §23.2). */
  aliases?: string[];
  code: string;
  academicAreaId: string | null;
  academicArea?: AcademicArea | null;
  isActive: boolean;
}

/** Interés por una tecnología (V2 §21): «me interesa» o «quiero mejorar». */
export type SkillInterestKind = 'interest' | 'improve';

export const SKILL_INTEREST_LABEL: Record<SkillInterestKind, string> = {
  interest: 'Me interesa',
  improve: 'Quiero mejorar',
};

export interface SkillClassification {
  rule: 'canonical' | 'suggested' | 'none';
  areaIds: string[];
  areaNames: string[];
  reason: string | null;
}

export interface SkillInterest {
  skillId: string;
  skill: string | null;
  academicAreaId: string | null;
  kind: SkillInterestKind;
  source: 'declared' | 'orientation' | 'historical_self_assessment';
}

/** Tecnología respaldada por trayectoria (V2 §34): dónde aparece, no cuánto se domina. */
export interface BackedSkill {
  skillId: string;
  skill: string | null;
  academicAreaId?: string | null;
  sources: ('project' | 'activity')[];
  evidenceCount: number;
}

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
  publicProfileEnabled?: boolean;
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
  /** Mínimo de respuestas para calcular sugerencias. */
  minAnswers?: number;
  /** Las áreas declaradas que dieron pie a preguntas propias. */
  basedOn?: string[];
  questions: OnboardingQuestion[];
}

/** Pasos de la bienvenida, en orden. */
export type OnboardingStepKey =
  | 'welcome'
  | 'profile'
  | 'interests'
  | 'improvement'
  | 'availability'
  | 'questionnaire'
  | 'done';

export interface OnboardingState {
  completed: boolean;
  completedAt: string | null;
  step: OnboardingStepKey;
  hasProfile: boolean;
  claimed: boolean;
  semester: number | null;
  universityCode?: string | null;
  institutionalConfirmed: boolean;
  privacyReviewed: boolean;
  availabilityDecided: boolean;
  counts: {
    improvementAreas: number;
    interests: number;
    skillInterests: number;
    skillsToImprove: number;
    questionnaireRuns: number;
  };
  /** Lo obligatorio que falta para terminar (V2 §20.2), en palabras. */
  missing: string[];
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

/** Ciclo de vida de una actividad (§22). */
export type ActivityStatus =
  | 'draft' | 'published' | 'open' | 'closed' | 'finished' | 'cancelled';

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  open: 'Inscripciones abiertas',
  closed: 'Inscripciones cerradas',
  finished: 'Finalizada',
  cancelled: 'Cancelada',
};

/**
 * Transiciones posibles (§22), copiadas del contrato del servidor.
 *
 * Permiten ofrecer solo los cambios que existen, en vez de mostrar seis
 * botones y dejar que el servidor rechace cinco.
 */
export const ACTIVITY_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  draft: ['published', 'open', 'cancelled'],
  published: ['draft', 'open', 'closed', 'finished', 'cancelled'],
  open: ['closed', 'finished', 'cancelled'],
  closed: ['open', 'finished', 'cancelled'],
  finished: [],
  cancelled: [],
};

export type RegistrationMode = 'open' | 'approval';

export const REGISTRATION_MODE_LABEL: Record<RegistrationMode, string> = {
  open: 'Inscripción libre',
  approval: 'Requiere aprobación',
};

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
  /** Quien responde por ella; puede no ser su creador (§22). */
  responsibleUserId: string | null;
  /** Inicio (§22, `start_at`). */
  eventDate: string | null;
  /** Fin (§22, `end_at`). */
  endAt: string | null;
  /** Semestres a los que va dirigida. null = toda la carrera (§22). */
  semesterScope: number[] | null;
  registrationMode: RegistrationMode;
  requirements: string | null;
  /** Habilidades que la actividad trabaja (§73.3). */
  activitySkills?: { id: string; skillId: string; skill?: Skill | null }[];
  location: string | null;
  capacity: number | null;
  status: ActivityStatus;
  tags: string[] | null;
  externalUrl: string | null;
  evidenceRequired: boolean;
  creator?: { id: string; firstName: string; lastName: string } | null;
  /** Presentes en los listados; el detalle del estudiante trae los suyos. */
  registrationCount?: number;
  confirmedCount?: number;
  seatsLeft?: number | null;
  registrationBlockReason?: string | null;
  /** Situación del estudiante que consulta. Solo llega en su listado. */
  myRegistration?: { id: string; status: RegistrationStatus } | null;
}

/** Participación de un estudiante en una actividad (§23). */
export type RegistrationStatus =
  | 'interested' | 'registered' | 'confirmed' | 'absent' | 'cancelled';

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

/** Nivel de respaldo de un proyecto (§36). Se deriva; no se declara. */
export type ProjectBackingTier =
  | 'declared' | 'supported' | 'corroborated' | 'reviewed' | 'flagged';

export const PROJECT_BACKING_LABEL: Record<ProjectBackingTier, string> = {
  declared: 'Declarado',
  supported: 'Respaldado',
  corroborated: 'Corroborado',
  reviewed: 'Revisado',
  flagged: 'Con observaciones',
};

export const PROJECT_BACKING_HELP: Record<ProjectBackingTier, string> = {
  declared: 'Solo la información que escribiste. No es una crítica: el sistema aún no pudo comprobar nada por su cuenta.',
  supported: 'Hay al menos una fuente adicional: un integrante aceptado, una evidencia, el repositorio o la demo.',
  corroborated: 'Hay dos señales independientes y algo que responde por sí mismo.',
  reviewed: 'Además, un docente dejó retroalimentación. No significa aprobado académicamente.',
  flagged: 'Algo no cuadra: un enlace bloqueado o un recurso que desapareció. El proyecto se conserva.',
};

/** Situación de una tecnología declarada frente a lo encontrado (§38). */
export type TechnologyStatus = 'declared' | 'detected' | 'both';

export const TECHNOLOGY_STATUS_LABEL: Record<TechnologyStatus, string> = {
  declared: 'Declarada',
  detected: 'Detectada',
  both: 'Declarada y detectada',
};

/** Integrante con su contribución y sus tecnologías (§33, §34). */
export interface ProjectMemberDetailed {
  id: string;
  userId: string;
  name: string | null;
  role: string | null;
  contribution: string | null;
  /** Mientras sea false, lo que figura lo escribió otra persona (§33). */
  contributionConfirmed: boolean;
  contributionConfirmedAt: string | null;
  skillsUsed: { skillId: string; name: string | null }[];
  createdAt: string;
}

/** Lo que se sabe del repositorio y la demo (§36, §37, §39). */
export interface ProjectChecks {
  backingTier: ProjectBackingTier;
  backingReasons: string[];
  repository: {
    url: string;
    status: LinkCheckStatus;
    metadata: {
      exists: boolean;
      owner: string | null;
      repositoryName: string | null;
      defaultBranch: string | null;
      languages: string[];
      updatedAt: string | null;
      readmePresence: boolean;
      manifests: string[];
      stars: number | null;
      error: string | null;
    } | null;
    technologySignals: { name: string; status: TechnologyStatus; source: string | null }[];
    checkedAt: string;
  } | null;
  demo: {
    url: string;
    status: LinkCheckStatus;
    isHttps: boolean;
    title: string | null;
    httpStatus: number | null;
    blockedReason: string | null;
    checkedAt: string;
  } | null;
  disclaimer: string;
}

/** Un evento de la bitácora del proyecto (§41). */
export interface ProjectEventItem {
  id: string;
  eventType: string;
  actor: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const PROJECT_EVENT_LABEL: Record<string, string> = {
  project_created: 'Proyecto creado',
  member_invited: 'Integrante invitado',
  member_accepted: 'Invitación aceptada',
  member_declined: 'Invitación rechazada',
  member_removed: 'Integrante retirado',
  contribution_updated: 'Contribución propuesta',
  contribution_confirmed: 'Contribución confirmada',
  evidence_added: 'Evidencia añadida',
  evidence_removed: 'Evidencia retirada',
  repository_checked: 'Repositorio comprobado',
  demo_checked: 'Demo comprobada',
  feedback_added: 'Retroalimentación docente',
  project_visibility_changed: 'Visibilidad cambiada',
  project_archived: 'Proyecto archivado',
  backing_tier_changed: 'Nivel de respaldo recalculado',
};

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
  /** true si el estudiante es su responsable; false si participa como integrante. */
  isOwner?: boolean;
  myRole?: string | null;
  /** Derivado de señales observables (§36). */
  backingTier?: ProjectBackingTier;
  backingReasons?: string[] | null;
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
  /** Tecnologías respaldadas por trayectoria (V2 §22). Sin nivel autodeclarado. */
  skills: BackedSkill[];
  /** Tecnologías que le interesan o quiere mejorar (declarativo). */
  skillInterests?: SkillInterest[];
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

/* ------------------------------------------------------------------ */
/* Gamificación: retos, recompensas y monedero                         */
/* ------------------------------------------------------------------ */

export interface Wallet {
  balance: { earned: number; spent: number; available: number };
  periods: { week: number; month: number; year: number };
  redemptions: RedemptionItem[];
}

export interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  stock: number | null;
  isActive: boolean;
  offeredBy: string | null;
}

export interface RedemptionItem {
  id: string;
  reward?: string;
  cost: number;
  status: 'pending' | 'delivered' | 'rejected';
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  student?: string | null;
}

export interface ChallengeItem {
  id: string;
  title: string;
  description: string | null;
  points: number;
  academicAreaId: string | null;
  academicArea?: AcademicArea | null;
  isActive: boolean;
  createdAt: string;
}

export interface ScopePoints {
  period: 'week' | 'month' | 'year';
  students: { profileId: string; name: string; semester: number; points: number }[];
}
