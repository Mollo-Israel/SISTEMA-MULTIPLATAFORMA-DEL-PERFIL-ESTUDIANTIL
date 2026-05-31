import { useEffect, useState } from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { apiError } from '../api/client';
import { activityService } from '../services';
import { Screen, Card, H1, Muted, Field, Button, Loading, ErrorText, EmptyState, Success, Badge } from './ui';
import { ACTIVITY_CATEGORIES, categoryLabel } from '../constants';
import { colors, registrationColor } from '../theme';

export default function ManageActivities({ activityType }: { activityType: 'academica' | 'extracurricular' }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: ACTIVITY_CATEGORIES[0].value, capacity: '' });
  const [participants, setParticipants] = useState<Record<string, any[]>>({});

  const load = () => activityService.list({ type: activityType }).then(setItems);

  useEffect(() => {
    load().catch((e) => setError(apiError(e))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityType]);

  const publish = async () => {
    setError(null); setMsg(null);
    try {
      await activityService.create({
        title: form.title,
        description: form.description || undefined,
        type: activityType,
        category: form.category,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        status: 'open',
      });
      setForm({ ...form, title: '', description: '', capacity: '' });
      setMsg('Actividad publicada.');
      await load();
    } catch (e) { setError(apiError(e)); }
  };

  const loadParticipants = async (id: string) => {
    try {
      const list = await activityService.participants(id);
      setParticipants((p) => ({ ...p, [id]: list }));
    } catch (e) { setError(apiError(e)); }
  };

  const confirm = async (activityId: string, studentProfileId: string, status: string) => {
    try {
      await activityService.confirm(activityId, studentProfileId, status);
      await loadParticipants(activityId);
    } catch (e) { setError(apiError(e)); }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <H1>{activityType === 'academica' ? 'Actividades académicas' : 'Actividades extracurriculares'}</H1>
      {error && <ErrorText message={error} />}
      {msg && <Success message={msg} />}

      <Card title="Publicar actividad">
        <Field label="Título" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} />
        <Field label="Descripción" value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} multiline />
        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chips}>
          {ACTIVITY_CATEGORIES.map((c) => {
            const on = form.category === c.value;
            return (
              <Pressable key={c.value} onPress={() => setForm({ ...form, category: c.value })} style={[styles.chip, on && styles.chipOn]}>
                <Text style={on ? styles.chipOnText : styles.chipText}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Cupo (opcional)" value={form.capacity} onChangeText={(t) => setForm({ ...form, capacity: t })} keyboardType="numeric" />
        <Button title="Publicar" onPress={publish} />
      </Card>

      <H1>Publicadas</H1>
      {items.length === 0 && <EmptyState message="Sin actividades." />}
      {items.map((a) => (
        <Card key={a.id} title={a.title}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Badge color={colors.bordo}>{a.status}</Badge>
            <Badge>{categoryLabel(a.category)}</Badge>
          </View>
          <Muted>Cupo: {a.capacity ?? '—'}</Muted>
          <Button title="Ver inscritos" variant="secondary" onPress={() => loadParticipants(a.id)} />
          {participants[a.id]?.map((p) => (
            <View key={p.id} style={styles.partRow}>
              <Text style={{ flex: 1 }}>
                {p.studentProfile?.user ? `${p.studentProfile.user.firstName} ${p.studentProfile.user.lastName}` : 'Estudiante'}
              </Text>
              <Badge color={registrationColor(p.status)}>{p.status}</Badge>
            </View>
          ))}
          {participants[a.id]?.map((p) => (
            <View key={p.id + '-act'} style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Confirmar" onPress={() => confirm(a.id, p.studentProfileId, 'confirmed')} /></View>
              <View style={{ flex: 1 }}><Button title="Ausente" variant="secondary" onPress={() => confirm(a.id, p.studentProfileId, 'absent')} /></View>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: colors.gray700, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: colors.gray200, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  chipText: { color: colors.gray700, fontSize: 12 },
  chipOnText: { color: colors.white, fontSize: 12 },
  partRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
});
