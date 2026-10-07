import { api } from '../api/client';
import { API_URL } from '../config';

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  role: string;
}

export interface AuthResult {
  accessToken: string;
  /** Token de larga duración y revocable con el que se renueva el acceso (§14). */
  refreshToken: string;
  /** Vida del access token en segundos. */
  expiresIn: number;
  user: PublicUser;
}

export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthResult>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<PublicUser>('/auth/me').then((r) => r.data),
  /** Cierra la sesión en el servidor, no solo en el teléfono (§14). */
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),
};

/**
 * Activación y recuperación (§12, §13).
 *
 * Sustituyen al registro público: la cuenta la provisiona la carrera a
 * partir del padrón y su titular la activa demostrando que controla el
 * correo institucional.
 */
/** Respuesta genérica de las solicitudes de correo: igual exista o no la cuenta. */
export interface MailRequestResult {
  message: string;
  /** Segundos antes de poder pedir otro correo: el mismo para todos. */
  retryAfterSeconds: number;
}

/** Canje por contraseña: con el enlace (`token`) o con correo y código de 6 dígitos. */
export interface ConsumeInput {
  token?: string;
  email?: string;
  code?: string;
  password: string;
}

export const activationService = {
  request: (email: string) =>
    api.post<MailRequestResult>('/activation/request', { email }).then((r) => r.data),
  activate: (input: ConsumeInput) =>
    api.post<{ message: string }>('/activation/activate', input).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post<MailRequestResult>('/activation/forgot-password', { email }).then((r) => r.data),
  resetPassword: (input: ConsumeInput) =>
    api.post<{ message: string }>('/activation/reset-password', input).then((r) => r.data),
};

export const catalogService = {
  areas: () => api.get<any[]>('/academic-areas').then((r) => r.data),
  skills: () => api.get<any[]>('/skills').then((r) => r.data),
  /** Catálogo administrable de categorías de actividad (RF4). */
  activityCategories: () => api.get<any[]>('/activity-categories').then((r) => r.data),
};

export const profileService = {
  getMine: () => api.get<any>('/profiles/me').then((r) => r.data),
  create: (data: any) => api.post('/profiles/me', data).then((r) => r.data),
  update: (data: any) => api.patch('/profiles/me', data).then((r) => r.data),
  summary: () => api.get<any>('/profiles/me/summary').then((r) => r.data),
  allowedView: (studentId: string) => api.get(`/profiles/${studentId}/allowed`).then((r) => r.data),
  /** Directorio con el alcance aplicado: { scope, students }. */
  listStudents: (search?: string) =>
    api
      .get<{ scope: { restricted: boolean; semesters: number[] }; students: any[] }>('/profiles/students', {
        params: search ? { search } : undefined,
      })
      .then((r) => r.data),
  /**
   * Busqueda de companeros por nombre (RF14). Devuelve una tarjeta minima:
   * nombre y semestre, sin correo. Exige al menos 2 caracteres.
   */
  searchPeers: (search: string) =>
    api
      .get<{ profileId: string; studentName: string; semester: number | null }[]>('/profiles/peers', {
        params: { search },
      })
      .then((r) => r.data),
  /** Áreas de preferencia: selección del catálogo con prioridad 1-5 (RF5). */
  setPreferredAreas: (items: { academicAreaId: string; priority: number }[]) =>
    api.put('/profiles/me/preferred-areas', { items }).then((r) => r.data),
  /** Intereses en texto libre, distintos de las áreas de preferencia (RF5). */
  freeInterests: () => api.get<any[]>('/profiles/me/free-interests').then((r) => r.data),
  addFreeInterest: (data: { name: string; description?: string }) =>
    api.post<any>('/profiles/me/free-interests', data).then((r) => r.data),
  updateFreeInterest: (id: string, data: { name?: string; description?: string }) =>
    api.patch<any>(`/profiles/me/free-interests/${id}`, data).then((r) => r.data),
  removeFreeInterest: (id: string) =>
    api.delete(`/profiles/me/free-interests/${id}`).then((r) => r.data),
  /** Tecnologías que me interesan o quiero mejorar (V2 §21). Reemplazo completo. */
  skillInterests: () =>
    api.get<{ skillId: string; skill: string | null; kind: SkillInterestKind }[]>('/profiles/me/skill-interests').then((r) => r.data),
  replaceSkillInterests: (items: { skillId: string; kind: SkillInterestKind }[]) =>
    api.put('/profiles/me/skill-interests', { items }).then((r) => r.data),
  confirmInstitutional: (bio?: string) =>
    api.post<OnboardingState>('/profiles/me/onboarding/institutional-confirmation', { bio }).then((r) => r.data),
  onboardingPrivacy: (data: { peerDiscoverable: boolean; publicProfileEnabled: boolean }) =>
    api.post<OnboardingState>('/profiles/me/onboarding/privacy', data).then((r) => r.data),
  /** Estado de la bienvenida: mientras no termine, la app muestra el asistente. */
  onboarding: () => api.get<OnboardingState>('/profiles/me/onboarding').then((r) => r.data),
  saveOnboardingStep: (step: string) =>
    api.patch<OnboardingState>('/profiles/me/onboarding', { step }).then((r) => r.data),
  completeOnboarding: () =>
    api.post<OnboardingState>('/profiles/me/onboarding/complete').then((r) => r.data),
};

