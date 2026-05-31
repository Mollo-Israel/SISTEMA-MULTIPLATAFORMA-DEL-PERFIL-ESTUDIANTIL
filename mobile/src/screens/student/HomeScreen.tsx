import { View, Text, StyleSheet } from 'react-native';
import { useAsync } from '../../hooks/useAsync';
import { profileService } from '../../services';
import { useAuth } from '../../auth/AuthContext';
import { Screen, Card, H1, Muted, Loading, ErrorText, Badge, Button } from '../../components/ui';
import { colors, affinityColor } from '../../theme';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => profileService.summary().catch(() => null), []);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Hola, {user?.firstName}</H1>
      <Muted>Tu perfil se construye con lo que declaras y tu actividad académica.</Muted>

      {loading && <Loading />}
      {error && <ErrorText message={error} />}

      {!loading && !data && (
        <Card title="Aún no tienes perfil">
          <Muted>Crea tu perfil dinámico para empezar.</Muted>
          <Button title="Completar perfil" onPress={() => navigation.navigate('Perfil')} />
        </Card>
      )}

      {data && (
        <>
          <View style={styles.stats}>
            <Stat value={`${data.profile.completionPercentage}%`} label="Perfil" />
            <Stat value={data.projects.length} label="Proyectos" />
            <Stat value={data.activities.length} label="Actividades" />
            <Stat value={data.affinities.length} label="Afinidades" />
          </View>

          <Card title="Tus áreas de afinidad">
            {data.affinities.length === 0 ? (
              <Muted>Sin afinidades aún. Agrega intereses, habilidades y proyectos.</Muted>
            ) : (
              data.affinities.slice(0, 4).map((a: any) => (
                <View key={a.academicAreaId} style={styles.rowBetween}>
                  <Text>{a.area}</Text>
                  <Badge color={affinityColor(a.level)}>{a.score} · {a.level}</Badge>
                </View>
              ))
            )}
          </Card>

          <Card title="Resumen">
            <Text>Semestre: {data.profile.semester ?? '—'}</Text>
            <Text>Intereses: {data.interests.length} · Habilidades: {data.skills.length}</Text>
            <Text>Certificados externos: {data.externalCertificates.length}</Text>
            <Text>Constancias internas: {data.internalConstancies.length}</Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

function Stat({ value, label }: { value: any; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.gray200, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.bordo },
  statLabel: { fontSize: 11, color: colors.gray500 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
});
