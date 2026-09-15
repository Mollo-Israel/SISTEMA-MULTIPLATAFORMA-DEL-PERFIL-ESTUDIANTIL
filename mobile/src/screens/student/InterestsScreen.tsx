import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import {
  Screen,
  Card,
  Muted,
  Button,
  EmptyState,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import { LevelPicker } from '../../components/LevelPicker';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Intereses por area del estudiante (RF5).
 *
 * El estudiante no crea intereses: elige del catalogo de areas de la carrera y
 * le pone una prioridad de 1 a 5. Es exactamente lo que ofrece el panel web en
 * "Intereses y habilidades", para que el mismo dato se declare igual desde
 * cualquiera de los dos clientes.
 */
export default function InterestsScreen() {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const toast = useToast();

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
    ])
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleAreas = useMemo(() => {
    const q = normalize(areaQuery.trim());
    if (!q) return areas;
    return areas.filter((a) => normalize(a.name ?? '').includes(q));
  }, [areas, areaQuery]);

  const chosen = Object.values(values).filter((p) => p > 0).length;

  const save = async () => {
    setSaving(true);
    try {
      await profileService.setPreferredAreas(
        Object.entries(values)
          .filter(([, p]) => p > 0)
          .map(([academicAreaId, priority]) => ({ academicAreaId, priority })),
      );
      toast.success(
        'Intereses guardados.',
        `${chosen} área${chosen === 1 ? '' : 's'} con prioridad.`,
      );
    } catch (e) {
      toast.error(apiError(e));
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

  return (
    <Screen>
      <PageHeader
        title="Intereses por área"
        description="Indica qué tanto te interesa cada área de la carrera. Lo que declares aquí alimenta tus áreas de afinidad y las recomendaciones que recibes."
      />

      <Card title={`Áreas académicas (${chosen} con prioridad)`}>
        <Muted>Prioridad de 1 a 5 (— para ninguna).</Muted>

        <View style={{ marginTop: 10 }}>
          <SearchInput
            value={areaQuery}
            onChangeText={setAreaQuery}
            placeholder="Buscar área…"
          />
          <ResultCount shown={visibleAreas.length} total={areas.length} noun="áreas" />
        </View>

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

        <Button title="Guardar intereses" onPress={save} loading={saving} />
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
});