export type SkillInterestKind = 'interest' | 'improve';

export interface OnboardingState {
  completed: boolean;
  completedAt: string | null;
  step: string;
  hasProfile: boolean;
  claimed: boolean;
  semester: number | null;
  universityCode?: string | null;
  institutionalConfirmed: boolean;
  privacyReviewed: boolean;
  availabilityDecided: boolean;
  counts: { improvementAreas: number; interests: number; skillInterests: number; skillsToImprove: number; questionnaireRuns: number };
  missing: string[];
}

export const activityService = {
  list: (params?: Record<string, string>) => api.get<any[]>('/activities', { params }).then((r) => r.data),
  /** Detalle: para el estudiante incluye su propio estado y si puede inscribirse. */
  get: (id: string) => api.get<any>(`/activities/${id}`).then((r) => r.data),
  myRegistrations: () => api.get<any[]>('/activities/my-registrations').then((r) => r.data),
  registerInterest: (id: string) => api.post(`/activities/${id}/register-interest`).then((r) => r.data),
  register: (id: string) => api.post(`/activities/${id}/register`).then((r) => r.data),
  /** Baja voluntaria, solo antes de que confirmen la participacion (§23). */
  cancelRegistration: (id: string) =>
    api.post(`/activities/${id}/cancel-registration`).then((r) => r.data),
};

export const projectService = {
  /** Portafolio del estudiante: propios y aquellos donde es integrante aceptado. */
  mine: () => api.get<any[]>('/projects/my').then((r) => r.data),
  get: (id: string) => api.get<any>(`/projects/${id}`).then((r) => r.data),
  create: (data: any) => api.post<any>('/projects', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch<any>(`/projects/${id}`, data).then((r) => r.data),
  /** V3 §22: qué le falta para pasar a ACTIVE. */
  readiness: (id: string) => api.get<any>(`/projects/${id}/readiness`).then((r) => r.data),
  members: (id: string) => api.get<any[]>(`/projects/${id}/members`).then((r) => r.data),
  removeMember: (id: string, memberId: string) =>
    api.delete(`/projects/${id}/members/${memberId}`).then((r) => r.data),

  /** Integrantes con su contribucion y sus tecnologias (§33, §34). */
  membersDetailed: (id: string) =>
    api.get<any[]>(`/projects/${id}/members/detailed`).then((r) => r.data),
  /**
   * Confirmar la contribucion propia (§33).
   *
   * Sin esto, quien acepta una invitacion no obtiene nada del proyecto:
   * la contribucion que escribio otra persona no alimenta su perfil.
   */
  confirmMyContribution: (
    id: string,
    data: { contribution?: string; role?: string; skillIds?: string[] },
  ) => api.put<any>(`/projects/${id}/my-contribution`, data).then((r) => r.data),
  /** Nivel de respaldo y estado de repositorio y demo (§36, §37, §39). */
  checks: (id: string) => api.get<any>(`/projects/${id}/checks`).then((r) => r.data),
  /** Bitacora del proyecto (§41). */
  timeline: (id: string) => api.get<any[]>(`/projects/${id}/timeline`).then((r) => r.data),
};

/** Invitaciones a integrar proyectos (RF14). */
export const projectInvitationService = {
  /** Invitaciones enviadas desde un proyecto propio. */
  ofProject: (projectId: string) =>
    api.get<any[]>(`/projects/${projectId}/invitations`).then((r) => r.data),
  invite: (projectId: string, data: { invitedProfileId: string; proposedRole: string }) =>
    api.post<any>(`/projects/${projectId}/invitations`, data).then((r) => r.data),
  cancel: (projectId: string, invitationId: string) =>
    api.patch<any>(`/projects/${projectId}/invitations/${invitationId}/cancel`).then((r) => r.data),
  /** Invitaciones recibidas por el estudiante. */
  mine: (onlyPending = false) =>
    api
      .get<any[]>('/projects/invitations/mine', {
        params: onlyPending ? { pending: 'true' } : undefined,
      })
      .then((r) => r.data),
  respond: (invitationId: string, decision: 'accept' | 'reject') =>
    api.patch<any>(`/projects/invitations/${invitationId}`, { decision }).then((r) => r.data),
};

/** Retroalimentación académica del docente sobre un proyecto (RF16). */
export const projectFeedbackService = {
  list: (projectId: string) => api.get<any[]>(`/projects/${projectId}/feedback`).then((r) => r.data),
};

/** Subida de archivos de evidencia. Devuelve la referencia a persistir. */
/**
 * Archivo subido (§27.2).
 *
 * Ya no trae URL: trae identificador. La URL de descarga la publica la
 * evidencia o el certificado al que se adjunte, porque es el servidor quien
 * decide como se sirve un archivo y a quien.
 */
export interface StoredFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  /** Huella del contenido (§28). */
  sha256: string;
  /** Id del archivo identico que ya habia subido esta persona, si lo hay. */
  duplicateOfId: string | null;
  createdAt: string;
}

