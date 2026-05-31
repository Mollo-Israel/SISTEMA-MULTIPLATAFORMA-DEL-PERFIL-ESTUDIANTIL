import { Text } from 'react-native';
import { profileService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, H1, Loading, ErrorText, EmptyState, Badge } from '../../components/ui';
import { registrationColor } from '../../theme';

export default function MyActivitiesScreen() {
  const { data, loading, error, reload } = useAsync(() => profileService.summary().catch(() => null), []);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Mis actividades</H1>
      {loading && <Loading />}
      {error && <ErrorText message={error} />}
      {data && data.activities.length === 0 && <EmptyState message="Aún no te has inscrito en actividades." />}
      {data?.activities.map((a: any) => (
        <Card key={a.activityId}>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>{a.title}</Text>
          <Badge color={registrationColor(a.status)}>{a.status}</Badge>
        </Card>
      ))}
    </Screen>
  );
}
