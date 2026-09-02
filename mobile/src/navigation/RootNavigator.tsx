import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import ComingSoonScreen from '../screens/ComingSoonScreen';

import HomeScreen from '../screens/student/HomeScreen';
import ProfileScreen from '../screens/student/ProfileScreen';
import InterestsScreen from '../screens/student/InterestsScreen';
import SkillsScreen from '../screens/student/SkillsScreen';
import EvidencesScreen from '../screens/student/EvidencesScreen';
import ActivitiesScreen from '../screens/student/ActivitiesScreen';
import MyActivitiesScreen from '../screens/student/MyActivitiesScreen';
import ProjectsScreen from '../screens/student/ProjectsScreen';
import ProjectDetailScreen from '../screens/student/ProjectDetailScreen';
import AffinityScreen from '../screens/student/AffinityScreen';

import TeacherActivities from '../screens/teacher/TeacherActivities';
import StudentSummary from '../screens/teacher/StudentSummary';
import TeacherReport from '../screens/teacher/TeacherReport';

import SocietyActivities from '../screens/society/SocietyActivities';

import DirectorDashboard from '../screens/director/DirectorDashboard';
import DirectorActivities from '../screens/director/DirectorActivities';
import ConstanciesScreen from '../screens/director/ConstanciesScreen';
import AffinityMapScreen from '../screens/director/AffinityMapScreen';
import ParticipationScreen from '../screens/director/ParticipationScreen';

import AdminUsers from '../screens/admin/AdminUsers';
import AdminAreas from '../screens/admin/AdminAreas';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.bordo },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
  tabBarActiveTintColor: colors.bordo,
  tabBarInactiveTintColor: colors.gray500,
};

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <Pressable onPress={logout} hitSlop={10}>
      <Text style={{ color: '#fff', fontWeight: '600', marginRight: 4 }}>Salir</Text>
    </Pressable>
  );
}

const withLogout = { headerRight: () => <LogoutButton /> };

function PerfilStack() {
  return (
    <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: true }}>
      <Stack.Screen name="MiPerfil" component={ProfileScreen} options={{ title: 'Perfil', ...withLogout }} />
      <Stack.Screen name="Intereses" component={InterestsScreen} options={{ title: 'Intereses' }} />
      <Stack.Screen name="Habilidades" component={SkillsScreen} options={{ title: 'Habilidades' }} />
      <Stack.Screen name="Evidencias" component={EvidencesScreen} options={{ title: 'Evidencias' }} />
    </Stack.Navigator>
  );
}

function ProyectosStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="MiPortafolio"
        component={ProjectsScreen}
        options={{ title: 'Portafolio', ...withLogout }}
      />
      <Stack.Screen
        name="DetalleProyecto"
        component={ProjectDetailScreen}
        options={{ title: 'Proyecto' }}
      />
    </Stack.Navigator>
  );
}

function ActividadesStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ListaActividades" component={ActivitiesScreen} options={{ title: 'Actividades', ...withLogout }} />
      <Stack.Screen name="MisActividades" component={MyActivitiesScreen} options={{ title: 'Mis actividades' }} />
    </Stack.Navigator>
  );
}

function StudentTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Inicio" component={HomeScreen} options={withLogout} />
      <Tab.Screen name="Perfil" component={PerfilStack} options={{ headerShown: false }} />
      <Tab.Screen name="Actividades" component={ActividadesStack} options={{ headerShown: false }} />
      <Tab.Screen name="Proyectos" component={ProyectosStack} options={{ headerShown: false }} />
      <Tab.Screen name="Afinidad" component={AffinityScreen} options={withLogout} />
    </Tab.Navigator>
  );
}

function TeacherTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Actividades" component={TeacherActivities} options={withLogout} />
      <Tab.Screen name="Estudiante" component={StudentSummary} options={withLogout} />
      <Tab.Screen name="Reporte" component={TeacherReport} options={withLogout} />
      <Tab.Screen name="Próximamente" component={ComingSoonScreen} options={withLogout} />
    </Tab.Navigator>
  );
}

function SocietyTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Actividades" component={SocietyActivities} options={withLogout} />
      <Tab.Screen name="Próximamente" component={ComingSoonScreen} options={withLogout} />
    </Tab.Navigator>
  );
}

function DirectorTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Dashboard" component={DirectorDashboard} options={withLogout} />
      <Tab.Screen name="Actividades" component={DirectorActivities} options={withLogout} />
      <Tab.Screen name="Constancias" component={ConstanciesScreen} options={withLogout} />
      <Tab.Screen name="Afinidad" component={AffinityMapScreen} options={withLogout} />
      <Tab.Screen name="Semestre" component={ParticipationScreen} options={withLogout} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Usuarios" component={AdminUsers} options={withLogout} />
      <Tab.Screen name="Áreas" component={AdminAreas} options={withLogout} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user } = useAuth();
  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }
  switch (user.role) {
    case 'STUDENT': return <StudentTabs />;
    case 'TEACHER': return <TeacherTabs />;
    case 'SCIENTIFIC_SOCIETY': return <SocietyTabs />;
    case 'CAREER_DIRECTOR': return <DirectorTabs />;
    case 'ADMIN': return <AdminTabs />;
    default: return <ComingSoonScreen />;
  }
}
