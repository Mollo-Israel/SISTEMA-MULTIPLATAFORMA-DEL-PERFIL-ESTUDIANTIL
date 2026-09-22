import { api } from '../api/client';
import type {
  AcademicArea,
  InstitutionalPortfolio,
  ProjectFeedbackItem,
  ProjectMemberItem,
  ActivityCategoryItem,
  FreeInterest,
  EligibleParticipant,
  Evidence,
  ExternalCertificate,
  GamificationCriterion,
  InternalConstancy,
  StoredFile,
  StudentDirectory,
  Activity,
  AffinityResult,
  AuthResult,
  ImportApplyResult,
  ImportBatchDetail,
  ImportBatchSummary,
  ImportPreview,
  OnboardingRun,
  ProjectChecks,
  ProjectEventItem,
  ProjectMemberDetailed,
  ValidationVerdict,
  Questionnaire,
  SkillLevel,
  UserStatus,
  VisibilitySettings,
  ProfileSummary,
  Project,
  PublicUser,
  Participant,
  Registration,
  Skill,
  StudentProfile,
} from './types';

export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthResult>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<PublicUser>('/auth/me').then((r) => r.data),
  /** Cierra la sesión en el servidor, no solo en el navegador (§14). */
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  sessions: () => api.get('/auth/sessions').then((r) => r.data),
  logoutAll: () => api.delete('/auth/sessions').then((r) => r.data),
};

/**
 * Activación y recuperación (§12).
 *
 * Sustituyen al registro público: una cuenta la provisiona el administrador
 * y su titular la activa demostrando control del correo institucional.
 */
export const activationService = {
  request: (email: string) =>
    api.post<{ message: string }>('/activation/request', { email }).then((r) => r.data),
  activate: (token: string, password: string) =>
    api.post<{ message: string }>('/activation/activate', { token, password }).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/activation/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/activation/reset-password', { token, password }).then((r) => r.data),
};

/** Importación de padrón institucional (§10). */
export const importsService = {
  preview: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<ImportPreview>('/imports/students/preview', form)
      .then((r) => r.data);
  },
  apply: (batchId: string) =>
    api.post<ImportApplyResult>(`/imports/students/${batchId}/apply`).then((r) => r.data),
  discard: (batchId: string) =>
    api.post(`/imports/students/${batchId}/discard`).then((r) => r.data),
  list: () => api.get<ImportBatchSummary[]>('/imports/students').then((r) => r.data),
  detail: (batchId: string) =>
    api.get<ImportBatchDetail>(`/imports/students/${batchId}`).then((r) => r.data),
};

export const profileService = {
  getMine: () => api.get<StudentProfile>('/profiles/me').then((r) => r.data),
  create: (data: Partial<StudentProfile>) => api.post<StudentProfile>('/profiles/me', data).then((r) => r.data),
  update: (data: Partial<StudentProfile>) => api.patch<StudentProfile>('/profiles/me', data).then((r) => r.data),
  summary: () => api.get<ProfileSummary>('/profiles/me/summary').then((r) => r.data),
  allowedView: (studentId: string) => api.get(`/profiles/${studentId}/allowed`).then((r) => r.data),
  listStudents: (search?: string) =>
    api
      .get<StudentDirectory>('/profiles/students', { params: search ? { search } : undefined })
      .then((r) => r.data),
  /** Áreas de preferencia: selección del catálogo con prioridad 1-5 (RF5). */
  setPreferredAreas: (items: { academicAreaId: string; priority: number }[]) =>
    api.put('/profiles/me/preferred-areas', { items }).then((r) => r.data),
  /** Intereses en texto libre, distintos de las áreas de preferencia (RF5). */
  freeInterests: () => api.get<FreeInterest[]>('/profiles/me/free-interests').then((r) => r.data),
  addFreeInterest: (data: { name: string; description?: string }) =>
    api.post<FreeInterest>('/profiles/me/free-interests', data).then((r) => r.data),
  updateFreeInterest: (id: string, data: { name?: string; description?: string }) =>
    api.patch<FreeInterest>(`/profiles/me/free-interests/${id}`, data).then((r) => r.data),
  removeFreeInterest: (id: string) =>
    api.delete(`/profiles/me/free-interests/${id}`).then((r) => r.data),
  setSkills: (items: { skillId: string; level: SkillLevel }[]) =>
    api.put('/profiles/me/skills', { items }).then((r) => r.data),

  /** Qué comparto en mi perfil compartible (§44). */
  visibility: () =>
    api.get<VisibilitySettings>('/profiles/me/visibility').then((r) => r.data),
  setVisibility: (data: {
    publicProfileEnabled?: boolean;
    fields?: Record<string, boolean>;
  }) => api.put<VisibilitySettings>('/profiles/me/visibility', data).then((r) => r.data),
};

