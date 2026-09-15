import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Icon, TAB_ICON } from '../components/icons';
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
import RecommendationsScreen from '../screens/student/RecommendationsScreen';

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
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
};

/**
 * Icono de una pestaña. Se resuelve por el nombre de la ruta, de modo que
 * agregar una pestaña solo exige agregar su entrada en TAB_ICON.
 */
const tabIcon =
  (route: string) =>
  ({ color, size }: { color: string; size: number }) => (
    <Icon name={TAB_ICON[route] ?? 'circle'} size={size - 2} color={color} />
  );

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <Pressable onPress={logout} hitSlop={10} accessibilityLabel="Cerrar sesión">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 4 }}>
        <Icon name="log-out" size={15} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '600' }}>Salir</Text>
      </View>
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
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{ tabBarIcon: tabIcon('Inicio'), ...withLogout }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilStack}
        options={{ headerShown: false, tabBarIcon: tabIcon('Perfil') }}
      />
      <Tab.Screen
        name="Actividades"
        component={ActividadesStack}
        options={{ headerShown: false, tabBarIcon: tabIcon('Actividades') }}
      />
      <Tab.Screen
        name="Proyectos"
        component={ProyectosStack}
        options={{ headerShown: false, tabBarIcon: tabIcon('Proyectos') }}
      />
      {/* RF17 nombra la pantalla "Mis afinidades". La pestana conserva la
          etiqueta corta porque son cinco en la barra inferior. */}
      <Tab.Screen
        name="Afinidad"
        component={AffinityScreen}
        options={{ title: 'Mis afinidades', tabBarIcon: tabIcon('Afinidad'), ...withLogout }}
      />
      {/* RF18 nombra la pantalla "Recomendaciones". La pestana usa una
          etiqueta corta porque ya son seis en la barra inferior. */}
      <Tab.Screen
        name="Sugerencias"
        component={RecommendationsScreen}
        options={{ title: 'Recomendaciones', tabBarIcon: tabIcon('Sugerencias'), ...withLogout }}
      />
    </Tab.Navigator>
  );
}

function TeacherTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Actividades"
        component={TeacherActivities}
        options={{ tabBarIcon: tabIcon('Actividades'), ...withLogout }}
      />
      <Tab.Screen
        name="Estudiante"
        component={StudentSummary}
        options={{ tabBarIcon: tabIcon('Estudiante'), ...withLogout }}
      />
      <Tab.Screen
        name="Reporte"
        component={TeacherReport}
        options={{ tabBarIcon: tabIcon('Reporte'), ...withLogout }}
      />
      <Tab.Screen
        name="Próximamente"
        component={ComingSoonScreen}
        options={{ tabBarIcon: tabIcon('Próximamente'), ...withLogout }}
      />
    </Tab.Navigator>
  );
}

function SocietyTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Actividades"
        component={SocietyActivities}
        options={{ tabBarIcon: tabIcon('Actividades'), ...withLogout }}
      />
      <Tab.Screen
        name="Próximamente"
        component={ComingSoonScreen}
        options={{ tabBarIcon: tabIcon('Próximamente'), ...withLogout }}
      />
    </Tab.Navigator>
  );
}

function DirectorTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Dashboard"
        component={DirectorDashboard}
        options={{ tabBarIcon: tabIcon('Dashboard'), ...withLogout }}
      />
      <Tab.Screen
        name="Actividades"
        component={DirectorActivities}
        options={{ tabBarIcon: tabIcon('Actividades'), ...withLogout }}
      />
      <Tab.Screen
        name="Constancias"
        component={ConstanciesScreen}
        options={{ tabBarIcon: tabIcon('Constancias'), ...withLogout }}
      />
      <Tab.Screen
        name="Afinidad"
        component={AffinityMapScreen}
        options={{ tabBarIcon: tabIcon('Afinidad'), ...withLogout }}
      />
      <Tab.Screen
        name="Semestre"
        component={ParticipationScreen}
        options={{ tabBarIcon: tabIcon('Semestre'), ...withLogout }}
      />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Usuarios"
        component={AdminUsers}
        options={{ tabBarIcon: tabIcon('Usuarios'), ...withLogout }}
      />
      <Tab.Screen
        name="Áreas"
        component={AdminAreas}
        options={{ tabBarIcon: tabIcon('Áreas'), ...withLogout }}
      />
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
