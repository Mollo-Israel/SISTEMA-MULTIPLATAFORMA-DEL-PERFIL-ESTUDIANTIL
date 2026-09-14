import { Text } from 'react-native';
import { catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, Muted, ErrorText, PageHeader, SkeletonCards } from '../../components/ui';

export default function AdminAreas() {
  const { data, loading, error, reload } = useAsync(() => catalogService.areas(), []);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader
        title="Áreas académicas"
        description="Vista básica. La creación se realiza en la web."
      />
      {loading && <SkeletonCards count={3} />}
      {error && <ErrorText message={error} />}
      {data?.map((a: any) => (
        <Card key={a.id} title={a.name}>
          {a.description ? <Text>{a.description}</Text> : null}
          <Muted>{a.tags?.join(', ')}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
