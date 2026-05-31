import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import { Screen, Card, H1, Muted, Button, Loading, ErrorText, Success } from '../../components/ui';
import { LevelPicker } from '../../components/LevelPicker';
import { colors } from '../../theme';

export default function InterestsScreen() {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([catalogService.areas(), profileService.summary().catch(() => null)])
      .then(([a, s]) => {
        setAreas(a);
        if (s) setValues(Object.fromEntries(s.interests.map((i: any) => [i.academicAreaId, i.priority])));
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setError(null); setMsg(null);
    try {
      await profileService.setInterests(
        Object.entries(values).filter(([, p]) => p > 0).map(([academicAreaId, priority]) => ({ academicAreaId, priority })),
      );
      setMsg('Intereses guardados.');
    } catch (e) { setError(apiError(e)); }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <H1>Intereses por área</H1>
      <Muted>Prioridad de 1 a 5 (— para ninguno).</Muted>
      {error && <ErrorText message={error} />}
      {msg && <Success message={msg} />}
      <Card>
        {areas.map((a) => (
          <View key={a.id} style={styles.row}>
            <Text style={styles.name}>{a.name}</Text>
            <LevelPicker value={values[a.id] ?? 0} onChange={(v) => setValues({ ...values, [a.id]: v })} />
          </View>
        ))}
      </Card>
      <Button title="Guardar intereses" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingBottom: 10 },
  name: { fontWeight: '600', color: colors.gray900, marginBottom: 6 },
});
