import { Text, View } from 'react-native';
import { reportService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, H1, Muted, Loading, ErrorText, EmptyState, Badge } from '../../components/ui';
import { colors } from '../../theme';

export default function AffinityMapScreen() {
  const { data, loading, error, reload } = useAsync(() => reportService.directorAffinityMap(), []);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Mapa de afinidad</H1>
      <Muted>Distribución agregada por área académica.</Muted>
      {loading && <Loading />}
      {error && <ErrorText message={error} />}
      {data && data.length === 0 && <EmptyState message="Aún no hay afinidades calculadas." />}
      {data?.map((a: any) => (
        <Card key={a.areaId} title={a.area}>
          <Text>Estudiantes: {a.students} · Promedio: {a.averageScore}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <Badge color={colors.gray500}>Bajo {a.byLevel.low}</Badge>
            <Badge color={colors.amber}>Medio {a.byLevel.medium}</Badge>
            <Badge color={colors.green}>Alto {a.byLevel.high}</Badge>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
