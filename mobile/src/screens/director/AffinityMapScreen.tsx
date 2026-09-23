import { Text, View } from 'react-native';
import { reportService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, ErrorText, EmptyState, Badge, PageHeader, SkeletonCards, Muted } from '../../components/ui';
import { colors } from '../../theme';

/**
 * Mapa de áreas de la carrera (§69), con el umbral de privacidad de §65.
 *
 * Las insignias son de **respaldo**: cuánto de la afinidad declarada está
 * demostrado. Un área con muy pocos estudiantes llega sin desglose y dice por
 * qué, en vez de mostrar un hueco.
 */
export default function AffinityMapScreen() {
  const { data, loading, error, reload } = useAsync(() => reportService.directorAffinityMap(), []);
  const areas = data?.areas ?? [];
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader
        title="Mapa de afinidad y respaldo"
        description="Distribución agregada por área académica."
      />
      {loading && <SkeletonCards count={3} />}
      {error && <ErrorText message={error} />}
      {data && areas.length === 0 && <EmptyState message="Aún no hay afinidades calculadas." />}
      {areas.map((a: any) => (
        <Card key={a.area} title={a.area}>
          {a.suppressed ? (
            <>
              <Text>Estudiantes: {a.students}</Text>
              <Muted>{a.reason}</Muted>
            </>
          ) : (
            <>
              <Text>
                Estudiantes: {a.students} · Afinidad media: {a.averageAffinity} · Respaldo medio:{' '}
                {a.averageSupport}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <Badge color={colors.gray500}>Respaldo bajo {a.bySupportLevel.bajo}</Badge>
                <Badge color={colors.amber}>Medio {a.bySupportLevel.medio}</Badge>
                <Badge color={colors.green}>Alto {a.bySupportLevel.alto}</Badge>
              </View>
            </>
          )}
        </Card>
      ))}
      {data?.note && <Muted>{data.note.scope}</Muted>}
    </Screen>
  );
}