/**
 * Cuestionario Inicial de Orientación Académica (§16).
 *
 * Responder no crea intereses: los crea la confirmación posterior.
 */
export const onboardingService = {
  questionnaire: () =>
    api.get<Questionnaire>('/onboarding/questionnaire').then((r) => r.data),
  current: () =>
    api
      .get<{ run: OnboardingRun | null; pendingConfirmation: boolean }>('/onboarding/me')
      .then((r) => r.data),
  history: () => api.get<OnboardingRun[]>('/onboarding/me/history').then((r) => r.data),
  submit: (answers: { questionCode: string; optionCodes: string[] }[]) =>
    api.post<OnboardingRun>('/onboarding/runs', { answers }).then((r) => r.data),
  confirm: (runId: string, academicAreaIds: string[]) =>
    api
      .post<{ runId: string; confirmedAreaIds: string[]; message: string }>(
        `/onboarding/runs/${runId}/confirm`,
        { academicAreaIds },
      )
      .then((r) => r.data),
};

export const catalogService = {
  areas: () => api.get<AcademicArea[]>('/academic-areas').then((r) => r.data),
  skills: () => api.get<Skill[]>('/skills').then((r) => r.data),
  /** Catálogo administrable de categorías de actividad (RF4). */
  activityCategories: () =>
    api.get<ActivityCategoryItem[]>('/activity-categories').then((r) => r.data),
};

/**
 * Entrada del catálogo controlado de recursos y cursos externos (§61).
 *
 * `createdBy` es lo que separa un catálogo curado de una lista de enlaces: un
 * recurso está aquí porque una persona concreta decidió incluirlo.
 */
export interface LearningResource {
  id: string;
  title: string;
  provider: string;
  url: string;
  description: string | null;
  academicAreaId: string;
  academicArea?: { id: string; name: string };
  resourceType: string;
  status: 'active' | 'inactive';
  createdBy: string | null;
  resourceSkills?: { id: string; skillId: string; skill?: { id: string; name: string } }[];
  createdAt: string;
}

