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
  user: PublicUser;
}

export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthResult>('/auth/login', { email, password }).then((r) => r.data),
  register: (data: { firstName: string; lastName: string; email: string; password: string }) =>
    api.post<AuthResult>('/auth/register', data).then((r) => r.data),
  me: () => api.get<PublicUser>('/auth/me').then((r) => r.data),
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
  setSkills: (items: { skillId: string; level: number }[]) =>
    api.put('/profiles/me/skills', { items }).then((r) => r.data),
};

export const activityService = {
  list: (params?: Record<string, string>) => api.get<any[]>('/activities', { params }).then((r) => r.data),
  /** Detalle: para el estudiante incluye su propio estado y si puede inscribirse. */
  get: (id: string) => api.get<any>(`/activities/${id}`).then((r) => r.data),
  /** Actividades que el usuario gestiona, incluidos sus borradores. */
  managed: () => api.get<any[]>('/activities/managed').then((r) => r.data),
  myRegistrations: () => api.get<any[]>('/activities/my-registrations').then((r) => r.data),
  create: (data: any) => api.post('/activities', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch(`/activities/${id}`, data).then((r) => r.data),
  registerInterest: (id: string) => api.post(`/activities/${id}/register-interest`).then((r) => r.data),
  register: (id: string) => api.post(`/activities/${id}/register`).then((r) => r.data),
  confirm: (id: string, studentProfileId: string, status: string) =>
    api.patch(`/activities/${id}/confirm-participation`, { studentProfileId, status }).then((r) => r.data),
  participants: (id: string) => api.get<any[]>(`/activities/${id}/participants`).then((r) => r.data),
};

export const projectService = {
  /** Portafolio del estudiante: propios y aquellos donde es integrante aceptado. */
  mine: () => api.get<any[]>('/projects/my').then((r) => r.data),
  get: (id: string) => api.get<any>(`/projects/${id}`).then((r) => r.data),
  create: (data: any) => api.post<any>('/projects', data).then((r) => r.data),
  update: (id: string, data: any) => api.patch<any>(`/projects/${id}`, data).then((r) => r.data),
  members: (id: string) => api.get<any[]>(`/projects/${id}/members`).then((r) => r.data),
  removeMember: (id: string, memberId: string) =>
    api.delete(`/projects/${id}/members/${memberId}`).then((r) => r.data),
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
export interface StoredFile {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

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
};

export const constancyService = {
  mine: () => api.get<any[]>('/constancies/internal/my').then((r) => r.data),
  eligible: (activityId: string) =>
    api.get<any[]>(`/constancies/internal/eligible/${activityId}`).then((r) => r.data),
  byActivity: (activityId: string) =>
    api.get<any[]>(`/constancies/internal/activity/${activityId}`).then((r) => r.data),
  create: (data: { profileId: string; activityId: string; description: string }) =>
    api.post<any>('/constancies/internal', data).then((r) => r.data),
};

/** Un area dentro del resumen de afinidad (RF17). */
export interface AffinityArea {
  academicAreaId: string;
  area: string | null;
  score: number;
  level: 'low' | 'medium' | 'high';
  rank: number;
  /** Peso relativo respecto al area mas fuerte del propio estudiante. */
  share: number;
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
  signalsCount: number;
  totalScore: number;
  areas: AffinityArea[];
}

/** Una linea del desglose: que sumo y por que. */
export interface AffinityContribution {
  signalType: string;
  weightCode: string;
  matchType: 'declared' | 'tag' | 'text' | 'inherited';
  points: number;
  sourceLabel: string;
  sourceId: string | null;
}

export interface AffinityBreakdown {
  academicAreaId: string;
  area: string;
  score: number;
  level: 'low' | 'medium' | 'high' | null;
  contributions: AffinityContribution[];
}

export interface AffinitySnapshot {
  id: string;
  calculatedAt: string;
  status: 'calculated' | 'insufficient_data';
  totalScore: number;
  areasCount: number;
  signalsCount: number;
  rulesVersion: string;
  areas: { academicAreaId: string; area: string | null; score: number; level: string; rank: number }[];
}

export interface AffinityWeight {
  code: string;
  signalType: string;
  points: number;
  label: string;
  description: string;
}

export const affinityService = {
  mine: () => api.get<any[]>('/affinity/me').then((r) => r.data),
  recalculateMine: () => api.post<any[]>('/affinity/recalculate/me').then((r) => r.data),
  student: (studentId: string) => api.get<any[]>(`/affinity/student/${studentId}`).then((r) => r.data),
  summary: () => api.get<AffinitySummary>('/affinity/me/summary').then((r) => r.data),
  breakdown: (areaId: string) =>
    api.get<AffinityBreakdown>(`/affinity/me/areas/${areaId}/breakdown`).then((r) => r.data),
  history: (limit = 10) =>
    api.get<AffinitySnapshot[]>(`/affinity/me/history?limit=${limit}`).then((r) => r.data),
  weights: () => api.get<AffinityWeight[]>('/affinity/weights').then((r) => r.data),
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

export const reportService = {
  teacherOverview: () => api.get('/reports/teacher/overview').then((r) => r.data),
  directorOverview: () => api.get('/reports/director/overview').then((r) => r.data),
  participationBySemester: () => api.get('/reports/director/participation-by-semester').then((r) => r.data),
  directorAffinityMap: () => api.get('/reports/director/affinity-map').then((r) => r.data),
};

export const adminService = {
  listUsers: () => api.get<PublicUser[]>('/users').then((r) => r.data),
};
