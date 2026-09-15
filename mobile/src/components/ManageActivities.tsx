import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../api/client';
import { activityService, catalogService } from '../services';
import {
  Screen,
  Card,
  Muted,
  Field,
  Button,
  Chip,
  EmptyState,
  FadeIn,
  Badge,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
} from './ui';
import { useConfirm, useToast } from './feedback';
import {
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABEL,
  REGISTRATION_STATUS_LABEL,
  lbl,
} from '../constants';
import { colors, registrationColor } from '../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  const [categories, setCategories] = useState<any[]>([]);
  // Del catálogo administrable (RF4): las que aplican a este tipo o a ambos.
  const usableCategories = categories.filter(
    (c: any) => c.isActive && (!c.appliesTo || c.appliesTo === activityType),
  );

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
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
    Promise.all([load(), catalogService.activityCategories().then(setCategories)])
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const notify = (t: string, detail?: string) => toast.success(t, detail);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return items;
    return items.filter((a: any) =>
      [a.title, a.description ?? '', a.location ?? '', a.category?.name ?? '']
        .some((f: string) => normalize(f).includes(q)),
    );
  }, [items, query]);

  const publish = async () => {
    if (!form.categoryId) {
      toast.info('Seleccione una categoría antes de guardar.');
      return;
    }
    setSaving(true);
    try {
      await activityService.create({
        title: form.title,
        description: form.description || undefined,
        type: activityType,
        categoryId: form.categoryId,
        location: form.location || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        status: form.status,
      });
      setForm({ ...form, title: '', description: '', capacity: '', location: '' });
      setShowForm(false);
      notify(
        form.status === 'draft' ? 'Guardada como borrador.' : 'Actividad publicada.',
        form.status === 'draft' ? 'Todavía no es visible para los estudiantes.' : undefined,
      );
      await load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (activity: any, status: string) => {
    if (status === 'cancelled' || status === 'draft') {
      const ok = await confirm({
        title: status === 'cancelled' ? 'Cancelar la actividad' : 'Devolver a borrador',
        message:
          `“${activity.title}” dejará de estar disponible para los estudiantes`
          + ((activity.registrationCount ?? 0) > 0
            ? ` y ya tiene ${activity.registrationCount} inscripción(es) registrada(s).`
            : '.'),
        confirmLabel: status === 'cancelled' ? 'Cancelar actividad' : 'Devolver a borrador',
        cancelLabel: 'Dejar como está',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await activityService.update(activity.id, { status });
      notify(`Estado: ${lbl(ACTIVITY_STATUS_LABEL, status)}.`);
      await load();
    } catch (e) {
      toast.error(apiError(e));
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
    try {
      setParticipants(await activityService.participants(id));
    } catch (e) {
      toast.error(apiError(e));
      setParticipants([]);
    } finally {
      setPartBusy(false);
    }
  };

  const decide = async (activityId: string, row: any, status: string) => {
    const who = row.studentName ?? 'el estudiante';
    if (status === 'absent') {
      const ok = await confirm({
        title: 'Registrar ausencia',
        message:
          `Se registrará a ${who} como ausente.`
          + (row.status === 'confirmed'
            ? ' Su participación estaba confirmada y dejará de contar en su perfil.'
            : ''),
        confirmLabel: 'Registrar ausente',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusyRow(row.id);
    try {
      await activityService.confirm(activityId, row.studentProfileId, status);
      setParticipants(await activityService.participants(activityId));
      await load();
      notify(
        status === 'confirmed' ? 'Participación confirmada.' : 'Registrado como ausente.',
        who,
      );
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusyRow(null);
    }
  };

  if (loading) {
    return (
      <Screen>
        <SkeletonCards count={3} />
      </Screen>
    );
  }

  const tipo = activityType === 'academica' ? 'académicas' : 'extracurriculares';

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <PageHeader
        title={`Actividades ${tipo}`}
        description="Publique, gestione el estado y registre la participación de los estudiantes."
      />

      {!showForm ? (
        <Button icon="plus" title="Nueva actividad" onPress={() => setShowForm(true)} />
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
            {usableCategories.map((c: any) => (
              <Chip
                key={c.id}
                label={c.name}
                on={form.categoryId === c.id}
                onPress={() => setForm({ ...form, categoryId: c.id })}
              />
            ))}
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
            {ACTIVITY_STATUSES.filter((s) => ['draft', 'published', 'open'].includes(s)).map((s) => (
              <Chip
                key={s}
                label={lbl(ACTIVITY_STATUS_LABEL, s)}
                on={form.status === s}
                onPress={() => setForm({ ...form, status: s })}
              />
            ))}
          </View>
          <Muted>En borrador la actividad no es visible para los estudiantes.</Muted>
          <Button icon="save" title="Guardar" onPress={publish} loading={saving} />
          <Button icon="x" title="Cancelar" variant="secondary" onPress={() => setShowForm(false)} />
        </Card>
      )}

      {items.length > 0 && (
        <>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por título, lugar o categoría…"
          />
          <ResultCount shown={visible.length} total={items.length} noun="actividades" />
        </>
      )}

      {items.length === 0 && (
        <EmptyState
          icon="calendar"
          message={`Todavía no ha publicado actividades ${tipo}.`}
        />
      )}

      {items.length > 0 && visible.length === 0 && (
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

      {visible.map((a: any, index: number) => {
        const pending = (a.registrationCount ?? 0) - (a.confirmedCount ?? 0);
        const isOpen = openId === a.id;
        const full = !!(a.capacity && (a.confirmedCount ?? 0) >= a.capacity);
        return (
          <FadeIn key={a.id} index={index}>
          <Card>
            <Text style={styles.title}>{a.title}</Text>
            <View style={styles.badges}>
              <Badge color={colors.bordo}>{lbl(ACTIVITY_STATUS_LABEL, a.status)}</Badge>
              <Badge>{a.category?.name ?? '—'}</Badge>
            </View>
            <Muted>
              Confirmados: {a.confirmedCount ?? 0}
              {a.capacity ? ` de ${a.capacity}` : ' (sin límite)'}
              {pending > 0 ? ` · ${pending} por registrar` : ''}
            </Muted>

            <Text style={styles.label}>Cambiar estado</Text>
            <View style={styles.chips}>
              {ACTIVITY_STATUSES.map((s) => (
                <Chip
                  key={s}
                  label={lbl(ACTIVITY_STATUS_LABEL, s)}
                  on={a.status === s}
                  onPress={() => a.status !== s && changeStatus(a, s)}
                />
              ))}
            </View>

            <Button
              title={isOpen ? 'Ocultar participantes' : 'Registrar participación'}
              variant="secondary"
              onPress={() => openParticipants(a.id)}
            />

            {isOpen && partBusy && <SkeletonCards count={2} />}
            {isOpen && !partBusy && participants.length === 0 && (
              <EmptyState
                icon="users"
                message="Todavía nadie se inscribió ni marcó interés."
              />
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
                        loading={busyRow === p.id}
                        small
                        onPress={() => decide(a.id, p, 'confirmed')}
                      />
                    )}
                    {p.status !== 'absent' && (
                      <Button
                        title="Ausente"
                        icon="user-x"
                        variant="secondary"
                        loading={busyRow === p.id}
                        small
                        onPress={() => decide(a.id, p, 'absent')}
                      />
                    )}
                  </View>
                </View>
              ))}
          </Card>
          </FadeIn>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: colors.gray700, marginTop: 10, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
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
