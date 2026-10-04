import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { catalogService, profileService } from '../../services';
import { Button, Card, Chip, ErrorText, Field, FadeIn, Muted, Screen, SkeletonCards } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { colors } from '../../theme';

type Paso = 'welcome' | 'profile' | 'interests' | 'improvement' | 'availability' | 'done';
const ORDEN: Paso[] = ['welcome', 'profile', 'interests', 'improvement', 'availability', 'done'];

const DISPONIBILIDAD = [
  { value: 'looking', label: 'Busco equipo' },
  { value: 'open', label: 'Escucho propuestas' },
  { value: 'busy', label: 'Sin tiempo ahora' },
  { value: 'unspecified', label: 'Prefiero no decirlo' },
] as const;

/**
 * Bienvenida en el móvil (V2 §20).
 *
 * Los mismos pasos obligatorios que la web y que exige el servidor (§20.2):
 * confirmar datos institucionales, al menos un interés o área de mejora,
 * decidir la disponibilidad y revisar la privacidad. Las tecnologías de
 * interés y la orientación (opcionales) se completan después desde «Perfil».
 */
export default function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [paso, setPaso] = useState<Paso>('welcome');
  const [cargando, setCargando] = useState(true);
  const [areas, setAreas] = useState<any[]>([]);
  const [semestre, setSemestre] = useState<number | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [intereses, setIntereses] = useState<string[]>([]);
  const [mejorar, setMejorar] = useState<string[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<string | null>(null);
  const [descubrible, setDescubrible] = useState(true);
  const [compartible, setCompartible] = useState(false);
  const [faltan, setFaltan] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    Promise.all([
      catalogService.areas(),
      profileService.onboarding(),
      profileService.getMine().catch(() => null),
      profileService.summary().catch(() => null),
    ])
      .then(([a, estado, perfil, resumen]) => {
        setAreas(a.filter((x: any) => x.isActive !== false));
        setSemestre(estado.semester ?? null);
        setCodigo(estado.universityCode ?? null);
        setFaltan(estado.missing ?? []);
        if (perfil) {
          setBio(perfil.bio ?? '');
          setMejorar(perfil.improvementAreaIds ?? []);
          if (estado.availabilityDecided) setDisponibilidad(perfil.availability ?? 'unspecified');
          setDescubrible(perfil.peerDiscoverable ?? true);
          setCompartible(perfil.publicProfileEnabled ?? false);
        }
        const previos = resumen?.preferredAreas ?? resumen?.interests ?? [];
        setIntereses(previos.map((i: any) => i.academicAreaId));
        if (estado.institutionalConfirmed) setPaso('interests');
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternar = (lista: string[], set: (v: string[]) => void, id: string) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const correr = async (accion: () => Promise<void>, siguiente: Paso) => {
    setError(null);
    setGuardando(true);
    try {
      await accion();
      await profileService.saveOnboardingStep(siguiente === 'done' ? 'questionnaire' : siguiente).catch(() => {});
      setPaso(siguiente);
    } catch (e) {
      setError(e instanceof Error && !(e as any).isAxiosError ? e.message : apiError(e));
    } finally {
      setGuardando(false);
    }
  };

  const confirmarDatos = () =>
    correr(async () => {
      if (bio.trim().length > 1000) throw new Error('Tu presentación no puede superar 1000 caracteres.');
      await profileService.confirmInstitutional(bio.trim() || undefined);
    }, 'interests');

  const guardarIntereses = () =>
    correr(async () => {
      await profileService.setPreferredAreas(intereses.map((id) => ({ academicAreaId: id, priority: 3 })));
    }, 'improvement');

  const guardarMejora = () =>
    correr(async () => {
      if (intereses.length + mejorar.length === 0) {
        throw new Error('Elige al menos un interés o un área que quieras mejorar.');
      }
      await profileService.update({ improvementAreaIds: mejorar });
    }, 'availability');

  const terminar = () =>
    correr(async () => {
      if (!disponibilidad) throw new Error('Elige tu disponibilidad (puedes elegir «Prefiero no decirlo»).');
      await profileService.update({ availability: disponibilidad });
      await profileService.onboardingPrivacy({ peerDiscoverable: descubrible, publicProfileEnabled: compartible });
      try {
        await profileService.completeOnboarding();
      } catch (e) {
        const estado = await profileService.onboarding().catch(() => null);
        if (estado) setFaltan(estado.missing);
        throw e;
      }
    }, 'done');

  const indice = ORDEN.indexOf(paso);

  return (
    <Screen>
      <View style={styles.dots}>
        {ORDEN.map((p, i) => (
          <View key={p} style={[styles.dot, i <= indice && styles.dotOn]} />
        ))}
      </View>

      {cargando ? (
        <SkeletonCards count={2} />
      ) : (
        <FadeIn key={paso}>
          {paso === 'welcome' && (
            <Card>
              <Text style={styles.big}>¡Hola, {user?.firstName}! 👋</Text>
              <Muted>
                Cuatro pasos cortos y Afinia podrá sugerirte actividades, cursos y compañeros que encajen
                contigo. Todo se puede cambiar después.
              </Muted>
              <View style={{ marginTop: 14 }}>
                <Button icon="arrow-right" title="Empezar" onPress={() => setPaso('profile')} />
              </View>
            </Card>
          )}

          {paso === 'profile' && (
            <Card title="1 · ¿Son correctos tus datos?">
              <Muted>Los registró la universidad. Si algo no es correcto, avisa a la administración.</Muted>
              <View style={styles.facts}>
                <Fact label="Nombre" value={user ? `${user.firstName} ${user.lastName}` : '—'} />
                <Fact label="Semestre" value={semestre ? `${semestre}º` : 'Sin asignar'} />
                <Fact label="Código universitario" value={codigo ?? 'Sin asignar'} />
              </View>
              <Field
                label="Preséntate en una línea (opcional)"
                value={bio}
                onChangeText={setBio}
                placeholder="Me gusta construir apps y aprender de datos."
                multiline
              />
              {error && <ErrorText message={error} />}
              <View style={{ marginTop: 12 }}>
                <Button icon="check" title="Mis datos son correctos" loading={guardando} onPress={confirmarDatos} />
              </View>
            </Card>
          )}

          {paso === 'interests' && (
            <Card title="2 · ¿Qué te interesa?">
              <Muted>Marca las áreas que te llaman la atención.</Muted>
              <View style={[styles.chips, { marginTop: 10 }]}>
                {areas.map((a) => (
                  <Chip key={a.id} label={a.name} on={intereses.includes(a.id)} onPress={() => alternar(intereses, setIntereses, a.id)} />
                ))}
              </View>
              {error && <ErrorText message={error} />}
              <View style={{ marginTop: 12, gap: 8 }}>
                <Button icon="arrow-right" title="Siguiente" loading={guardando} onPress={guardarIntereses} />
                <Button variant="secondary" title="Atrás" onPress={() => setPaso('profile')} />
              </View>
            </Card>
          )}

          {paso === 'improvement' && (
            <Card title="3 · ¿Qué quieres mejorar?">
              <Muted>Te recomendaremos cursos y actividades para crecer en estas áreas.</Muted>
              <View style={[styles.chips, { marginTop: 10 }]}>
                {areas.map((a) => (
                  <Chip key={a.id} label={a.name} on={mejorar.includes(a.id)} onPress={() => alternar(mejorar, setMejorar, a.id)} />
                ))}
              </View>
              {error && <ErrorText message={error} />}
              <View style={{ marginTop: 12, gap: 8 }}>
                <Button icon="arrow-right" title="Siguiente" loading={guardando} onPress={guardarMejora} />
                <Button variant="secondary" title="Atrás" onPress={() => setPaso('interests')} />
              </View>
            </Card>
          )}

          {paso === 'availability' && (
            <Card title="4 · Colaboración y privacidad">
              <Text style={styles.label}>¿Buscas con quién trabajar?</Text>
              <View style={styles.chips}>
                {DISPONIBILIDAD.map((d) => (
                  <Chip key={d.value} label={d.label} on={disponibilidad === d.value} onPress={() => setDisponibilidad(d.value)} />
                ))}
              </View>
              <Text style={[styles.label, { marginTop: 14 }]}>Tu privacidad</Text>
              <View style={styles.toggle}>
                <Text style={styles.toggleText}>Aparecer como posible compañero en sugerencias de otros</Text>
                <Switch value={descubrible} onValueChange={setDescubrible} trackColor={{ true: colors.bordo }} />
              </View>
              <View style={styles.toggle}>
                <Text style={styles.toggleText}>Activar mi perfil compartible (enlace y QR)</Text>
                <Switch value={compartible} onValueChange={setCompartible} trackColor={{ true: colors.bordo }} />
              </View>
              <Muted>Tu correo y tu código nunca se muestran. Puedes cambiarlo en «Privacidad».</Muted>
              {error && <ErrorText message={error} />}
              {faltan.length > 0 && error ? <Muted>Falta: {faltan.join(', ')}.</Muted> : null}
              <View style={{ marginTop: 12, gap: 8 }}>
                <Button icon="check" title="Terminar" loading={guardando} onPress={terminar} />
                <Button variant="secondary" title="Atrás" onPress={() => setPaso('improvement')} />
              </View>
            </Card>
          )}

          {paso === 'done' && (
            <Card>
              <Text style={styles.big}>¡Listo! 🎉</Text>
              <Muted>
                Tu perfil ya está en marcha. Cuando quieras, marca las tecnologías que te interesan desde
                «Perfil → Tecnologías» y haz la orientación académica (opcional) para afinar tus
                recomendaciones.
              </Muted>
              <View style={{ marginTop: 14 }}>
                <Button
                  icon="home"
                  title="Ir al inicio"
                  onPress={() => {
                    toast.success('¡Bienvenido a Afinia!');
                    onDone();
                  }}
                />
              </View>
            </Card>
          )}
        </FadeIn>
      )}

      {!cargando && paso !== 'done' && (
        <View style={{ marginTop: 8 }}>
          <Button variant="secondary" small icon="log-out" title="Salir" onPress={logout} />
        </View>
      )}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 14 },
  dot: { width: 28, height: 6, borderRadius: 3, backgroundColor: colors.gray200 },
  dotOn: { backgroundColor: colors.bordo },
  big: { fontSize: 22, fontWeight: '800', color: colors.gray900, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  facts: { gap: 8, marginVertical: 12 },
  fact: { borderWidth: 1, borderColor: colors.gray200, borderRadius: 12, padding: 10 },
  factLabel: { fontSize: 11, color: colors.gray500 },
  factValue: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  toggleText: { flex: 1, color: colors.gray700 },
});
