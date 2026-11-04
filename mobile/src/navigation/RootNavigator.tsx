import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LibraryScreen from '../screens/student/LibraryScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useState } from 'react';
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
import WelcomeScreen from '../screens/student/WelcomeScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import TrajectoryScreen from '../screens/student/TrajectoryScreen';
import { notificationService } from '../services';
import { profileService } from '../services';
import { Loading } from '../components/ui';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.bordo },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '800' as const },
  headerShadowVisible: false,
  tabBarActiveTintColor: colors.bordo,
  tabBarInactiveTintColor: colors.gray500,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
  // V7: barra inferior como la de la web en el teléfono: blanca, redondeada
  // arriba y con sombra suave; la pestaña activa lleva una pastilla.
  tabBarStyle: {
    borderTopWidth: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.white,
    paddingTop: 6,
    shadowColor: colors.bordo,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
};

/**
 * Icono de una pestaña. Se resuelve por el nombre de la ruta, de modo que
 * agregar una pestaña solo exige agregar su entrada en TAB_ICON.
 */
const tabIcon =
  (route: string) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <View
      style={{
        width: 46,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.bordoBg : 'transparent',
      }}
    >
      <Icon name={TAB_ICON[route] ?? 'circle'} size={size - 3} color={color} />
    </View>
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
      <Stack.Screen name="Evidencias" component={EvidencesScreen} options={{ title: 'Credenciales y constancias' }} />
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
      {/* V3 §42 */}
      <Stack.Screen name="Trayectoria" component={TrajectoryScreen} options={{ title: 'Mi trayectoria' }} />
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
      {/* V6 §9.4: «Más sugerencias» se retiró; «Para ti» vive en Actividades. */}
      {/* V3.2 §35: la Biblioteca de recursos, como en la web. */}
      <Stack.Screen name="Biblioteca" component={LibraryScreen} options={{ title: 'Biblioteca' }} />
    </Stack.Navigator>
  );
}

function StudentTabs() {
  // Número de avisos sin leer en la pestaña: se consulta al entrar y cada minuto.
  const [noLeidas, setNoLeidas] = useState(0);
  const refrescar = useCallback(() => {
    notificationService.unreadCount().then((r) => setNoLeidas(r.unread)).catch(() => undefined);
  }, []);
  useEffect(() => {
    refrescar();
    const id = setInterval(refrescar, 60_000);
    return () => clearInterval(id);
  }, [refrescar]);
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
      {/* V3 §33: el centro de avisos. Las recomendaciones pasaron a «Para ti»
          dentro de Actividades (§34.2). */}
      <Tab.Screen
        name="Avisos"
        component={NotificationsScreen}
        options={{ title: 'Avisos', tabBarIcon: tabIcon('Avisos'), tabBarBadge: noLeidas > 0 ? (noLeidas > 99 ? '99+' : noLeidas) : undefined, ...withLogout }}
        listeners={{ focus: refrescar }}
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

/**
 * V7: lo que cada rol encuentra en la web, dicho en simple, para que quien
 * entra con una sesión antigua sepa a dónde ir. La regla no cambia: la app es
 * solo del Estudiante (V2 §67).
 */
const EN_LA_WEB: Record<string, { rol: string; cosas: string[] }> = {
  TEACHER: { rol: 'Docente', cosas: ['Ver a los estudiantes de tus semestres', 'Revisar sus proyectos', 'Organizar actividades', 'Reporte por semestre'] },
  CAREER_DIRECTOR: { rol: 'Dirección de carrera', cosas: ['Aprobar actividades', 'Revisar credenciales especiales', 'Ver la analítica de la carrera', 'Definir criterios de puntos'] },
  SCIENTIFIC_SOCIETY: { rol: 'Sociedad científica', cosas: ['Crear talleres y eventos', 'Ver inscritos y asistencia', 'Medir el alcance'] },
  ADMIN: { rol: 'Administración', cosas: ['Usuarios y padrón', 'Catálogos de áreas y categorías', 'Auditoría'] },
};

function SoloEstudiantes() {
  const { user, logout } = useAuth();
  const info = EN_LA_WEB[user?.role ?? ''];
  return (
    <Screen>
      <View style={{ backgroundColor: colors.bordo, borderRadius: 22, padding: 18, marginBottom: 14 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
          {(info?.rol ?? 'Tu rol').toUpperCase()}
        </Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 }}>
          ¡Hola{user?.firstName ? `, ${user.firstName}` : ''}!
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
          Esta app es para estudiantes. Lo tuyo te espera en la web, que también se adapta a tu celular.
        </Text>
      </View>
      <H1>App para estudiantes</H1>
      <Card title="Tu rol trabaja desde la web">
        <Muted>
          La aplicación móvil de Afinia es para estudiantes. Docentes, Dirección, sociedades
          científicas y Administración entran desde la versión web.
        </Muted>
        {info ? (
          <View style={{ marginTop: 10, gap: 6 }}>
            {info.cosas.map((c) => (
              <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="check-circle" size={15} color={colors.green} />
                <Text style={{ color: colors.gray700 }}>{c}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Pressable onPress={logout} style={{ marginTop: 14 }} accessibilityRole="button">
          <Text style={{ color: colors.bordo, fontWeight: '700' }}>Cerrar sesión</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}
