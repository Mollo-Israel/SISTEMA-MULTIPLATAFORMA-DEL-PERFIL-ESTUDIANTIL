import { Text, View } from 'react-native';
import { reportService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, ErrorText, EmptyState, PageHeader, SkeletonCards } from '../../components/ui';

export default function ParticipationScreen() {
  const { data, loading, error, reload } = useAsync(() => reportService.participationBySemester(), []);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader title="Participación por semestre" />
      {loading && <SkeletonCards count={3} />}
      {error && <ErrorText message={error} />}
      {data && data.length === 0 && <EmptyState message="Sin participaciones registradas." />}
      {data?.map((r: any, i: number) => (
        <Card key={i} title={`Semestre ${r.semester ?? '—'}`}>
          <Text>Total: {r.total}</Text>
          <Text>Interés: {r.byStatus.interested} · Inscritos: {r.byStatus.registered}</Text>
          <Text>Confirmados: {r.byStatus.confirmed} · Ausentes: {r.byStatus.absent}</Text>
        </Card>
      ))}
    </Screen>
  );
}
