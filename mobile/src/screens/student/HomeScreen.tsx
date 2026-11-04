import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAsync } from '../../hooks/useAsync';
import { profileService } from '../../services';
import { useAuth } from '../../auth/AuthContext';
import { Icon, type IconName } from '../../components/icons';
import {
  Screen, Card, Muted, ErrorText, Badge, Button, FadeIn, ProgressBar, SkeletonCards,
} from '../../components/ui';
import { colors, affinityColor, shadow, tints } from '../../theme';

/*
 * V7: el inicio de la app se ve como el de la web: saludo, «tu siguiente
 * paso», cifras y accesos con palabras simples. Mismos datos que antes
 * (/profiles/me/summary); los accesos solo abren pantallas que ya existen.
 */

const NIVEL: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Inicial' };

type Destino = [string, object?];
const ATAJOS: { icon: IconName; t: string; d: string; ir: Destino }[] = [
  { icon: 'compass', t: 'Para ti', d: 'Lo que encaja contigo', ir: ['Actividades'] },
  { icon: 'calendar', t: 'Actividades', d: 'Talleres y eventos', ir: ['Actividades'] },
  { icon: 'folder', t: 'Mis proyectos', d: 'Lo que construiste', ir: ['Proyectos'] },
  { icon: 'upload', t: 'Certificados', d: 'Lo que te respalda', ir: ['Perfil', { screen: 'Evidencias' }] },
  { icon: 'users', t: 'Compañeros', d: 'Contactos y equipos', ir: ['Perfil', { screen: 'Colaboracion' }] },
  { icon: 'award', t: 'Mi progreso', d: 'Puntos e insignias', ir: ['Perfil', { screen: 'Progreso' }] },
];

/** El paso más útil que le falta dar, como en la web. */
function siguientePaso(d: any): { titulo: string; texto: string; cta: string; ir: Destino } {
  if (!d.projects?.length) {
    return { titulo: 'Registra tu primer proyecto', texto: 'Un trabajo de materia, uno personal o de un hackatón: cuéntanos qué hiciste.', cta: 'Registrar proyecto', ir: ['Proyectos'] };
  }
  if (!d.activities?.length) {
    return { titulo: 'Inscríbete en una actividad', texto: 'Cuando el organizador confirme que participaste, quedará en tu trayectoria.', cta: 'Ver actividades', ir: ['Actividades'] };
  }
  if (!d.externalCertificates?.length && !d.evidences?.length) {
    return { titulo: 'Sube un certificado', texto: 'Un curso que terminaste ayuda a demostrar lo que sabes.', cta: 'Subir certificado', ir: ['Perfil', { screen: 'Evidencias' }] };
  }
  return { titulo: 'Mira lo que es para ti', texto: 'Con lo que ya cargaste tenemos sugerencias pensadas para ti.', cta: 'Ver sugerencias', ir: ['Actividades'] };
}

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => profileService.summary().catch(() => null), []);
  const ir = ([ruta, params]: Destino) => navigation.navigate(ruta, params);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Hero nombre={user?.firstName} semestre={data?.profile?.semester} avance={data?.profile?.completionPercentage} onPerfil={() => ir(['Perfil'])} />

      {loading && !data && <SkeletonCards count={3} />}
      {error && <ErrorText message={error} />}

      {!loading && !data && (
        <Card title="Aún no tienes perfil">
          <Muted>Crea tu perfil dinámico para empezar.</Muted>
          <Button icon="user" title="Completar perfil" onPress={() => ir(['Perfil'])} />
        </Card>
      )}

      {data && (
        <>
          {(() => {
            const paso = siguientePaso(data);
            return (
              <FadeIn index={1}>
                <View style={[styles.paso, shadow]}>
                  <View style={styles.pasoIco}><Icon name="arrow-right" size={18} color={colors.white} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pasoKicker}>TU SIGUIENTE PASO</Text>
                    <Text style={styles.pasoTitulo}>{paso.titulo}</Text>
                    <Text style={styles.pasoTexto}>{paso.texto}</Text>
                    <View style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                      <Button small title={paso.cta} onPress={() => ir(paso.ir)} />
                    </View>
                  </View>
                </View>
              </FadeIn>
            );
          })()}

          <View style={styles.stats}>
            {[
              { v: data.projects.length, l: 'proyectos', c: 2 },
              { v: data.activities.length, l: 'actividades', c: 1 },
              { v: data.externalCertificates.length + data.internalConstancies.length, l: 'certificados', c: 3 },
              { v: data.skills.length, l: 'tecnologías', c: 0 },
            ].map((s, i) => (
              <View key={s.l} style={{ flex: 1 }}>
              <FadeIn index={i + 2}>
                <View style={[styles.stat, shadow]}>
                  <Text style={[styles.statValue, { color: tints[s.c].fg }]}>{s.v}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{s.l}</Text>
                </View>
              </FadeIn>
              </View>
            ))}
          </View>

          <Text style={styles.h2}>¿Qué quieres hacer?</Text>
          <View style={styles.atajos}>
            {ATAJOS.map((a, i) => (
              <View key={a.t} style={styles.atajoCelda}>
                <FadeIn index={i}>
                  <Pressable
                    onPress={() => ir(a.ir)}
                    accessibilityRole="button"
                    accessibilityLabel={`${a.t}: ${a.d}`}
                    style={({ pressed }) => [styles.atajo, shadow, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
                  >
                    <View style={[styles.atajoIco, { backgroundColor: tints[i % tints.length].bg }]}>
                      <Icon name={a.icon} size={19} color={tints[i % tints.length].fg} />
                    </View>
                    <Text style={styles.atajoT}>{a.t}</Text>
                    <Text style={styles.atajoD}>{a.d}</Text>
                  </Pressable>
                </FadeIn>
              </View>
            ))}
          </View>

          <Card title="Tus áreas fuertes">
            {data.affinities.length === 0 ? (
              <Muted>Aparecen a medida que cargas proyectos, actividades y certificados.</Muted>
            ) : (
              data.affinities.slice(0, 4).map((a: any, index: number) => (
                <FadeIn key={a.academicAreaId} index={index}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.area}>{a.area}</Text>
                    <Badge color={affinityColor(a.level)}>{NIVEL[a.level] ?? a.level} · {a.score}</Badge>
                  </View>
                </FadeIn>
              ))
            )}
            <Pressable onPress={() => ir(['Afinidad'])} style={styles.verMas} accessibilityRole="link">
              <Text style={styles.verMasTxt}>Ver detalle</Text>
              <Icon name="chevron-right" size={14} color={colors.bordo} />
            </Pressable>
          </Card>

          <Card title="Lo que ya cargaste">
            <Fila icon="heart" texto={`${data.interests.length} intereses y ${data.skills.length} tecnologías`} />
            <Fila icon="award" texto={`${data.externalCertificates.length} certificados externos`} />
            <Fila icon="file-text" texto={`${data.internalConstancies.length} constancias de la carrera`} />
          </Card>

          <Text style={styles.pie}>
            Lo que declaras orienta tus sugerencias; tus proyectos, actividades y certificados muestran tus áreas fuertes.
          </Text>
        </>
      )}
    </Screen>
  );
}