export const learningResourceService = {
  list: (params?: { includeInactive?: boolean; academicAreaId?: string }) =>
    api
      .get<LearningResource[]>('/learning-resources', {
        params: {
          ...(params?.includeInactive ? { includeInactive: 'true' } : {}),
          ...(params?.academicAreaId ? { academicAreaId: params.academicAreaId } : {}),
        },
      })
      .then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    api.post<LearningResource>('/learning-resources', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<LearningResource>(`/learning-resources/${id}`, data).then((r) => r.data),
};

/**
 * Colaboración entre estudiantes (§42 a §47).
 *
 * El perfil compartible es la única llamada del sistema que no lleva sesión:
 * un QR que exigiera iniciar sesión no serviría para lo que existe.
 */
export interface PublicProfileView {
  slug: string;
  name: string;
  semester: number | null;
  bio?: string | null;
  availability?: string;
  collaborationModes?: string[];
  collaborationInterests?: string[];
  areas?: { area: string | null; score?: number; supportLevel?: string }[];
  skills?: { name: string; level: string }[];
  projects?: {
    title: string;
    description: string | null;
    technologies?: string[];
    backingTier?: string;
  }[];
  trajectory?: {
    areasCount: number;
    signalsCount: number;
    averageSupport: number;
    calculatedAt: string;
  } | null;
}

export interface PublicLinkView {
  slug: string;
  url: string;
  enabled: boolean;
  /** SVG ya renderizado. Lo genera el servidor, que es donde vive §43. */
  qrSvg: string;
  qrSize: number;
  /** El contenido exacto del código: únicamente la URL. */
  qrPayload: string;
}

export interface ContactView {
  contactId: string;
  profileId: string;
  name: string;
  semester: number | null;
  availability: string | null;
  source: string;
  since: string;
}

export interface TeamNeedView {
  id: string;
  purpose: string;
  description: string | null;
  status: 'open' | 'closed';
  maxMembers: number;
  availabilityRequirement: string;
  isOwner: boolean;
  owner: { profileId: string; name: string };
  requiredSkills: { skillId: string; name: string | null }[];
  preferredAreas: { academicAreaId: string; name: string | null }[];
  createdAt: string;
}

export interface TeamSuggestionsView {
  need: TeamNeedView;
  missingSkills?: { skillId: string; name: string | null }[];
  coveredSkills?: { skillId: string; name: string | null }[];
  candidates: {
    profileId: string;
    name: string;
    semester: number | null;
    availability: string;
    score: number;
    reasons: { code: string; label: string; points: number }[];
  }[];
}

export interface TeamView {
  id: string;
  name: string;
  status: string;
  purpose: string | null;
  isOwner: boolean;
  maxMembers: number | null;
  requiredSkills: { skillId: string; name: string | null }[];
  coveredSkills: { skillId: string; name: string | null }[];
  missingSkills: { skillId: string; name: string | null }[];
  openings: number;
  members: { profileId: string; name: string; role: string | null; availability: string | null }[];
}

export interface ConversationView {
  id: string;
  kind: 'direct' | 'team';
  teamId: string | null;
  title: string;
  participants: { profileId: string; name: string }[];
  lastMessageAt: string | null;
}

export interface MessageView {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  sender: { profileId: string; name: string };
}

export const collaborationService = {
  // §43, §44
  publicProfile: (slug: string) =>
    api.get<PublicProfileView>(`/public/profiles/${slug}`).then((r) => r.data),
  myPublicLink: () =>
    api.get<PublicLinkView>('/profiles/me/public-link').then((r) => r.data),
  rotatePublicLink: () =>
    api.post<PublicLinkView>('/profiles/me/public-link/rotate').then((r) => r.data),

  // §45
  requestContact: (body: { slug: string; message?: string; source?: string }) =>
    api.post('/contacts/requests', body).then((r) => r.data),
  receivedRequests: () =>
    api.get<any[]>('/contacts/requests/received').then((r) => r.data),
  sentRequests: () => api.get<any[]>('/contacts/requests/sent').then((r) => r.data),
  decideContactRequest: (id: string, decision: 'accept' | 'reject') =>
    api.patch(`/contacts/requests/${id}`, { decision }).then((r) => r.data),
  cancelContactRequest: (id: string) =>
    api.delete(`/contacts/requests/${id}`).then((r) => r.data),
  contacts: () => api.get<ContactView[]>('/contacts').then((r) => r.data),
  removeContact: (profileId: string) =>
    api.delete(`/contacts/${profileId}`).then((r) => r.data),

  // §46, §47
  createTeamNeed: (body: Record<string, unknown>) =>
    api.post<TeamNeedView>('/team-needs', body).then((r) => r.data),
  openNeeds: () => api.get<TeamNeedView[]>('/team-needs').then((r) => r.data),
  myNeeds: () => api.get<TeamNeedView[]>('/team-needs/mine').then((r) => r.data),
  updateTeamNeed: (id: string, body: Record<string, unknown>) =>
    api.patch<TeamNeedView>(`/team-needs/${id}`, body).then((r) => r.data),
  teamSuggestions: (id: string) =>
    api.get<TeamSuggestionsView>(`/team-needs/${id}/suggestions`).then((r) => r.data),
  createTeam: (needId: string, name: string) =>
    api.post(`/team-needs/${needId}/team`, { name }).then((r) => r.data),
  myTeams: () => api.get<TeamView[]>('/teams/mine').then((r) => r.data),
  inviteToTeam: (teamId: string, invitedProfileId: string, message?: string) =>
    api.post(`/teams/${teamId}/invitations`, { invitedProfileId, message }).then((r) => r.data),
  myTeamInvitations: () => api.get<any[]>('/teams/invitations/mine').then((r) => r.data),
  decideTeamInvitation: (id: string, decision: 'accept' | 'decline') =>
    api.patch(`/teams/invitations/${id}`, { decision }).then((r) => r.data),

  // §42
  conversations: () => api.get<ConversationView[]>('/conversations').then((r) => r.data),
  openDirect: (profileId: string) =>
    api.post<ConversationView>('/conversations/direct', { profileId }).then((r) => r.data),
  messages: (id: string) =>
    api.get<MessageView[]>(`/conversations/${id}/messages`).then((r) => r.data),
  sendMessage: (id: string, body: string) =>
    api.post<MessageView>(`/conversations/${id}/messages`, { body }).then((r) => r.data),
};

/** Gamificación (§66). Los puntos reconocen hechos; no alimentan la afinidad. */
export interface GamificationSummary {
  totalPoints: number;
  eventsCount: number;
  note: string;
  badges: {
    code: string;
    name: string;
    description: string;
    trigger: string;
    triggerLabel: string;
    threshold: number;
    progress: number;
    earned: boolean;
    earnedAt: string | null;
  }[];
  events: {
    id: string;
    trigger: string;
    triggerLabel: string;
    points: number;
    reason: string;
    occurredAt: string;
  }[];
  rules: { trigger: string; label: string; points: number }[];
}

export interface TrajectorySectionOption {
  key: string;
  label: string;
}

export const gamificationService = {
  myProgress: () => api.get<GamificationSummary>('/gamification/me').then((r) => r.data),
};

export const trajectoryService = {
  sections: () =>
    api
      .get<{ sections: TrajectorySectionOption[]; disclaimer: string }>(
        '/trajectory-summary/sections',
      )
      .then((r) => r.data),
  preview: (sections: string[]) =>
    api
      .post<Record<string, unknown>>('/trajectory-summary/preview', { sections })
      .then((r) => r.data),
  /**
   * Descarga el PDF.
   *
   * Va como blob y no como un enlace directo porque la ruta exige la sesión, y
   * un `<a href>` no lleva la cabecera de autorización.
   */
  pdf: async (sections: string[]) => {
    const res = await api.get(`/trajectory-summary/pdf?sections=${sections.join(',')}`, {
      responseType: 'blob',
    });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const encontrado = /filename="([^"]+)"/.exec(disposition);
    return {
      blob: res.data as Blob,
      filename: encontrado?.[1] ?? 'resumen-trayectoria.pdf',
    };
  },
};

