import { Text } from 'react-native';
import { catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, H1, Muted, Loading, ErrorText } from '../../components/ui';

export default function AdminAreas() {
  const { data, loading, error, reload } = useAsync(() => catalogService.areas(), []);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Áreas académicas</H1>
      <Muted>Vista básica. La creación se realiza en la web.</Muted>
      {loading && <Loading />}
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