/** Tarjeta de saludo con fondo bordó, círculos que flotan y el avance del perfil. */
function Hero({ nombre, semestre, avance, onPerfil }: { nombre?: string; semestre?: number | null; avance?: number; onPerfil: () => void }) {
  const flota = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flota, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flota, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flota]);
  const mover = (d: number) => ({ transform: [{ translateY: flota.interpolate({ inputRange: [0, 1], outputRange: [0, d] }) }] });
  return (
    <FadeIn>
      <View style={styles.hero}>
        <Animated.View style={[styles.circulo, styles.c1, mover(14)]} />
        <Animated.View style={[styles.circulo, styles.c2, mover(-10)]} />
        <Text style={styles.heroKicker}>TU ESPACIO</Text>
        <Text style={styles.heroTitulo}>¡Hola{nombre ? `, ${nombre}` : ''}!</Text>
        <Text style={styles.heroTexto}>
          {semestre ? `${semestre}º semestre · ` : ''}Aquí ves cómo va tu trayectoria y qué puedes hacer ahora.
        </Text>
        {typeof avance === 'number' && (
          <View style={styles.heroBarra}>
            <View style={styles.heroBarraHead}>
              <Text style={styles.heroBarraTxt}>Avance de tu perfil</Text>
              <Text style={styles.heroBarraTxt}>{avance}%</Text>
            </View>
            <ProgressBar value={avance} tone="#ff8a9c" />
          </View>
        )}
        <Pressable onPress={onPerfil} style={styles.heroBtn} accessibilityRole="button">
          <Icon name="user" size={14} color={colors.white} />
          <Text style={styles.heroBtnTxt}>Mi perfil</Text>
        </Pressable>
      </View>
    </FadeIn>
  );
}

function Fila({ icon, texto }: { icon: IconName; texto: string }) {
  return (
    <View style={styles.fila}>
      <View style={styles.filaIco}><Icon name={icon} size={14} color={colors.bordo} /></View>
      <Text style={styles.filaTxt}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.bordo, borderRadius: 22, padding: 18, marginBottom: 14, overflow: 'hidden' },
  circulo: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  c1: { width: 190, height: 190, right: -60, top: -70 },
  c2: { width: 120, height: 120, right: 60, bottom: -70, backgroundColor: 'rgba(210,75,96,0.45)' },
  heroKicker: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroTitulo: { color: colors.white, fontSize: 26, fontWeight: '800', marginTop: 2 },
  heroTexto: { color: 'rgba(255,255,255,0.9)', fontSize: 13.5, marginTop: 4 },
  heroBarra: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  heroBarraHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  heroBarraTxt: { color: colors.white, fontSize: 12, fontWeight: '700' },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  heroBtnTxt: { color: colors.white, fontWeight: '700' },
  paso: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#f1dfe3' },
  pasoIco: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' },
  pasoKicker: { fontSize: 10.5, fontWeight: '800', color: '#b45309', letterSpacing: 0.6 },
  pasoTitulo: { fontSize: 15.5, fontWeight: '800', color: colors.gray900, marginTop: 1 },
  pasoTexto: { fontSize: 12.5, color: colors.gray500, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  stat: { backgroundColor: colors.white, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: '#f0e6e9', alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.gray500, marginTop: 1 },
  h2: { fontSize: 16, fontWeight: '800', color: colors.gray900, marginTop: 12, marginBottom: 8 },
  atajos: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 8 },
  atajoCelda: { width: '50%', padding: 5 },
  atajo: { backgroundColor: colors.white, borderRadius: 16, padding: 13, borderWidth: 1, borderColor: colors.gray200, minHeight: 112 },
  atajoIco: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  atajoT: { fontSize: 14, fontWeight: '800', color: colors.gray900 },
  atajoD: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 8 },
  area: { flex: 1, color: colors.gray900, fontWeight: '600' },
  verMas: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-end', marginTop: 6 },
  verMasTxt: { color: colors.bordo, fontWeight: '700', fontSize: 13 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  filaIco: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.bordoBg, alignItems: 'center', justifyContent: 'center' },
  filaTxt: { color: colors.gray700, flex: 1 },
  pie: { color: colors.gray500, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 8, paddingHorizontal: 10 },
});