export const activityService = {
  list: (params?: Record<string, string>) =>
    api.get<Activity[]>('/activities', { params }).then((r) => r.data),
  get: (id: string) => api.get<Activity>(`/activities/${id}`).then((r) => r.data),
  create: (data: Partial<Activity> & { areaId?: string; activityDate?: string }) =>
    api.post<Activity>('/activities', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Activity>(`/activities/${id}`, data).then((r) => r.data),
  registerInterest: (id: string) => api.post(`/activities/${id}/register-interest`).then((r) => r.data),
  register: (id: string) => api.post(`/activities/${id}/register`).then((r) => r.data),
  /** Baja voluntaria, solo antes de que confirmen la participación (§23). */
  cancelRegistration: (id: string) =>
    api.post(`/activities/${id}/cancel-registration`).then((r) => r.data),
  confirm: (id: string, studentProfileId: string, status: string) =>
    api.patch(`/activities/${id}/confirm-participation`, { studentProfileId, status }).then((r) => r.data),
  participants: (id: string) => api.get<Participant[]>(`/activities/${id}/participants`).then((r) => r.data),
  /** Actividades que el usuario gestiona, incluidos sus borradores. */
  managed: () => api.get<Activity[]>('/activities/managed').then((r) => r.data),
  myRegistrations: () =>
    api.get<{ registrationId: string; status: string; activity: Activity }[]>('/activities/my-registrations')
      .then((r) => r.data),
};

export const projectService = {
  mine: () => api.get<Project[]>('/projects/my').then((r) => r.data),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post<Project>('/projects', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),
  /** Portafolio institucional que consulta el docente (RF15). */
  institutional: (params?: Record<string, string>) =>
    api.get<InstitutionalPortfolio>('/projects/institutional', { params }).then((r) => r.data),
  members: (id: string) => api.get<ProjectMemberItem[]>(`/projects/${id}/members`).then((r) => r.data),
};

/** Retroalimentación académica del docente sobre un proyecto (RF16). */
export const projectFeedbackService = {
  list: (projectId: string) =>
    api.get<ProjectFeedbackItem[]>(`/projects/${projectId}/feedback`).then((r) => r.data),
  create: (projectId: string, comment: string) =>
    api.post<ProjectFeedbackItem>(`/projects/${projectId}/feedback`, { comment }).then((r) => r.data),
  update: (projectId: string, feedbackId: string, comment: string) =>
    api
      .patch<ProjectFeedbackItem>(`/projects/${projectId}/feedback/${feedbackId}`, { comment })
      .then((r) => r.data),
};

/**
 * Subida de archivos (§27).
 *
 * Devuelve un identificador que después se adjunta a la evidencia o al
 * certificado. El servidor comprueba que quien lo adjunta es quien lo subió.
 */
export const uploadService = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<StoredFile>('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  /** URL absoluta para abrir o descargar un archivo ya subido. */
  fileUrl: (relative: string) => {
    const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/api$/, '');
    return `${base}${relative}`;
  },
};

