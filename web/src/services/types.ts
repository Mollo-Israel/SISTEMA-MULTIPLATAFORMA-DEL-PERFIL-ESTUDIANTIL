export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive';
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

export interface AcademicArea {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
}

export interface Skill {
  id: string;
  name: string;
  academicAreaId: string | null;
  academicArea?: AcademicArea | null;
}

export interface StudentProfile {
  id: string;
  userId: string;
  universityCode: string | null;
  semester: number | null;
  bio: string | null;
  status: string;
  completionPercentage: number;
  improvementAreaIds: string[] | null;
}

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  type: string;
  category: string;
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

export interface ProfileSummary {
  profile: { id: string; semester: number | null; bio: string | null; status: string; completionPercentage: number };
  improvementAreas: { id: string; name: string }[];
  interests: { academicAreaId: string; area: string | null; priority: number }[];
  skills: { skillId: string; skill: string | null; level: number }[];
  projects: { id: string; title: string; status: string; technologies: string[] | null }[];
  evidences: unknown[];
  activities: { activityId: string; title: string | null; type: string | null; status: string }[];
  externalCertificates: { id: string; certificateName: string; issuer: string }[];
  internalConstancies: { id: string; description: string; status: string }[];
  affinities: { academicAreaId: string; area: string | null; score: number; level: string }[];
}
