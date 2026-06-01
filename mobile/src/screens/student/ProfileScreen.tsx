import { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import { Screen, Card, H1, Muted, Field, Button, Loading, ErrorText, Success } from '../../components/ui';
import { colors } from '../../theme';

export default function ProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [areas, setAreas] = useState<any[]>([]);
  const [completion, setCompletion] = useState(0);
  const [form, setForm] = useState({ universityCode: '', semester: '', bio: '', improvementAreaIds: [] as string[] });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([catalogService.areas(), profileService.getMine().catch(() => null)])
      .then(([a, p]) => {
        setAreas(a);
        if (p) {
          setExists(true);
          setCompletion(p.completionPercentage);
          setForm({
            universityCode: p.universityCode ?? '',
            semester: p.semester ? String(p.semester) : '',
            bio: p.bio ?? '',
            improvementAreaIds: p.improvementAreaIds ?? [],
          });
        }
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) =>
    setForm((f) => ({
      ...f,
      improvementAreaIds: f.improvementAreaIds.includes(id)
        ? f.improvementAreaIds.filter((x) => x !== id)
        : [...f.improvementAreaIds, id],
    }));

  const save = async () => {
    setError(null); setMsg(null);
    const payload: any = {
      semester: form.semester ? Number(form.semester) : undefined,
      bio: form.bio || undefined,
      improvementAreaIds: form.improvementAreaIds,
    };
    try {
      const r = exists ? await profileService.update(payload) : await profileService.create(payload);
      setExists(true);
      setCompletion(r.completionPercentage);
      setMsg('Perfil guardado.');
    } catch (e) { setError(apiError(e)); }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <H1>Completar perfil</H1>
      <Muted>Completitud actual: {completion}%</Muted>
      <View style={styles.bar}><View style={[styles.barFill, { width: `${completion}%` }]} /></View>

      <Card>
        {error && <ErrorText message={error} />}
        {msg && <Success message={msg} />}
        <Field label="Semestre (1–8)" value={form.semester} onChangeText={(t) => setForm({ ...form, semester: t })} keyboardType="numeric" />
        <Field label="Descripción / bio" value={form.bio} onChangeText={(t) => setForm({ ...form, bio: t })} multiline />
        <Text style={styles.label}>Áreas donde deseas mejorar</Text>
        <View style={styles.chips}>
          {areas.map((a) => {
            const on = form.improvementAreaIds.includes(a.id);
            return (
              <Pressable key={a.id} onPress={() => toggle(a.id)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={on ? styles.chipOnText : styles.chipText}>{a.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button title={exists ? 'Guardar cambios' : 'Crear perfil'} onPress={save} />
      </Card>

      <Button title="Registrar intereses" variant="secondary" onPress={() => navigation.navigate('Intereses')} />
      <Button title="Registrar habilidades" variant="secondary" onPress={() => navigation.navigate('Habilidades')} />
      <Button title="Evidencias y certificados" variant="secondary" onPress={() => navigation.navigate('Evidencias')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { height: 8, backgroundColor: colors.gray200, borderRadius: 6, marginVertical: 10, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.bordo },
  label: { fontSize: 13, color: colors.gray700, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: colors.gray200, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  chipText: { color: colors.gray700, fontSize: 13 },
  chipOnText: { color: colors.white, fontSize: 13 },
});