/** Consulta del Motor de Validación (§26). */
export const validationService = {
  forResource: (resourceType: string, resourceId: string) =>
    api
      .get<ValidationVerdict>(`/validation/${resourceType}/${resourceId}`)
      .then((r) => r.data),
  queue: () => api.get('/validation/queue').then((r) => r.data),
};

/** Proyectos: contribución, respaldo y bitácora (§33 a §41). */
export const projectDetailService = {
  membersDetailed: (projectId: string) =>
    api
      .get<ProjectMemberDetailed[]>(`/projects/${projectId}/members/detailed`)
      .then((r) => r.data),
  /** §33: solo el propio integrante confirma lo que hizo. */
  confirmMyContribution: (
    projectId: string,
    data: { contribution?: string; role?: string; skillIds?: string[] },
  ) => api
    .put<ProjectMemberDetailed>(`/projects/${projectId}/my-contribution`, data)
    .then((r) => r.data),
  /** El responsable propone; retira la confirmación anterior. */
  proposeContribution: (
    projectId: string,
    memberId: string,
    data: { contribution?: string; role?: string },
  ) => api
    .patch<ProjectMemberDetailed>(`/projects/${projectId}/members/${memberId}/contribution`, data)
    .then((r) => r.data),
  checks: (projectId: string) =>
    api.get<ProjectChecks>(`/projects/${projectId}/checks`).then((r) => r.data),
  recheck: (projectId: string) =>
    api.post<ProjectChecks>(`/projects/${projectId}/checks/recheck`).then((r) => r.data),
  timeline: (projectId: string) =>
    api.get<ProjectEventItem[]>(`/projects/${projectId}/timeline`).then((r) => r.data),
};

