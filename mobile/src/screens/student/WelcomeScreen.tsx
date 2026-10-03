import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { catalogService, profileService } from '../../services';
import { Button, Card, Chip, ErrorText, Field, FadeIn, Muted, Screen, SkeletonCards } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { colors } from '../../theme';

type Paso = 'welcome' | 'profile' | 'interests' | 'done';
const ORDEN: Paso[] = ['welcome', 'profile', 'interests', 'done'];

/**
 * Bienvenida en el móvil (correcciones de QA).
 *
 * Es la versión corta del asistente web: lo imprescindible para que el resto
 * de la app tenga con qué trabajar —dónde quiere mejorar y qué le interesa—.
 * Habilidades, disponibilidad y el cuestionario quedan para después, desde
 * «Perfil» o la web; el servidor no los exige para terminar.
 */
export default function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [paso, setPaso] = useState<Paso>('welcome');
  const [cargando, setCargando] = useState(true);
  const [areas, setAreas] = useState<any[]>([]);
  const [tienePerfil, setTienePerfil] = useState(false);
  const [semestre, setSemestre] = useState<number | null>(null);
  const [bio, setBio] = useState('');
  const [mejorar, setMejorar] = useState<string[]>([]);
  const [intereses, setIntereses] = useState<string[]>([]);
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
        if (perfil) {
          setTienePerfil(Boolean(estado.claimed));
          setBio(perfil.bio ?? '');
          setMejorar(perfil.improvementAreaIds ?? []);
        }
        const previos = resumen?.preferredAreas ?? resumen?.interests ?? [];
        setIntereses(previos.map((i: any) => i.academicAreaId));
        // Retoma donde lo dejó, sin pasos que aquí no existen.
        if (estado.claimed && (perfil?.improvementAreaIds ?? []).length > 0) setPaso('interests');
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternar = (lista: string[], set: (v: string[]) => void, id: string) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const guardarPerfil = async () => {
    if (mejorar.length === 0) {
      setError('Elige al menos un área en la que quieras mejorar.');
      return;
    }
    if (bio.trim().length > 1000) {
      setError('Tu presentación no puede superar 1000 caracteres.');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const payload = { bio: bio.trim() || undefined, improvementAreaIds: mejorar };
      if (tienePerfil) await profileService.update(payload);
      else await profileService.create(payload);
      setTienePerfil(true);
      await profileService.saveOnboardingStep('interests').catch(() => {});
      setPaso('interests');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setGuardando(false);
    }
  };

  const terminar = async () => {
    if (intereses.length === 0) {
      setError('Marca al menos un área que te interese.');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await profileService.setPreferredAreas(intereses.map((id) => ({ academicAreaId: id, priority: 3 })));
      await profileService.completeOnboarding();
      setPaso('done');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setGuardando(false);
    }
  };

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
                Vamos a armar tu perfil en dos pasos cortos. Con eso Afinia podrá sugerirte actividades,
                proyectos y compañeros que encajen contigo.
              </Muted>
              {semestre ? <Text style={styles.semestre}>Estás en {semestre}º semestre.</Text> : null}
              <View style={{ marginTop: 14 }}>
                <Button icon="arrow-right" title="Empezar" onPress={() => setPaso('profile')} />
              </View>
            </Card>
          )}

          {paso === 'profile' && (
            <Card title="1 · Sobre ti">
              <Field
                label="Preséntate en una línea (opcional)"
                value={bio}
                onChangeText={setBio}
                placeholder="Me gusta construir apps y aprender de datos."
                multiline
              />
              <Text style={styles.label}>¿En qué áreas quieres mejorar?</Text>
              <View style={styles.chips}>
                {areas.map((a) => (
                  <Chip key={a.id} label={a.name} on={mejorar.includes(a.id)} onPress={() => alternar(mejorar, setMejorar, a.id)} />
                ))}
              </View>
              {error && <ErrorText message={error} />}
              <View style={{ marginTop: 12 }}>
                <Button icon="arrow-right" title="Continuar" loading={guardando} onPress={guardarPerfil} />
              </View>
            </Card>
          )}

          {paso === 'interests' && (
            <Card title="2 · Lo que te interesa">
              <Muted>Marca las áreas que te llaman la atención. Puedes cambiarlas cuando quieras desde tu perfil.</Muted>
              <View style={[styles.chips, { marginTop: 10 }]}>
                {areas.map((a) => (
                  <Chip key={a.id} label={a.name} on={intereses.includes(a.id)} onPress={() => alternar(intereses, setIntereses, a.id)} />
                ))}
              </View>
              {error && <ErrorText message={error} />}
              <View style={{ marginTop: 12, gap: 8 }}>
                <Button icon="check" title="Terminar" loading={guardando} onPress={terminar} />
                <Button variant="secondary" title="Atrás" onPress={() => setPaso('profile')} />
              </View>
            </Card>
          )}

          {paso === 'done' && (
            <Card>
              <Text style={styles.big}>¡Listo! 🎉</Text>
              <Muted>
                Tu perfil ya está en marcha. Cuando quieras, agrega tus habilidades desde «Perfil» y haz el
                cuestionario de orientación en la web para afinar tus recomendaciones.
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

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 14 },
  dot: { width: 28, height: 6, borderRadius: 3, backgroundColor: colors.gray200 },
  dotOn: { backgroundColor: colors.bordo },
  big: { fontSize: 22, fontWeight: '800', color: colors.gray900, marginBottom: 6 },
  semestre: { marginTop: 8, color: colors.bordo, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