/** Niveles de respaldo de un documento (§30). */
export type BackingTier = 'declared' | 'supported' | 'corroborated' | 'flagged';

export const BACKING_TIER_LABEL: Record<BackingTier, string> = {
  declared: 'Aportado',
  supported: 'Respaldado',
  corroborated: 'Corroborado',
  flagged: 'Con inconsistencias',
};

export const BACKING_TIER_HELP: Record<BackingTier, string> = {
  declared: 'Lo adjuntaste, pero el sistema no pudo comprobar nada por sí mismo.',
  supported: 'El documento se leyó y coincide con lo declarado. Es un respaldo parcial.',
  corroborated: 'Una fuente oficial del emisor identifica esta credencial y coincide contigo.',
  flagged: 'Algo no coincide. No se borró: corrige los datos o el archivo y se vuelve a comprobar.',
};

export const uploadService = {
  /**
   * En React Native el archivo se envia por su uri; no se lee a memoria.
   * El objeto { uri, name, type } es la forma que FormData espera aqui.
   */
  upload: (file: { uri: string; name: string; mimeType: string }) => {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
    return api
      .post<StoredFile>('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  fileUrl: (relative: string) => `${API_URL.replace(/\/api$/, '')}${relative}`,
};

/** Consulta del Motor de Validacion (§26). */
export const validationService = {
  forResource: (resourceType: string, resourceId: string) =>
    api.get<any>(`/validation/${resourceType}/${resourceId}`).then((r) => r.data),
};

export const evidenceService = {
  create: (data: any) => api.post<any>('/evidences', data).then((r) => r.data),
  mine: () => api.get<any[]>('/evidences/my').then((r) => r.data),
  remove: (id: string) => api.delete(`/evidences/${id}`).then((r) => r.data),
  add: (projectId: string, data: any) => api.post(`/projects/${projectId}/evidences`, data).then((r) => r.data),
};

export const certificateService = {
  mine: () => api.get<any[]>('/certificates/external/my').then((r) => r.data),
  create: (data: any) => api.post<any>('/certificates/external', data).then((r) => r.data),
  remove: (id: string) => api.delete(`/certificates/external/${id}`).then((r) => r.data),
  /** V3 §15: oportunidades terminadas en las que ya puede adjuntar la credencial. */
  eligibleOpportunities: () =>
    api.get<any[]>('/certificates/external/eligible-opportunities').then((r) => r.data),
};

export const constancyService = {
  mine: () => api.get<any[]>('/constancies/internal/my').then((r) => r.data),
};

/** Un area dentro del resumen de afinidad (RF17, §49). */
export interface AffinityArea {
  academicAreaId: string;
  area: string | null;
  /** AFFINITY_SCORE: de 0 a 100 (§49). */
  score: number;
  /** Puntos crudos sobre el maximo teorico, que es lo que suma el desglose. */
  rawPoints: number;
  level: 'low' | 'medium' | 'high';
  /** SUPPORT_SCORE: cuanta informacion trazable lo sostiene (§49). */
  supportScore: number;
  supportLevel: 'low' | 'medium' | 'high';
  /** Familias independientes que lo respaldan (§54). */
  supportFamilies: string[];
  rank: number;
}

/**
 * RF17 define dos salidas distintas: mostrar las afinidades, o informar que
 * todavia no hay informacion suficiente. Por eso el estado viaja explicito.
 */
export interface AffinitySummary {
  status: 'calculated' | 'insufficient_data';
  message: string;
  calculatedAt: string | null;
  rulesVersion: string | null;
  engineVersion: number;
  signalsCount: number;
  maxRawPoints: number;
  totalScore: number;
  areas: AffinityArea[];
}

/** Una linea del desglose: que sumo, cuanto y por que (§56). */
export interface AffinityContribution {
  signalFamily: string;
  signalType: string;
  weightCode: string;
  matchType: 'declared' | 'tag' | 'text' | 'inherited';
  sourceEntityType: string | null;
  rawPoints: number;
  multiplier: number;
  points: number;
  supportPoints: number;
  reason: string;
  sourceLabel: string;
  sourceId: string | null;
}

export interface AffinityBreakdown {
  academicAreaId: string;
  area: string;
  score: number;
  rawPoints: number;
  maxRawPoints: number;
  level: 'low' | 'medium' | 'high' | null;
  supportScore: number;
  supportLevel: 'low' | 'medium' | 'high' | null;
  supportFamilies: string[];
  engineVersion: number;
  contributions: AffinityContribution[];
  /** §91: lo que suma. */
  contributing: AffinityContribution[];
  /** §91: lo que se tuvo en cuenta y no suma. */
  notContributing: AffinityContribution[];
}

export interface AffinitySnapshot {
  id: string;
  calculatedAt: string;
  status: 'calculated' | 'insufficient_data';
  totalScore: number;
  areasCount: number;
  signalsCount: number;
  rulesVersion: string;
  engineVersion: number;
  averageSupport: number;
  areas: {
    academicAreaId: string; area: string | null; score: number; rawPoints: number;
    level: string; supportScore: number; supportLevel: string; rank: number;
  }[];
}

export interface AffinityWeight {
  code: string;
  signalType: string;
  points: number;
  label: string;
  description: string;
}

/** La regla completa del motor: pesos y estructura (§51). */
export interface AffinityEngineRules {
  engineVersion: number;
  maxRawPoints: number;
  caps: Record<string, number>;
  supportCaps: Record<string, number>;
  supportPoints: Record<string, number>;
  diminishing: Record<string, number[]>;
  levelThresholds: { LOW_MAX: number; MEDIUM_MAX: number };
  independentFamilies: string[];
  weights: AffinityWeight[];
}

/** Colaboracion entre estudiantes (§42 a §47). */
export interface PublicLinkView {
  slug: string;
  url: string;
  enabled: boolean;
  qrSvg: string;
  qrSize: number;
  qrPayload: string;
}

export type ContactChannelType = 'teams' | 'whatsapp' | 'linkedin' | 'email' | 'link';

/** Canal de contacto ya validado por la API, con su enlace seguro (V2 §59). */
export interface ContactChannelView {
  channel: ContactChannelType;
  label: string;
  value: string;
  href: string | null;
  isPublic: boolean;
}

export interface ContactView {
  contactId: string;
  profileId: string;
  name: string;
  semester: number | null;
  availability: string | null;
  source: string;
  since: string;
  /** V2 §59: los canales que la otra persona compartió. */
  channels: ContactChannelView[];
  /** V2 §56: lo que yo anoté de este contacto. */
  note: { alias: string | null; context: string | null; preferredChannel: ContactChannelType | null };
}

export const collaborationService = {
  // V2 §59: Afinia no tiene chat; cada uno comparte sus canales.
  myChannels: () => api.get<ContactChannelView[]>('/profiles/me/contact-channels').then((r) => r.data),
  saveChannels: (channels: { channel: ContactChannelType; value: string; isPublic: boolean }[]) =>
    api.put<ContactChannelView[]>('/profiles/me/contact-channels', { channels }).then((r) => r.data),
  myPublicLink: () => api.get<PublicLinkView>('/profiles/me/public-link').then((r) => r.data),
  rotatePublicLink: () =>
    api.post<PublicLinkView>('/profiles/me/public-link/rotate').then((r) => r.data),
  requestContact: (body: { slug: string; message?: string; source?: string }) =>
    api.post('/contacts/requests', body).then((r) => r.data),
  receivedRequests: () => api.get<any[]>('/contacts/requests/received').then((r) => r.data),
  decideContactRequest: (id: string, decision: 'accept' | 'reject') =>
    api.patch(`/contacts/requests/${id}`, { decision }).then((r) => r.data),
  contacts: () => api.get<ContactView[]>('/contacts').then((r) => r.data),
  myTeamInvitations: () => api.get<any[]>('/teams/invitations/mine').then((r) => r.data),
  decideTeamInvitation: (id: string, decision: 'accept' | 'decline') =>
    api.patch(`/teams/invitations/${id}`, { decision }).then((r) => r.data),
};

/** Gamificacion (§66). Los puntos reconocen hechos; no alimentan la afinidad. */
export interface GamificationSummary {
  totalPoints: number;
  eventsCount: number;
  note: string;
  badges: {
    code: string; name: string; description: string; trigger: string;
    triggerLabel: string; threshold: number; progress: number;
    earned: boolean; earnedAt: string | null;
  }[];
  events: {
    id: string; trigger: string; triggerLabel: string; points: number;
    reason: string; occurredAt: string;
  }[];
  rules: { trigger: string; label: string; points: number }[];
}

export const gamificationService = {
  myProgress: () => api.get<GamificationSummary>('/gamification/me').then((r) => r.data),
  /** Saldo canjeable y puntos de la semana, el mes y el año. */
  wallet: () =>
    api
      .get<{
        balance: { earned: number; spent: number; available: number };
        periods: { week: number; month: number; year: number };
        redemptions: { id: string; reward?: string; cost: number; status: string; createdAt: string }[];
      }>('/gamification/me/wallet')
      .then((r) => r.data),
};

export const affinityService = {
  mine: () => api.get<any[]>('/affinity/me').then((r) => r.data),
  recalculateMine: () => api.post<any[]>('/affinity/recalculate/me').then((r) => r.data),
  student: (studentId: string) => api.get<any[]>(`/affinity/student/${studentId}`).then((r) => r.data),
  summary: () => api.get<AffinitySummary>('/affinity/me/summary').then((r) => r.data),
  breakdown: (areaId: string) =>
    api.get<AffinityBreakdown>(`/affinity/me/areas/${areaId}/breakdown`).then((r) => r.data),
  history: (limit = 10) =>
    api.get<AffinitySnapshot[]>(`/affinity/me/history?limit=${limit}`).then((r) => r.data),
  weights: () => api.get<AffinityEngineRules>('/affinity/weights').then((r) => r.data),
};

/** Un motivo por el que se recomienda algo, con su peso (RF18). */
export interface RecommendationReasonView {
  code: string;
  label: string;
  points: number;
}

export interface RecommendationItem {
  id: string;
  type: 'activity' | 'opportunity' | 'external_course' | 'resource' | 'strengthening_area' | 'teammate';
  typeLabel: string;
  status: 'new' | 'viewed' | 'saved' | 'dismissed';
  title: string;
  description: string | null;
  targetId: string;
  targetLink: string | null;
  area: { id: string; name: string } | null;
  score: number;
  reasons: RecommendationReasonView[];
  /** Falso cuando el elemento ya no esta disponible en la plataforma. */
  isCurrent: boolean;
  generatedAt: string;
  viewedAt: string | null;
  decidedAt: string | null;
}

export interface RecommendationGroup {
  type: string;
  label: string;
  items: RecommendationItem[];
}

/**
 * La Tabla 2.27 define tres resultados distintos: hay recomendaciones, el
 * perfil no tiene informacion suficiente (flujo 2a) o no hay coincidencias
 * (flujo 3a).
 */
export interface RecommendationsResponse {
  outcome: 'available' | 'insufficient_profile' | 'no_matches';
  message: string;
  generatedAt: string;
  rulesVersion: string;
  counts: { total: number; saved: number; dismissed: number; byType: Record<string, number> };
  groups: RecommendationGroup[];
}

export interface RecommendationDetail extends RecommendationItem {
  detail: Record<string, any> | null;
}

export const recommendationService = {
  mine: () => api.get<RecommendationsResponse>('/recommendations/me').then((r) => r.data),
  /** Abrir el detalle marca la recomendacion como vista (markAsViewed). */
  detail: (id: string) =>
    api.get<RecommendationDetail>(`/recommendations/me/${id}`).then((r) => r.data),
  decide: (id: string, status: 'viewed' | 'saved' | 'dismissed') =>
    api.patch<RecommendationItem>(`/recommendations/me/${id}`, { status }).then((r) => r.data),
  history: (status: 'saved' | 'dismissed') =>
    api.get<RecommendationItem[]>(`/recommendations/me/history?status=${status}`).then((r) => r.data),
  rules: () => api.get('/recommendations/rules').then((r) => r.data),
};


