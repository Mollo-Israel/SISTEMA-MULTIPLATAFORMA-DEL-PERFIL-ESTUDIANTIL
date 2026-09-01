import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
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
} from '../../components/ui';
import { LevelPicker } from '../../components/LevelPicker';
import { colors } from '../../theme';

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
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingAreas, setSavingAreas] = useState(false);

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
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [loadFree]);

  const notify = (t: string) => {
    setMsg(t);
    setError(null);
  };

  const saveAreas = async () => {
    setError(null);
    setMsg(null);
    setSavingAreas(true);
    try {
      await profileService.setPreferredAreas(
        Object.entries(values)
          .filter(([, p]) => p > 0)
          .map(([academicAreaId, priority]) => ({ academicAreaId, priority })),
      );
      notify('Áreas de preferencia guardadas.');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSavingAreas(false);
    }
  };

  const submitInterest = async () => {
    setError(null);
    setMsg(null);
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
      setError(apiError(e));
    } finally {
      setSavingInterest(false);
    }
  };

  const startEdit = (i: any) => {
    setEditingId(i.id);
    setNewName(i.name);
    setNewDescription(i.description ?? '');
  };

  const removeInterest = async (id: string) => {
    setError(null);
    try {
      await profileService.removeFreeInterest(id);
      notify('Interés eliminado.');
      if (editingId === id) {
        setEditingId(null);
        setNewName('');
        setNewDescription('');
      }
      await loadFree();
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <H1>Intereses y áreas de preferencia</H1>
      <Muted>
        Los intereses los escribes con tus palabras. Las áreas de preferencia salen del catálogo de
        la carrera y llevan una prioridad.
      </Muted>

      {error && <ErrorText message={error} />}
      {msg && <Success message={msg} />}

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
          title={savingInterest ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar interés'}
          onPress={submitInterest}
          disabled={savingInterest || newName.trim().length < 3}
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
          <EmptyState message="Todavía no registras intereses. Agrega el primero arriba." />
        ) : (
          freeInterests.map((i) => (
            <View key={i.id} style={styles.interestRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.interestName}>{i.name}</Text>
                {i.description ? <Text style={styles.interestDesc}>{i.description}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable onPress={() => startEdit(i)} hitSlop={8}>
                  <Text style={styles.action}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => removeInterest(i.id)} hitSlop={8}>
                  <Text style={[styles.action, { color: colors.red }]}>Quitar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card title="Áreas de preferencia">
        <Muted>Prioridad de 1 a 5 (— para ninguna).</Muted>
        <View style={{ marginTop: 10 }}>
          {areas.map((a) => (
            <View key={a.id} style={styles.row}>
              <Text style={styles.name}>{a.name}</Text>
              <LevelPicker
                value={values[a.id] ?? 0}
                onChange={(v) => setValues({ ...values, [a.id]: v })}
              />
            </View>
          ))}
        </View>
        <Button
          title={savingAreas ? 'Guardando…' : 'Guardar áreas de preferencia'}
          onPress={saveAreas}
          disabled={savingAreas}
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
