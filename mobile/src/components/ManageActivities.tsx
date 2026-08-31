import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../api/client';
import { activityService } from '../services';
import {
  Screen,
  Card,
  H1,
  Muted,
  Field,
  Button,
  Loading,
  ErrorText,
  EmptyState,
  Success,
  Badge,
} from './ui';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABEL,
  CATEGORIES_BY_TYPE,
  REGISTRATION_STATUS_LABEL,
  categoryLabel,
  lbl,
} from '../constants';
import { colors, registrationColor } from '../theme';

/**
 * Panel de gestion de actividades para el responsable:
 *   - Director de carrera  -> academicas
 *   - Sociedad cientifica  -> extracurriculares
 * Incluye el registro de asistencia y participacion (RF10).
 */
export default function ManageActivities({
  activityType,
}: {
  activityType: 'academica' | 'extracurricular';
}) {
  const categories = ACTIVITY_CATEGORIES.filter((c) =>
    CATEGORIES_BY_TYPE[activityType].includes(c.value),
  );

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: categories[0].value,
    capacity: '',
    location: '',
    status: 'open',
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [partBusy, setPartBusy] = useState(false);

  const load = useCallback(
    () =>
      activityService
        .managed()
        .then((list) => setItems(list.filter((a: any) => a.type === activityType))),
    [activityType],
  );

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [load]);

  const notify = (t: string) => {
    setMsg(t);
    setError(null);
  };

  const publish = async () => {
    setError(null);
    setMsg(null);
    setSaving(true);
    try {
      await activityService.create({
        title: form.title,
        description: form.description || undefined,
        type: activityType,
        category: form.category,
        location: form.location || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        status: form.status,
      });
      setForm({ ...form, title: '', description: '', capacity: '', location: '' });
      setShowForm(false);
      notify(form.status === 'draft' ? 'Guardada como borrador.' : 'Actividad publicada.');
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: string) => {
    setError(null);
    try {
      await activityService.update(id, { status });
      notify(`Estado: ${lbl(ACTIVITY_STATUS_LABEL, status)}.`);
      await load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const openParticipants = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      setParticipants([]);
      return;
    }
    setOpenId(id);
    setPartBusy(true);
    setError(null);
    try {
      setParticipants(await activityService.participants(id));
    } catch (e) {
      setError(apiError(e));
      setParticipants([]);
    } finally {
      setPartBusy(false);
    }
  };

  const decide = async (activityId: string, studentProfileId: string, status: string) => {
    setError(null);
    try {
      await activityService.confirm(activityId, studentProfileId, status);
      setParticipants(await activityService.participants(activityId));
      await load();
      notify(status === 'confirmed' ? 'Participación confirmada.' : 'Registrado como ausente.');
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (loading) return <Loading />;

  const tipo = activityType === 'academica' ? 'académicas' : 'extracurriculares';

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <H1>Actividades {tipo}</H1>
      <Muted>Publique, gestione el estado y registre la participación de los estudiantes.</Muted>

      {error && <ErrorText message={error} />}
      {msg && <Success message={msg} />}

      {!showForm ? (
        <Button title="Nueva actividad" onPress={() => setShowForm(true)} />
      ) : (
        <Card title="Nueva actividad">
          <Field
            label="Título"
            value={form.title}
            onChangeText={(t) => setForm({ ...form, title: t })}
            placeholder={
              activityType === 'academica' ? 'Taller de bases de datos' : 'Hackathon de innovación'
            }
          />
          <Field
            label="Descripción"
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
            multiline
          />
          <Text style={styles.label}>Categoría</Text>
          <View style={styles.chips}>
            {categories.map((c) => {
              const on = form.category === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setForm({ ...form, category: c.value })}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={on ? styles.chipOnText : styles.chipText}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Field
            label="Ubicación"
            value={form.location}
            onChangeText={(t) => setForm({ ...form, location: t })}
            placeholder="Aula 301"
          />
          <Field
            label="Cupo (opcional)"
            value={form.capacity}
            onChangeText={(t) => setForm({ ...form, capacity: t })}
            keyboardType="numeric"
            placeholder="Sin límite"
          />
          <Text style={styles.label}>Estado inicial</Text>
          <View style={styles.chips}>
            {ACTIVITY_STATUSES.filter((s) => ['draft', 'published', 'open'].includes(s)).map((s) => {
              const on = form.status === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setForm({ ...form, status: s })}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={on ? styles.chipOnText : styles.chipText}>
                    {lbl(ACTIVITY_STATUS_LABEL, s)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Muted>En borrador la actividad no es visible para los estudiantes.</Muted>
          <Button title={saving ? 'Guardando…' : 'Guardar'} onPress={publish} disabled={saving} />
          <Button title="Cancelar" variant="secondary" onPress={() => setShowForm(false)} />
        </Card>
      )}

      {items.length === 0 && (
        <EmptyState message={`Todavía no ha publicado actividades ${tipo}.`} />
      )}

      {items.map((a: any) => {
        const pending = (a.registrationCount ?? 0) - (a.confirmedCount ?? 0);
        const isOpen = openId === a.id;
        const full = !!(a.capacity && (a.confirmedCount ?? 0) >= a.capacity);
        return (
          <Card key={a.id}>
            <Text style={styles.title}>{a.title}</Text>
            <View style={styles.badges}>
              <Badge color={colors.bordo}>{lbl(ACTIVITY_STATUS_LABEL, a.status)}</Badge>
              <Badge>{categoryLabel(a.category)}</Badge>
            </View>
            <Muted>
              Confirmados: {a.confirmedCount ?? 0}
              {a.capacity ? ` de ${a.capacity}` : ' (sin límite)'}
              {pending > 0 ? ` · ${pending} por registrar` : ''}
            </Muted>

            <Text style={styles.label}>Cambiar estado</Text>
            <View style={styles.chips}>
              {ACTIVITY_STATUSES.map((s) => {
                const on = a.status === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => !on && changeStatus(a.id, s)}
                    style={[styles.chipSm, on && styles.chipOn]}
                  >
                    <Text style={on ? styles.chipOnText : styles.chipText}>
                      {lbl(ACTIVITY_STATUS_LABEL, s)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Button
              title={isOpen ? 'Ocultar participantes' : 'Registrar participación'}
              variant="secondary"
              onPress={() => openParticipants(a.id)}
            />

            {isOpen && partBusy && <Loading />}
            {isOpen && !partBusy && participants.length === 0 && (
              <EmptyState message="Todavía nadie se inscribió ni marcó interés." />
            )}
            {isOpen &&
              !partBusy &&
              participants.map((p: any) => (
                <View key={p.id} style={styles.partRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partName}>{p.studentName ?? 'Estudiante'}</Text>
                    <Text style={styles.partMeta}>
                      {p.semester ? `${p.semester}º semestre` : 'Semestre no declarado'}
                    </Text>
                    <View style={{ marginTop: 4 }}>
                      <Badge color={registrationColor(p.status)}>
                        {lbl(REGISTRATION_STATUS_LABEL, p.status)}
                      </Badge>
                    </View>
                  </View>
                  <View style={{ gap: 4, width: 118 }}>
                    {p.status !== 'confirmed' && (
                      <Button
                        title={full ? 'Cupo lleno' : 'Confirmar'}
                        disabled={full}
                        onPress={() => decide(a.id, p.studentProfileId, 'confirmed')}
                      />
                    )}
                    {p.status !== 'absent' && (
                      <Button
                        title="Ausente"
                        variant="secondary"
                        onPress={() => decide(a.id, p.studentProfileId, 'absent')}
                      />
                    )}
                  </View>
                </View>
              ))}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: colors.gray700, marginTop: 10, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.white,
  },
  chipSm: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  chipText: { color: colors.gray700, fontSize: 12 },
  chipOnText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  title: { fontSize: 15.5, fontWeight: '700', color: colors.gray900, marginBottom: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  partName: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  partMeta: { fontSize: 12, color: colors.gray500 },
});
