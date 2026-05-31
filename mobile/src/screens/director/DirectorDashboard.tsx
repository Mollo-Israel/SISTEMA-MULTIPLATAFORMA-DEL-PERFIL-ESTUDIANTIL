import { Text, View, StyleSheet } from 'react-native';
import { reportService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, H1, Muted, Loading, ErrorText } from '../../components/ui';
import { colors } from '../../theme';

export default function DirectorDashboard() {
  const { data, loading, error, reload } = useAsync(() => reportService.directorOverview(), []);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Panel de dirección</H1>
      <Muted>Indicadores descriptivos. No representan rendimiento ni predicción.</Muted>
      {loading && <Loading />}
      {error && <ErrorText message={error} />}
      {data && (
        <>
          <View style={styles.stats}>
            <Stat value={data.totals.students} label="Estudiantes" />
            <Stat value={data.totals.projects} label="Proyectos" />
            <Stat value={data.totals.activities} label="Actividades" />
          </View>
          <Card title="Áreas con mayor interés">
            {data.topInterestAreas.length === 0 ? <Muted>Sin datos.</Muted> : data.topInterestAreas.map((a: any) => (
              <View key={a.area} style={styles.row}><Text>{a.area}</Text><Text>{a.count}</Text></View>
            ))}
          </Card>
          <Card title="Tendencias">
            <Text>Completitud promedio: {data.trends.averageProfileCompletion}%</Text>
            <Text>Perfiles completos: {data.trends.profilesComplete} ({data.trends.profilesCompletePercentage}%)</Text>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
