import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import {
  Screen,
  Card,
  Muted,
  Field,
  Button,
  EmptyState,
  FadeIn,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { LevelPicker } from '../../components/LevelPicker';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Datos declarativos del perfil relacionados con intereses (RF5).
 *
 * El documento distingue dos cosas que aquí aparecen separadas:
 *   - Intereses: texto libre escrito por el estudiante.
 *   - Áreas de preferencia: selección del catálogo de áreas, con prioridad 1-5.
 */
export default function InterestsScreen() {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [freeInterests, setFreeInterests] = useState<any[]>([]);
  const [savingAreas, setSavingAreas] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  // Alta / edición de un interés en texto libre
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingInterest, setSavingInterest] = useState(false);

  const loadFree = useCallback(
    () => profileService.freeInterests().then(setFreeInterests),
    [],
  );

  useEffect(() => {
    Promise.all([
      catalogService.areas().then(setAreas),
      profileService
        .summary()
        .then((s: any) => {
          const source = s?.preferredAreas ?? s?.interests ?? [];
          setValues(Object.fromEntries(source.map((i: any) => [i.academicAreaId, i.priority])));
        })
        .catch(() => {}),
      loadFree().catch(() => {}),
    ])
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFree]);

  const notify = (t: string, detail?: string) => toast.success(t, detail);

  const visibleAreas = useMemo(() => {
    const q = normalize(areaQuery.trim());
    if (!q) return areas;
    return areas.filter((a) => normalize(a.name ?? '').includes(q));
  }, [areas, areaQuery]);

  const chosenAreas = Object.values(values).filter((p) => p > 0).length;

  const saveAreas = async () => {
    setSavingAreas(true);
    try {
      await profileService.setPreferredAreas(
        Object.entries(values)
          .filter(([, p]) => p > 0)
          .map(([academicAreaId, priority]) => ({ academicAreaId, priority })),
      );
      notify(
        'Áreas de preferencia guardadas.',
        `${chosenAreas} área${chosenAreas === 1 ? '' : 's'} con prioridad.`,
      );
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSavingAreas(false);
    }
  };

  const submitInterest = async () => {
    setSavingInterest(true);
    try {
      if (editingId) {
        await profileService.updateFreeInterest(editingId, {
          name: newName,
          description: newDescription || undefined,
        });
        notify('Interés actualizado.');
      } else {
        await profileService.addFreeInterest({
          name: newName,
          description: newDescription || undefined,
        });
        notify('Interés agregado.');
      }
      setNewName('');
      setNewDescription('');
      setEditingId(null);
      await loadFree();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSavingInterest(false);
    }
  };

  const startEdit = (i: any) => {
    setEditingId(i.id);
    setNewName(i.name);
    setNewDescription(i.description ?? '');
  };

  const removeInterest = async (interest: any) => {
    const ok = await confirm({
      title: 'Quitar interés',
      message: `Se eliminará “${interest.name}” de tu perfil. Esta acción no se puede deshacer.`,
      confirmLabel: 'Quitar',
      tone: 'danger',
    });
    if (!ok) return;
    setRemoving(interest.id);
    try {
      await profileService.removeFreeInterest(interest.id);
      notify('Interés eliminado.');
      if (editingId === interest.id) {
        setEditingId(null);
        setNewName('');
        setNewDescription('');
      }
      await loadFree();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <Screen>
        <SkeletonCards count={3} />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        title="Intereses y áreas de preferencia"
        description="Los intereses los escribes con tus palabras. Las áreas de preferencia salen del catálogo de la carrera y llevan una prioridad."
      />

      <Card title={editingId ? 'Editar interés' : 'Agregar un interés'}>
        <Field
          label="Interés"
          value={newName}
          onChangeText={setNewName}
          placeholder="Desarrollo de videojuegos"
        />
        <Field
          label="Descripción (opcional)"
          value={newDescription}
          onChangeText={setNewDescription}
          placeholder="Motores 2D, diseño de niveles y mecánicas."
          multiline
        />
        <Button
          title={editingId ? 'Guardar cambios' : 'Agregar interés'}
          onPress={submitInterest}
          loading={savingInterest}
          disabled={newName.trim().length < 3}
        />
        {editingId && (
          <Button
            title="Cancelar edición"
            variant="secondary"
            onPress={() => {
              setEditingId(null);
              setNewName('');
              setNewDescription('');
            }}
          />
        )}
      </Card>

      <Card title={`Mis intereses (${freeInterests.length})`}>
        {freeInterests.length === 0 ? (
          <EmptyState
            icon="✎"
            message="Todavía no registras intereses. Agrega el primero arriba."
          />
        ) : (
          freeInterests.map((i, index) => (
            <FadeIn key={i.id} index={index}>
              <View style={styles.interestRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.interestName}>{i.name}</Text>
                  {i.description ? <Text style={styles.interestDesc}>{i.description}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable onPress={() => startEdit(i)} hitSlop={8}>
                    <Text style={styles.action}>Editar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removeInterest(i)}
                    hitSlop={8}
                    disabled={removing === i.id}
                  >
                    <Text style={[styles.action, { color: colors.red }]}>
                      {removing === i.id ? 'Quitando…' : 'Quitar'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </FadeIn>
          ))
        )}
      </Card>

      <Card title={`Áreas de preferencia (${chosenAreas} con prioridad)`}>
        <Muted>Prioridad de 1 a 5 (— para ninguna).</Muted>

        <View style={{ marginTop: 10 }}>
          <SearchInput
            value={areaQuery}
            onChangeText={setAreaQuery}
            placeholder="Buscar área…"
          />
          <ResultCount shown={visibleAreas.length} total={areas.length} noun="áreas" />
        </View>

        <View>
          {visibleAreas.length === 0 ? (
            <EmptyState
              icon="⌕"
              message={`Ningún área coincide con “${areaQuery}”.`}
              action={
                <Button
                  title="Limpiar búsqueda"
                  variant="secondary"
                  small
                  onPress={() => setAreaQuery('')}
                />
              }
            />
          ) : (
            visibleAreas.map((a) => (
              <View key={a.id} style={styles.row}>
                <Text style={styles.name}>{a.name}</Text>
                <LevelPicker
                  value={values[a.id] ?? 0}
                  onChange={(v) => setValues({ ...values, [a.id]: v })}
                />
              </View>
            ))
          )}
        </View>
        <Button
          title="Guardar áreas de preferencia"
          onPress={saveAreas}
          loading={savingAreas}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    paddingBottom: 10,
  },
  name: { fontWeight: '600', color: colors.gray900, marginBottom: 6 },
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  interestName: { fontSize: 14.5, fontWeight: '600', color: colors.gray900 },
  interestDesc: { fontSize: 12.5, color: colors.gray500, marginTop: 2 },
  action: { fontSize: 12.5, fontWeight: '600', color: colors.bordo },
});
