import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RolNombre } from './constants';
import { HOME_BY_ROLE } from './navigation';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Loading } from './components/ui';
import { ConfirmProvider, ToastProvider } from './components/feedback';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import PublicProfilePage from './pages/PublicProfile';
import SetPasswordPage from './pages/auth/SetPasswordPage';
import RequestTokenPage from './pages/auth/RequestTokenPage';

import StudentDashboard from './pages/student/Dashboard';
import StudentProfilePage from './pages/student/Profile';
import WelcomeWizard from './pages/student/Welcome';
import OnboardingGate from './components/OnboardingGate';
import StudentCollaborationPage from './pages/student/Collaboration';
import StudentProgressPage from './pages/student/Progress';
import StudentProjectsPage from './pages/student/Projects';
import StudentActivitiesPage from './pages/student/Activities';
import StudentAffinityPage from './pages/student/Affinity';
import StudentRecommendationsPage from './pages/student/Recommendations';
import StudentEvidencesPage from './pages/student/Evidences';

import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherActivitiesPage from './pages/teacher/Activities';
import TeacherMyActivitiesPage from './pages/teacher/MyActivities';
import TeacherStudentsPage from './pages/teacher/Students';
import TeacherReportsPage from './pages/teacher/Reports';
import TeacherStudentProjectsPage from './pages/teacher/StudentProjects';

import DirectorDashboard from './pages/director/Dashboard';
import DirectorAffinityMap from './pages/director/AffinityMap';
import DirectorActivitiesPage from './pages/director/Activities';
import DirectorConstanciesPage from './pages/director/Constancies';
import DirectorApprovalsPage from './pages/director/Approvals';
import AdminAuditPage from './pages/admin/Audit';
import HelpPage from './pages/help/Help';
import TeacherTeamNeedsPage from './pages/teacher/TeamNeeds';
import DirectorLearningResourcesPage from './pages/director/LearningResources';
import DirectorTrendsPage from './pages/director/Trends';
import CredentialReviewsPage from './pages/director/CredentialReviews';
import RecognitionsPage from './pages/staff/Recognitions';
import SocietyMetricsPage from './pages/society/Metrics';

import SocietyDashboard from './pages/society/Dashboard';
import SocietyActivitiesPage from './pages/society/Activities';

import AdminUsersPage from './pages/admin/Users';
import AdminImportsPage from './pages/admin/Imports';
import AdminActivitiesPage from './pages/admin/Activities';
import AdminMailPage from './pages/admin/Mail';
import AdminAreasSkillsPage from './pages/admin/AreasSkills';
import AdminGamificationPage from './pages/admin/Gamification';
import AdminActivityCategoriesPage from './pages/admin/ActivityCategories';

const S = RolNombre.STUDENT;
const T = RolNombre.TEACHER;
const D = RolNombre.CAREER_DIRECTOR;
const SC = RolNombre.SCIENTIFIC_SOCIETY;
const A = RolNombre.ADMIN;

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Cargando…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[user.role] ?? '/login'} replace />;
}

/**
 * Guarda de rol dentro del marco común: deja pasar o redirige al inicio del
 * rol, sin desmontar el menú ni la barra.
 */
