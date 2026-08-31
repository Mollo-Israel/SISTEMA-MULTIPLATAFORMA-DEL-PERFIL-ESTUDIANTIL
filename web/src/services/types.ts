export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive';
  role: string;
  createdAt: string;
  updatedAt: string;
  /** Solo para usuarios con rol docente. */
  semesters?: number[];
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
  isActive: boolean;
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
  interests: { academicAreaId: string; area: string | null; priority: number }[];
  skills: { skillId: string; skill: string | null; level: number }[];
  projects: { id: string; title: string; status: string; technologies: string[] | null }[];
  evidences: unknown[];
  activities: { activityId: string; title: string | null; type: string | null; status: string }[];
  externalCertificates: { id: string; certificateName: string; issuer: string }[];
  internalConstancies: { id: string; description: string; status: string }[];
  affinities: { academicAreaId: string; area: string | null; score: number; level: string }[];
}

/** Referencia devuelta por POST /uploads. */
export interface StoredFile {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
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
