import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import { Screen, Card, H1, Muted, Button, Loading, ErrorText, Success } from '../../components/ui';
import { LevelPicker } from '../../components/LevelPicker';
import { colors } from '../../theme';

export default function SkillsScreen() {
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([catalogService.skills(), profileService.summary().catch(() => null)])
      .then(([sk, s]) => {
        setSkills(sk);
        if (s) setValues(Object.fromEntries(s.skills.map((x: any) => [x.skillId, x.level])));
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setError(null); setMsg(null);
    try {
      await profileService.setSkills(
        Object.entries(values).filter(([, l]) => l > 0).map(([skillId, level]) => ({ skillId, level })),
      );
      setMsg('Habilidades guardadas.');
    } catch (e) { setError(apiError(e)); }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <H1>Habilidades declaradas</H1>
      <Muted>Nivel de 1 a 5 (— para ninguno).</Muted>
      {error && <ErrorText message={error} />}
      {msg && <Success message={msg} />}
      <Card>
        {skills.map((s) => (
          <View key={s.id} style={styles.row}>
            <Text style={styles.name}>{s.name} <Text style={styles.area}>· {s.academicArea?.name ?? 'General'}</Text></Text>
            <LevelPicker value={values[s.id] ?? 0} onChange={(v) => setValues({ ...values, [s.id]: v })} />
          </View>
        ))}
      </Card>
      <Button title="Guardar habilidades" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingBottom: 10 },
  name: { fontWeight: '600', color: colors.gray900, marginBottom: 6 },
  area: { fontWeight: '400', color: colors.gray500, fontSize: 12 },
});
