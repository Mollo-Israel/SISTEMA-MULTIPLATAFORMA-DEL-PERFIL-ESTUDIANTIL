import { Text, View } from 'react-native';
import { adminService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, H1, Muted, Loading, ErrorText, Badge } from '../../components/ui';
import { ROLE_LABEL } from '../../constants';
import { colors } from '../../theme';

export default function AdminUsers() {
  const { data, loading, error, reload } = useAsync(() => adminService.listUsers(), []);
  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Usuarios</H1>
      <Muted>Vista básica. La gestión completa se realiza en la web.</Muted>
      {loading && <Loading />}
      {error && <ErrorText message={error} />}
      {data?.map((u) => (
        <Card key={u.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontWeight: '600' }}>{u.firstName} {u.lastName}</Text>
              <Muted>{u.email} · {ROLE_LABEL[u.role] ?? u.role}</Muted>
            </View>
            <Badge color={u.status === 'active' ? colors.green : colors.red}>{u.status}</Badge>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
