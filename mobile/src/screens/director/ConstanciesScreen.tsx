import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { activityService, constancyService } from '../../services';
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
} from '../../components/ui';
import { colors } from '../../theme';

/**
 * Emision de constancias internas (RF12).
 * Solo el director de carrera, y unicamente sobre participacion confirmada.
 */
export default function ConstanciesScreen() {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [eligible, setEligible] = useState<any[]>([]);
  const [issued, setIssued] = useState<any[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    activityService
      .managed()
      .then(setActivities)
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const openActivity = async (activity: any) => {
    if (selected?.id === activity.id) {
      setSelected(null);
      setTarget(null);
      return;
    }
    setSelected(activity);
    setTarget(null);
    setListBusy(true);
    setError(null);
    try {
      const [e, i] = await Promise.all([
        constancyService.eligible(activity.id),
        constancyService.byActivity(activity.id),
      ]);
      setEligible(e);
      setIssued(i);
    } catch (e2) {
      setError(apiError(e2));
    } finally {
      setListBusy(false);
    }
  };

  const issue = async () => {
    if (!target || !selected) return;
    setSaving(true);
    setError(null);
    try {
      await constancyService.create({
        profileId: target.studentProfileId,
        activityId: selected.id,
        description,
      });
      setMsg(`Constancia emitida para ${target.studentName ?? 'el estudiante'}.`);
      setTarget(null);
      setDescription('');
      const [e, i] = await Promise.all([
        constancyService.eligible(selected.id),
        constancyService.byActivity(selected.id),
      ]);
      setEligible(e);
      setIssued(i);
    } catch (e2) {
      setError(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const pending = eligible.filter((e) => !e.hasConstancy);

  return (
    <Screen>
      <H1>Constancias internas</H1>
      <Muted>
        Solo sobre participación confirmada y una sola vez por estudiante y actividad. No sustituyen
        a un certificado oficial de la universidad.
      </Muted>

      {error && <ErrorText message={error} />}
      {msg && <Success message={msg} />}

      {activities.length === 0 && (
        <EmptyState message="Todavía no gestiona ninguna actividad académica." />
      )}

      {activities.map((a) => (
        <Card key={a.id}>
          <Pressable onPress={() => openActivity(a)}>
            <Text style={styles.title}>{a.title}</Text>
            <Muted>
              {a.confirmedCount ?? 0} participación
              {(a.confirmedCount ?? 0) === 1 ? ' confirmada' : 'es confirmadas'}
            </Muted>
            <Text style={styles.toggle}>
              {selected?.id === a.id ? 'Ocultar ▲' : 'Gestionar constancias ▼'}
            </Text>
          </Pressable>

          {selected?.id === a.id && listBusy && <Loading />}

          {selected?.id === a.id && !listBusy && (
            <View style={styles.detail}>
              <Text style={styles.section}>Sin constancia ({pending.length})</Text>
              {pending.length === 0 ? (
                <Muted>
                  {eligible.length === 0
                    ? 'Esta actividad todavía no tiene participación confirmada.'
                    : 'Todos los confirmados ya tienen su constancia.'}
                </Muted>
              ) : (
                pending.map((p) => (
                  <View key={p.studentProfileId} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{p.studentName ?? 'Estudiante'}</Text>
                      <Text style={styles.meta}>
                        {p.semester ? `${p.semester}º semestre` : 'Sin semestre'}
                      </Text>
                    </View>
                    <View style={{ width: 110 }}>
                      <Button
                        title="Emitir"
                        onPress={() => {
                          setTarget(p);
                          setDescription(`Participó en la actividad “${a.title}”.`);
                        }}
                      />
                    </View>
                  </View>
                ))
              )}

              {target && (
                <View style={styles.form}>
                  <Text style={styles.section}>
                    Constancia para {target.studentName ?? 'el estudiante'}
                  </Text>
                  <Field
                    label="Texto de la constancia"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                  />
                  <Button
                    title={saving ? 'Emitiendo…' : 'Emitir constancia'}
                    onPress={issue}
                    disabled={saving || description.trim().length < 5}
                  />
                  <Button title="Cancelar" variant="secondary" onPress={() => setTarget(null)} />
                </View>
              )}

              <Text style={styles.section}>Emitidas ({issued.length})</Text>
              {issued.length === 0 ? (
                <Muted>Todavía no se emitió ninguna constancia.</Muted>
              ) : (
                issued.map((c) => (
                  <View key={c.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {c.studentProfile?.user
                          ? `${c.studentProfile.user.firstName} ${c.studentProfile.user.lastName}`
                          : 'Estudiante'}
                      </Text>
                      <Text style={styles.meta}>{c.description}</Text>
                    </View>
                    <Badge color={colors.green}>Autorizada</Badge>
                  </View>
                ))
              )}
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15.5, fontWeight: '700', color: colors.gray900, marginBottom: 3 },
  toggle: { color: colors.bordo, fontSize: 12.5, fontWeight: '600', marginTop: 8 },
  detail: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 10 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray700,
    marginTop: 10,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  name: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  meta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  form: {
    marginTop: 12,
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 12,
  },
});
