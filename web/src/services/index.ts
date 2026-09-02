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
  register: (data: { firstName: string; lastName: string; email: string; password: string }) =>
    api.post<AuthResult>('/auth/register', data).then((r) => r.data),
  me: () => api.get<PublicUser>('/auth/me').then((r) => r.data),
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
  setSkills: (items: { skillId: string; level: number }[]) =>
    api.put('/profiles/me/skills', { items }).then((r) => r.data),
};

export const catalogService = {
  areas: () => api.get<AcademicArea[]>('/academic-areas').then((r) => r.data),
  skills: () => api.get<Skill[]>('/skills').then((r) => r.data),
  /** Catálogo administrable de categorías de actividad (RF4). */
  activityCategories: () =>
    api.get<ActivityCategoryItem[]>('/activity-categories').then((r) => r.data),
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

/** Subida de archivos de evidencia. Devuelve la referencia a persistir. */
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

export const affinityService = {
  mine: () => api.get<AffinityResult[]>('/affinity/me').then((r) => r.data),
  recalculateMine: () => api.post<AffinityResult[]>('/affinity/recalculate/me').then((r) => r.data),
  student: (studentId: string) => api.get<AffinityResult[]>(`/affinity/student/${studentId}`).then((r) => r.data),
  basicMap: () => api.get('/affinity/map/basic').then((r) => r.data),
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
  setActive: (id: string, active: boolean) =>
    api.patch<PublicUser>(`/users/${id}/status`, { active }).then((r) => r.data),
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
