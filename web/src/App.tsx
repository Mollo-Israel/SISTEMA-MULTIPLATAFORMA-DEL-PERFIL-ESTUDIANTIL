import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
import StudentPrivacyPage from './pages/student/Privacy';
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
import DirectorLearningResourcesPage from './pages/director/LearningResources';
import DirectorTrendsPage from './pages/director/Trends';
import RecognitionsPage from './pages/staff/Recognitions';
import SocietyMetricsPage from './pages/society/Metrics';

import SocietyDashboard from './pages/society/Dashboard';
import SocietyActivitiesPage from './pages/society/Activities';

import AdminUsersPage from './pages/admin/Users';
import AdminImportsPage from './pages/admin/Imports';
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

function guarded(roles: string[], element: JSX.Element) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
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
          <Route
            element={
              <ProtectedRoute roles={[S]}>
                <OnboardingGate>
                  <Layout />
                </OnboardingGate>
              </ProtectedRoute>
            }
          >
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<StudentProfilePage />} />
            {/* Intereses y cuestionario viven ahora dentro de «Mi perfil». */}
            <Route path="/student/onboarding" element={<Navigate to="/student/profile?tab=cuestionario" replace />} />
            <Route path="/student/interests" element={<Navigate to="/student/profile?tab=intereses" replace />} />
            <Route path="/student/privacy" element={<StudentPrivacyPage />} />
            <Route path="/student/collaboration" element={<StudentCollaborationPage />} />
            <Route path="/student/progress" element={<StudentProgressPage />} />
            <Route path="/student/projects" element={<StudentProjectsPage />} />
            <Route path="/student/activities" element={<StudentActivitiesPage />} />
            <Route path="/student/evidences" element={<StudentEvidencesPage />} />
            <Route path="/student/affinity" element={<StudentAffinityPage />} />
            <Route path="/student/recommendations" element={<StudentRecommendationsPage />} />
          </Route>

          <Route element={guarded([T], <Layout />)}>
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/activities" element={<TeacherActivitiesPage />} />
            <Route path="/teacher/my-activities" element={<TeacherMyActivitiesPage />} />
            <Route path="/teacher/students" element={<TeacherStudentsPage />} />
            <Route path="/teacher/projects" element={<TeacherStudentProjectsPage />} />
            <Route path="/teacher/reports" element={<TeacherReportsPage />} />
            <Route path="/teacher/recognitions" element={<RecognitionsPage />} />
          </Route>

          <Route element={guarded([D], <Layout />)}>
            <Route path="/director" element={<DirectorDashboard />} />
            <Route path="/director/activities" element={<DirectorActivitiesPage />} />
            <Route path="/director/constancies" element={<DirectorConstanciesPage />} />
            <Route path="/director/affinity" element={<DirectorAffinityMap />} />
            <Route path="/director/resources" element={<DirectorLearningResourcesPage />} />
            <Route path="/director/trends" element={<DirectorTrendsPage />} />
            <Route path="/director/recognitions" element={<RecognitionsPage />} />
          </Route>

          <Route element={guarded([SC], <Layout />)}>
            <Route path="/society" element={<SocietyDashboard />} />
            <Route path="/society/activities" element={<SocietyActivitiesPage />} />
            <Route path="/society/metrics" element={<SocietyMetricsPage />} />
          </Route>

          <Route element={guarded([A], <Layout />)}>
            <Route path="/admin" element={<AdminUsersPage />} />
            <Route path="/admin/imports" element={<AdminImportsPage />} />
            <Route path="/admin/mail" element={<AdminMailPage />} />
            <Route path="/admin/areas" element={<AdminAreasSkillsPage />} />
            <Route path="/admin/skills" element={<Navigate to="/admin/areas?tab=skills" replace />} />
            <Route path="/admin/activity-categories" element={<AdminActivityCategoriesPage />} />
            <Route path="/admin/gamification" element={<AdminGamificationPage />} />
            <Route path="/admin/recognitions" element={<RecognitionsPage />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