function RoleGate({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role] ?? '/login'} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    // V2 §66.3: con «reducir movimiento» del sistema, framer-motion no anima
    // (el CSS ya lo respetaba), y por omisión las transiciones duran 180 ms.
    <MotionConfig reducedMotion="user" transition={{ duration: 0.18 }}>
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<LandingPage />} />
          {/* §43: el perfil compartible es la única pantalla sin sesión. Un QR
              que exigiera iniciar sesión no serviría para lo que existe. */}
          <Route path="/p/:slug" element={<PublicProfilePage />} />

          {/* Activación y recuperación: públicas por necesidad (§12, §13). */}
          <Route path="/activar" element={<SetPasswordPage mode="activate" />} />
          <Route path="/activar/solicitar" element={<RequestTokenPage mode="activation" />} />
          <Route path="/recuperar" element={<RequestTokenPage mode="reset" />} />
          <Route path="/restablecer" element={<SetPasswordPage mode="reset" />} />

          {/* La bienvenida va a pantalla completa, fuera del menú: hasta
              terminarla, el estudiante no ve el resto del sistema. */}
          <Route
            path="/student/bienvenida"
            element={
              <ProtectedRoute roles={[S]}>
                <WelcomeWizard />
              </ProtectedRoute>
            }
          />
          {/* Un solo marco (menú y barra superior) para todas las rutas con
              sesión. Antes cada rol tenía el suyo y pasar a «Ayuda» lo
              desmontaba y volvía a montar entero: otro parpadeo. Dentro, una
              guarda por rol que no toca el marco. */}
          <Route
            element={
              <ProtectedRoute roles={[S, T, D, SC, A]}>
                <Layout />
              </ProtectedRoute>
            }
          >
          <Route element={<RoleGate roles={[S]}><OnboardingGate><Outlet /></OnboardingGate></RoleGate>}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<StudentProfilePage />} />
            {/* Intereses y cuestionario viven ahora dentro de «Mi perfil». */}
            <Route path="/student/onboarding" element={<Navigate to="/student/profile?tab=intereses" replace />} />
            <Route path="/student/interests" element={<Navigate to="/student/profile?tab=intereses" replace />} />
            <Route path="/student/privacy" element={<Navigate to="/student/profile?tab=visibilidad" replace />} />
            <Route path="/student/collaboration" element={<StudentCollaborationPage />} />
            <Route path="/student/progress" element={<StudentProgressPage />} />
            <Route path="/student/projects" element={<StudentProjectsPage />} />
            <Route path="/student/activities" element={<StudentActivitiesPage />} />
            <Route path="/student/evidences" element={<StudentEvidencesPage />} />
            <Route path="/student/affinity" element={<StudentAffinityPage />} />
            <Route path="/student/recommendations" element={<StudentRecommendationsPage />} />
          </Route>

          <Route element={<RoleGate roles={[T]}><Outlet /></RoleGate>}>
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/activities" element={<TeacherActivitiesPage />} />
            <Route path="/teacher/my-activities" element={<TeacherMyActivitiesPage />} />
            <Route path="/teacher/students" element={<TeacherStudentsPage />} />
            <Route path="/teacher/projects" element={<TeacherStudentProjectsPage />} />
            <Route path="/teacher/reports" element={<TeacherReportsPage />} />
            <Route path="/teacher/team-needs" element={<TeacherTeamNeedsPage />} />
            <Route path="/teacher/recognitions" element={<RecognitionsPage />} />
          </Route>

          <Route element={<RoleGate roles={[D]}><Outlet /></RoleGate>}>
            <Route path="/director" element={<DirectorDashboard />} />
            <Route path="/director/activities" element={<DirectorActivitiesPage />} />
            <Route path="/director/constancies" element={<DirectorConstanciesPage />} />
            <Route path="/director/approvals" element={<DirectorApprovalsPage />} />
            <Route path="/director/affinity" element={<DirectorAffinityMap />} />
            <Route path="/director/resources" element={<DirectorLearningResourcesPage />} />
            <Route path="/director/trends" element={<DirectorTrendsPage />} />
            <Route path="/director/credential-reviews" element={<CredentialReviewsPage />} />
            <Route path="/director/recognitions" element={<RecognitionsPage />} />
          </Route>

          <Route element={<RoleGate roles={[SC]}><Outlet /></RoleGate>}>
            <Route path="/society" element={<SocietyDashboard />} />
            <Route path="/society/activities" element={<SocietyActivitiesPage />} />
            <Route path="/society/metrics" element={<SocietyMetricsPage />} />
          </Route>

          <Route element={<RoleGate roles={[A]}><Outlet /></RoleGate>}>
            <Route path="/admin" element={<AdminUsersPage />} />
            <Route path="/admin/imports" element={<AdminImportsPage />} />
            <Route path="/admin/activities" element={<AdminActivitiesPage />} />
            <Route path="/admin/mail" element={<AdminMailPage />} />
            <Route path="/admin/areas" element={<AdminAreasSkillsPage />} />
            <Route path="/admin/skills" element={<Navigate to="/admin/areas?tab=skills" replace />} />
            <Route path="/admin/activity-categories" element={<AdminActivityCategoriesPage />} />
            <Route path="/admin/gamification" element={<AdminGamificationPage />} />
            <Route path="/admin/recognitions" element={<RecognitionsPage />} />
            <Route path="/admin/resources" element={<DirectorLearningResourcesPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
          </Route>

          {/* V2 §65: la ayuda es de todos los actores. */}
          <Route path="/ayuda" element={<HelpPage />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
    </MotionConfig>
  );
}
