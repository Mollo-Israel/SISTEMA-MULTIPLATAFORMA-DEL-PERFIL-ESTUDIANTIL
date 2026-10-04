import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Icon, TAB_ICON } from '../components/icons';
import { Screen, Card, H1, Muted } from '../components/ui';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';

import HomeScreen from '../screens/student/HomeScreen';
import ProfileScreen from '../screens/student/ProfileScreen';
import CollaborationScreen from '../screens/student/CollaborationScreen';
import ProgressScreen from '../screens/student/ProgressScreen';
import InterestsScreen from '../screens/student/InterestsScreen';
import SkillsScreen from '../screens/student/SkillsScreen';
import EvidencesScreen from '../screens/student/EvidencesScreen';
import ActivitiesScreen from '../screens/student/ActivitiesScreen';
import MyActivitiesScreen from '../screens/student/MyActivitiesScreen';
import ProjectsScreen from '../screens/student/ProjectsScreen';
import ProjectDetailScreen from '../screens/student/ProjectDetailScreen';
import AffinityScreen from '../screens/student/AffinityScreen';
import RecommendationsScreen from '../screens/student/RecommendationsScreen';
import WelcomeScreen from '../screens/student/WelcomeScreen';
import { profileService } from '../services';
import { Loading } from '../components/ui';

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
      <Stack.Screen name="Habilidades" component={SkillsScreen} options={{ title: 'Tecnologías' }} />
      <Stack.Screen name="Evidencias" component={EvidencesScreen} options={{ title: 'Evidencias' }} />
      <Stack.Screen
        name="Colaboracion"
        component={CollaborationScreen}
        options={{ title: 'Colaboración' }}
      />
      <Stack.Screen
        name="Progreso"
        component={ProgressScreen}
        options={{ title: 'Mi progreso' }}
      />
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

/**
 * La app del estudiante empieza por la bienvenida (correcciones de QA): hasta
 * terminarla no ve las pestañas, igual que en la web. Si la consulta falla, no
 * lo encierra: deja pasar y la bienvenida se le ofrecerá en la próxima sesión.
 */
function StudentGate() {
  const [estado, setEstado] = useState<'cargando' | 'bienvenida' | 'listo'>('cargando');
  useEffect(() => {
    profileService
      .onboarding()
      .then((s) => setEstado(s.completed ? 'listo' : 'bienvenida'))
      .catch(() => setEstado('listo'));
  }, []);
  if (estado === 'cargando') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.gray50 }}>
        <Loading />
      </View>
    );
  }
  if (estado === 'bienvenida') {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="Bienvenida" options={{ title: 'Bienvenida' }}>
          {() => <WelcomeScreen onDone={() => setEstado('listo')} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }
  return <StudentTabs />;
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
  // V2 §67: la app es solo del Estudiante. La API ya rechaza el inicio de
  // sesión de otros roles desde el móvil; esto cubre una sesión antigua.
  return user.role === 'STUDENT' ? <StudentGate /> : <SoloEstudiantes />;
}

function SoloEstudiantes() {
  const { logout } = useAuth();
  return (
    <Screen>
      <H1>App para estudiantes</H1>
      <Card title="Tu rol trabaja desde la web">
        <Muted>
          La aplicación móvil de Afinia es para estudiantes. Docentes, Dirección, sociedades
          científicas y Administración entran desde la versión web.
        </Muted>
        <Pressable onPress={logout} style={{ marginTop: 14 }} accessibilityRole="button">
          <Text style={{ color: colors.bordo, fontWeight: '700' }}>Cerrar sesión</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}
