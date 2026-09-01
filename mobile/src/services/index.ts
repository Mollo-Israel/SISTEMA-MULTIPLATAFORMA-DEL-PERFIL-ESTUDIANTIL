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
  mine: () => api.get<any[]>('/projects/my').then((r) => r.data),
  create: (data: any) => api.post<any>('/projects', data).then((r) => r.data),
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

export const affinityService = {
  mine: () => api.get<any[]>('/affinity/me').then((r) => r.data),
  recalculateMine: () => api.post<any[]>('/affinity/recalculate/me').then((r) => r.data),
  student: (studentId: string) => api.get<any[]>(`/affinity/student/${studentId}`).then((r) => r.data),
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
