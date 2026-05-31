import { useState } from 'react';
import { Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { affinityService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, H1, Muted, Button, Loading, ErrorText, EmptyState, Badge } from '../../components/ui';
import { affinityColor } from '../../theme';

export default function AffinityScreen() {
  const { data, loading, error, setData } = useAsync(() => affinityService.mine(), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const recalc = async () => {
    setBusy(true); setErr(null);
    try { setData(await affinityService.recalculateMine()); } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <H1>Áreas de afinidad</H1>
      <Muted>Orientación calculada en el servidor con reglas y puntuación. No representa notas.</Muted>
      <Button title={busy ? 'Recalculando…' : 'Recalcular afinidad'} onPress={recalc} disabled={busy} />
      {err && <ErrorText message={err} />}
      {loading && <Loading />}
      {error && <ErrorText message={error} />}
      {data && data.length === 0 && <EmptyState message="Sin afinidades. Agrega intereses, habilidades y proyectos." />}
      {data?.map((a: any) => (
        <Card key={a.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '600' }}>{a.academicArea?.name ?? a.academicAreaId}</Text>
            <Badge color={affinityColor(a.level)}>{a.score} · {a.level}</Badge>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
