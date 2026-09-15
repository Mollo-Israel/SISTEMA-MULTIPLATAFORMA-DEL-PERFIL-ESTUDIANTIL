import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { activityService, constancyService } from '../../services';
import {
  Screen,
  Card,
  Muted,
  Field,
  Button,
  EmptyState,
  FadeIn,
  Badge,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { Icon } from '../../components/icons';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  const [query, setQuery] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    activityService
      .managed()
      .then(setActivities)
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return activities;
    return activities.filter((a: any) => normalize(a.title ?? '').includes(q));
  }, [activities, query]);

  const openActivity = async (activity: any) => {
    if (selected?.id === activity.id) {
      setSelected(null);
      setTarget(null);
      return;
    }
    setSelected(activity);
    setTarget(null);
    setListBusy(true);
    try {
      const [e, i] = await Promise.all([
        constancyService.eligible(activity.id),
        constancyService.byActivity(activity.id),
      ]);
      setEligible(e);
      setIssued(i);
    } catch (e2) {
      toast.error(apiError(e2));
    } finally {
      setListBusy(false);
    }
  };

  const issue = async () => {
    if (!target || !selected) return;
    const who = target.studentName ?? 'el estudiante';
    const ok = await confirm({
      title: 'Emitir la constancia',
      message: `Se emitirá la constancia interna de ${who}. Solo puede emitirse una vez por estudiante y actividad, y el estudiante la verá en sus evidencias.`,
      confirmLabel: 'Emitir constancia',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await constancyService.create({
        profileId: target.studentProfileId,
        activityId: selected.id,
        description,
      });
      toast.success('Constancia emitida.', `${who} ya puede verla en sus evidencias.`);
      setTarget(null);
      setDescription('');
      const [e, i] = await Promise.all([
        constancyService.eligible(selected.id),
        constancyService.byActivity(selected.id),
      ]);
      setEligible(e);
      setIssued(i);
    } catch (e2) {
      toast.error(apiError(e2));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <SkeletonCards count={3} />
      </Screen>
    );
  }

  const pending = eligible.filter((e) => !e.hasConstancy);

  return (
    <Screen>
      <PageHeader
        title="Constancias internas"
        description="Solo sobre participación confirmada y una sola vez por estudiante y actividad. No sustituyen a un certificado oficial de la universidad."
      />

      {activities.length > 0 && (
        <>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar actividad…"
          />
          <ResultCount shown={visible.length} total={activities.length} noun="actividades" />
        </>
      )}

      {activities.length === 0 && (
        <EmptyState
          icon="calendar"
          message="Todavía no gestiona ninguna actividad académica."
        />
      )}

      {activities.length > 0 && visible.length === 0 && (
        <EmptyState
          icon="search"
          message={`Ninguna actividad coincide con “${query}”.`}
          action={
            <Button
              title="Limpiar búsqueda"
              icon="x"
              variant="secondary"
              small
              onPress={() => setQuery('')}
            />
          }
        />
      )}

      {visible.map((a, index) => (
        <FadeIn key={a.id} index={index}>
        <Card>
          <Pressable onPress={() => openActivity(a)}>
            <Text style={styles.title}>{a.title}</Text>
            <Muted>
              {a.confirmedCount ?? 0} participación
              {(a.confirmedCount ?? 0) === 1 ? ' confirmada' : 'es confirmadas'}
            </Muted>
            <View style={styles.toggleRow}>
              <Text style={styles.toggle}>
                {selected?.id === a.id ? 'Ocultar' : 'Gestionar constancias'}
              </Text>
              <Icon
                name={selected?.id === a.id ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.bordo}
              />
            </View>
          </Pressable>

          {selected?.id === a.id && listBusy && <SkeletonCards count={2} />}

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
                pending.map((p, i) => (
                  <FadeIn key={p.studentProfileId} index={i}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{p.studentName ?? 'Estudiante'}</Text>
                      <Text style={styles.meta}>
                        {p.semester ? `${p.semester}º semestre` : 'Sin semestre'}
                      </Text>
                    </View>
                    <View style={{ width: 110 }}>
                      <Button
                        title="Emitir"
                        icon="award"
                        small
                        onPress={() => {
                          setTarget(p);
                          setDescription(`Participó en la actividad “${a.title}”.`);
                        }}
                      />
                    </View>
                  </View>
                  </FadeIn>
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
                    title="Emitir constancia"
                    icon="award"
                    onPress={issue}
                    loading={saving}
                    disabled={description.trim().length < 5}
                  />
                  <Button icon="x" title="Cancelar" variant="secondary" onPress={() => setTarget(null)} />
                </View>
              )}

              <Text style={styles.section}>Emitidas ({issued.length})</Text>
              {issued.length === 0 ? (
                <Muted>Todavía no se emitió ninguna constancia para esta actividad.</Muted>
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
        </FadeIn>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15.5, fontWeight: '700', color: colors.gray900, marginBottom: 3 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  toggle: { color: colors.bordo, fontSize: 12.5, fontWeight: '600' },
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
