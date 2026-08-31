import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RolNombre } from './constants';
import { HOME_BY_ROLE } from './navigation';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Loading } from './components/ui';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';

import StudentDashboard from './pages/student/Dashboard';
import StudentProfilePage from './pages/student/Profile';
import InterestsSkillsPage from './pages/student/InterestsSkills';
import StudentProjectsPage from './pages/student/Projects';
import StudentActivitiesPage from './pages/student/Activities';
import StudentAffinityPage from './pages/student/Affinity';

import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherActivitiesPage from './pages/teacher/Activities';
import TeacherStudentsPage from './pages/teacher/Students';
import TeacherReportsPage from './pages/teacher/Reports';

import DirectorDashboard from './pages/director/Dashboard';
import DirectorAffinityMap from './pages/director/AffinityMap';

import SocietyDashboard from './pages/society/Dashboard';
import SocietyActivitiesPage from './pages/society/Activities';

import AdminUsersPage from './pages/admin/Users';
import AdminRolesPage from './pages/admin/Roles';
import AdminAreasPage from './pages/admin/Areas';
import AdminSkillsPage from './pages/admin/Skills';
import AdminGamificationPage from './pages/admin/Gamification';

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
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<LandingPage />} />

          <Route element={guarded([S], <Layout />)}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<StudentProfilePage />} />
            <Route path="/student/interests" element={<InterestsSkillsPage />} />
            <Route path="/student/projects" element={<StudentProjectsPage />} />
            <Route path="/student/activities" element={<StudentActivitiesPage />} />
            <Route path="/student/affinity" element={<StudentAffinityPage />} />
          </Route>

          <Route element={guarded([T], <Layout />)}>
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/activities" element={<TeacherActivitiesPage />} />
            <Route path="/teacher/students" element={<TeacherStudentsPage />} />
            <Route path="/teacher/reports" element={<TeacherReportsPage />} />
          </Route>

          <Route element={guarded([D], <Layout />)}>
            <Route path="/director" element={<DirectorDashboard />} />
            <Route path="/director/affinity" element={<DirectorAffinityMap />} />
          </Route>

          <Route element={guarded([SC], <Layout />)}>
            <Route path="/society" element={<SocietyDashboard />} />
            <Route path="/society/activities" element={<SocietyActivitiesPage />} />
          </Route>

          <Route element={guarded([A], <Layout />)}>
            <Route path="/admin" element={<AdminUsersPage />} />
            <Route path="/admin/roles" element={<AdminRolesPage />} />
            <Route path="/admin/areas" element={<AdminAreasPage />} />
            <Route path="/admin/skills" element={<AdminSkillsPage />} />
            <Route path="/admin/gamification" element={<AdminGamificationPage />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
