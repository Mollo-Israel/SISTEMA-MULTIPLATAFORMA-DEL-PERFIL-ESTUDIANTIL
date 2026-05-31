import { api } from '../api/client';

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
};

export const profileService = {
  getMine: () => api.get<any>('/profiles/me').then((r) => r.data),
  create: (data: any) => api.post('/profiles/me', data).then((r) => r.data),
  update: (data: any) => api.patch('/profiles/me', data).then((r) => r.data),
  summary: () => api.get<any>('/profiles/me/summary').then((r) => r.data),
  allowedView: (studentId: string) => api.get(`/profiles/${studentId}/allowed`).then((r) => r.data),
  setInterests: (items: { academicAreaId: string; priority: number }[]) =>
    api.put('/profiles/me/interests', { items }).then((r) => r.data),
  setSkills: (items: { skillId: string; level: number }[]) =>
    api.put('/profiles/me/skills', { items }).then((r) => r.data),
};

export const activityService = {
  list: (params?: Record<string, string>) => api.get<any[]>('/activities', { params }).then((r) => r.data),
  create: (data: any) => api.post('/activities', data).then((r) => r.data),
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

export const evidenceService = {
  add: (projectId: string, data: any) => api.post(`/projects/${projectId}/evidences`, data).then((r) => r.data),
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