export const evidenceService = {
  /** Evidencia autonoma: se asocia a proyecto, actividad o area segun corresponda. */
  create: (data: Record<string, unknown>) => api.post<Evidence>('/evidences', data).then((r) => r.data),
  mine: () => api.get<Evidence[]>('/evidences/my').then((r) => r.data),
  remove: (id: string) => api.delete(`/evidences/${id}`).then((r) => r.data),
  /** Alta desde el detalle de un proyecto (ruta historica, sigue vigente). */
  add: (projectId: string, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/evidences`, data).then((r) => r.data),
  removeFromProject: (projectId: string, evidenceId: string) =>
    api.delete(`/projects/${projectId}/evidences/${evidenceId}`).then((r) => r.data),
};

export const certificateService = {
  mine: () => api.get<ExternalCertificate[]>('/certificates/external/my').then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    api.post<ExternalCertificate>('/certificates/external', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<ExternalCertificate>(`/certificates/external/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/certificates/external/${id}`).then((r) => r.data),
};

export const constancyService = {
  /** Participantes confirmados de una actividad, marcando quien ya tiene constancia. */
  eligible: (activityId: string) =>
    api.get<EligibleParticipant[]>(`/constancies/internal/eligible/${activityId}`).then((r) => r.data),
  byActivity: (activityId: string) =>
    api.get<InternalConstancy[]>(`/constancies/internal/activity/${activityId}`).then((r) => r.data),
  create: (data: { profileId: string; activityId: string; description: string }) =>
    api.post<InternalConstancy>('/constancies/internal', data).then((r) => r.data),
  mine: () => api.get<InternalConstancy[]>('/constancies/internal/my').then((r) => r.data),
};

/** Un area dentro del resumen de afinidad (RF17). */


export interface AffinityArea {
  academicAreaId: string;
  area: string | null;
  /** AFFINITY_SCORE de §49: de 0 a 100. */
  score: number;
  /** Puntos crudos sobre 60, que es lo que suma el desglose (§52). */
  rawPoints: number;
  level: 'low' | 'medium' | 'high';
  /** SUPPORT_SCORE de §49: cuánta información trazable lo sostiene. */
  supportScore: number;
  supportLevel: 'low' | 'medium' | 'high';
  /** Familias independientes que respaldan el área (§54). */
  supportFamilies: string[];
  rank: number;
}

/**
 * RF17 define dos salidas distintas: mostrar las afinidades, o informar que
 * todavia no hay informacion suficiente. El estado viaja explicito para que la
 * interfaz no tenga que deducirlo de una lista vacia.
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

export interface AffinityContributionRow {
  signalFamily: string;
  signalType: string;
  weightCode: string;
  matchType: 'declared' | 'tag' | 'text' | 'inherited';
  sourceEntityType: string | null;
  /** Puntos que dictaba la regla antes de los rendimientos decrecientes. */
  rawPoints: number;
  /** Multiplicador aplicado por repetición dentro del área (§51). */
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
  contributions: AffinityContributionRow[];
  /** §91: lo que suma. */
  contributing: AffinityContributionRow[];
  /** §91: lo que se tuvo en cuenta y no suma. Suele ser la mitad que falta. */
  notContributing: AffinityContributionRow[];
}

export interface AffinitySnapshotView {
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

export interface AffinityWeightRow {
  code: string;
  signalType: string;
  points: number;
  label: string;
  description: string;
}

/**
 * Las reglas completas del motor (§51).
 *
 * No solo los pesos: tambien los topes, los rendimientos decrecientes y la
 * normalizacion. Mostrar unicamente los pesos daria una imagen incompleta,
 * porque el tope de un area cambia el resultado tanto como el peso.
 */
export interface AffinityEngineRules {
  engineVersion: number;
  maxRawPoints: number;
  caps: Record<string, number>;
  supportCaps: Record<string, number>;
  supportPoints: Record<string, number>;
  diminishing: Record<string, number[]>;
  levelThresholds: { LOW_MAX: number; MEDIUM_MAX: number };
  independentFamilies: string[];
  weights: AffinityWeightRow[];
}

export const affinityService = {
  mine: () => api.get<AffinityResult[]>('/affinity/me').then((r) => r.data),
  recalculateMine: () => api.post<AffinityResult[]>('/affinity/recalculate/me').then((r) => r.data),
  student: (studentId: string) => api.get<AffinityResult[]>(`/affinity/student/${studentId}`).then((r) => r.data),
  basicMap: () => api.get('/affinity/map/basic').then((r) => r.data),

  summary: () => api.get<AffinitySummary>('/affinity/me/summary').then((r) => r.data),
  breakdown: (areaId: string) =>
    api.get<AffinityBreakdown>(`/affinity/me/areas/${areaId}/breakdown`).then((r) => r.data),
  history: (limit = 10) =>
    api.get<AffinitySnapshotView[]>(`/affinity/me/history?limit=${limit}`).then((r) => r.data),
  weights: () => api.get<AffinityEngineRules>('/affinity/weights').then((r) => r.data),

  /** Consulta institucional: el backend aplica el alcance academico (RN-23). */
  studentSummary: (studentId: string) =>
    api.get<AffinitySummary>(`/affinity/student/${studentId}/summary`).then((r) => r.data),
  studentBreakdown: (studentId: string, areaId: string) =>
    api
      .get<AffinityBreakdown>(`/affinity/student/${studentId}/areas/${areaId}/breakdown`)
      .then((r) => r.data),
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
 * La Tabla 2.27 define tres resultados distintos: hay recomendaciones, el perfil
 * no tiene informacion suficiente (flujo 2a) o no hay coincidencias (flujo 3a).
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
  detail: Record<string, unknown> | null;
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

export const reportService = {
  teacherOverview: () => api.get('/reports/teacher/overview').then((r) => r.data),
  teacherAffinity: () => api.get('/reports/teacher/affinity-summary').then((r) => r.data),
  teacherProjects: () => api.get('/reports/teacher/projects-summary').then((r) => r.data),
  directorOverview: () => api.get('/reports/director/overview').then((r) => r.data),
  participationBySemester: () => api.get('/reports/director/participation-by-semester').then((r) => r.data),
  directorAffinityMap: () => api.get('/reports/director/affinity-map').then((r) => r.data),
  directorProjects: () => api.get('/reports/director/projects-summary').then((r) => r.data),
};

export const adminService = {
  listUsers: (search?: string) =>
    api.get<PublicUser[]>('/users', { params: search ? { search } : undefined }).then((r) => r.data),
  createUser: (data: Record<string, unknown>) => api.post<PublicUser>('/users', data).then((r) => r.data),
  updateUser: (id: string, data: Record<string, unknown>) =>
    api.patch<PublicUser>(`/users/${id}`, data).then((r) => r.data),
  /** Cambia el estado de la cuenta (§12). Reactivar una pendiente no es posible. */
  setStatus: (id: string, status: UserStatus) =>
    api.patch<PublicUser>(`/users/${id}/status`, { status }).then((r) => r.data),
  /** Semestre y código universitario de un estudiante (§17.1). */
  setInstitutionalData: (
    studentProfileId: string,
    data: { semester?: number; universityCode?: string },
  ) => api.patch(`/profiles/${studentProfileId}/institutional-data`, data).then((r) => r.data),
  resendActivation: (id: string) =>
    api
      .post<{ message: string; activationToken?: string }>(`/users/${id}/resend-activation`)
      .then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
  roles: () => api.get('/roles').then((r) => r.data),

  // Semestres habilitados para un docente (RF3)
  getSemesters: (teacherId: string) =>
    api.get<number[]>(`/users/${teacherId}/semesters`).then((r) => r.data),
  setSemesters: (teacherId: string, semesters: number[]) =>
    api.put<number[]>(`/users/${teacherId}/semesters`, { semesters }).then((r) => r.data),

  // Catalogos (RF4)
  createArea: (data: Record<string, unknown>) => api.post('/academic-areas', data).then((r) => r.data),
  updateArea: (id: string, data: Record<string, unknown>) =>
    api.patch(`/academic-areas/${id}`, data).then((r) => r.data),
  createSkill: (data: Record<string, unknown>) => api.post('/skills', data).then((r) => r.data),

  // Categorias de actividad (RF4)
  createActivityCategory: (data: Record<string, unknown>) =>
    api.post<ActivityCategoryItem>('/activity-categories', data).then((r) => r.data),
  updateActivityCategory: (id: string, data: Record<string, unknown>) =>
    api.patch<ActivityCategoryItem>(`/activity-categories/${id}`, data).then((r) => r.data),
  activityCategoryUsage: (id: string) =>
    api.get<{ activities: number }>(`/activity-categories/${id}/usage`).then((r) => r.data),
  updateSkill: (id: string, data: Record<string, unknown>) =>
    api.patch(`/skills/${id}`, data).then((r) => r.data),

  // Criterios de gamificacion: se administran ahora, los consumira una fase posterior
  listCriteria: () => api.get<GamificationCriterion[]>('/gamification-criteria').then((r) => r.data),
  createCriterion: (data: Record<string, unknown>) =>
    api.post<GamificationCriterion>('/gamification-criteria', data).then((r) => r.data),
  updateCriterion: (id: string, data: Record<string, unknown>) =>
    api.patch<GamificationCriterion>(`/gamification-criteria/${id}`, data).then((r) => r.data),
};
