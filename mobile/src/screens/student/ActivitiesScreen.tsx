import { useState } from 'react';
import { Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { activityService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, H1, Muted, Button, Loading, ErrorText, EmptyState, Success, Badge } from '../../components/ui';
import { categoryLabel } from '../../constants';
import { colors } from '../../theme';

export default function ActivitiesScreen({ navigation }: any) {
  const { data, loading, error, reload } = useAsync(() => activityService.list(), []);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>, label: string) => {
    setMsg(null); setErr(null);
    try { await fn(); setMsg(label); } catch (e) { setErr(apiError(e)); }
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Actividades</H1>
      <Muted>Marca interés o inscríbete. La participación confirmada alimenta tu perfil.</Muted>
      <Button title="Ver mis actividades" variant="secondary" onPress={() => navigation.navigate('MisActividades')} />
      {msg && <Success message={msg} />}
      {err && <ErrorText message={err} />}
      {loading && <Loading />}
      {error && <ErrorText message={error} />}
      {data && data.length === 0 && <EmptyState message="No hay actividades publicadas." />}
      {data?.map((a: any) => (
        <Card key={a.id} title={a.title}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Badge color={colors.bordo}>{a.type}</Badge>
            <Badge>{categoryLabel(a.category)}</Badge>
          </View>
          {a.description ? <Text style={{ marginBottom: 6 }}>{a.description}</Text> : null}
          <Muted>{a.modality} · {a.status}{a.academicArea ? ` · ${a.academicArea.name}` : ''}</Muted>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}><Button title="Me interesa" variant="secondary" onPress={() => act(() => activityService.registerInterest(a.id), 'Interés registrado.')} /></View>
            <View style={{ flex: 1 }}><Button title="Inscribirme" onPress={() => act(() => activityService.register(a.id), 'Inscripción registrada.')} /></View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
