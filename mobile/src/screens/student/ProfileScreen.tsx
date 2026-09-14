import { useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import {
  Screen, Card, Muted, Field, Button, Chip, EmptyState, PageHeader, ProgressBar,
  ResultCount, SearchInput, SkeletonCards,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function ProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [areas, setAreas] = useState<any[]>([]);
  const [completion, setCompletion] = useState(0);
  const [form, setForm] = useState({ universityCode: '', semester: '', bio: '', improvementAreaIds: [] as string[] });
  const [areaQuery, setAreaQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

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
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleAreas = useMemo(() => {
    const q = normalize(areaQuery.trim());
    if (!q) return areas;
    return areas.filter((a) => normalize(a.name ?? '').includes(q));
  }, [areas, areaQuery]);

  const toggle = (id: string) =>
    setForm((f) => ({
      ...f,
      improvementAreaIds: f.improvementAreaIds.includes(id)
        ? f.improvementAreaIds.filter((x) => x !== id)
        : [...f.improvementAreaIds, id],
    }));

  const save = async () => {
    setSaving(true);
    const payload: any = {
      semester: form.semester ? Number(form.semester) : undefined,
      bio: form.bio || undefined,
      improvementAreaIds: form.improvementAreaIds,
    };
    try {
      const r = exists ? await profileService.update(payload) : await profileService.create(payload);
      setExists(true);
      setCompletion(r.completionPercentage);
      toast.success(
        exists ? 'Perfil actualizado.' : 'Perfil creado.',
        `Tu completitud ahora es del ${r.completionPercentage}%.`,
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

  const chosen = form.improvementAreaIds.length;

  return (
    <Screen>
      <PageHeader
        title="Completar perfil"
        description="Lo que declaras aquí, junto a tu actividad, alimenta tus áreas de afinidad."
      />

      <Card>
        <ProgressBar
          value={completion}
          label="Avance de tu perfil"
          tone={completion >= 80 ? colors.green : completion >= 40 ? colors.amber : colors.bordo}
        />
      </Card>

      <Card>
        <Field label="Semestre (1–8)" value={form.semester} onChangeText={(t) => setForm({ ...form, semester: t })} keyboardType="numeric" />
        <Field label="Descripción / bio" value={form.bio} onChangeText={(t) => setForm({ ...form, bio: t })} multiline />

        <View style={styles.areaHead}>
          <Text style={styles.label}>Áreas donde deseas mejorar</Text>
          <Muted>{chosen} seleccionada{chosen === 1 ? '' : 's'}</Muted>
        </View>
        <SearchInput value={areaQuery} onChangeText={setAreaQuery} placeholder="Buscar área…" />
        <ResultCount shown={visibleAreas.length} total={areas.length} noun="áreas" />

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
          <View style={styles.chips}>
            {visibleAreas.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                on={form.improvementAreaIds.includes(a.id)}
                onPress={() => toggle(a.id)}
              />
            ))}
          </View>
        )}

        <Button
          title={exists ? 'Guardar cambios' : 'Crear perfil'}
          onPress={save}
          loading={saving}
        />
      </Card>

      <Button title="Registrar intereses" variant="secondary" onPress={() => navigation.navigate('Intereses')} />
      <Button title="Registrar habilidades" variant="secondary" onPress={() => navigation.navigate('Habilidades')} />
      <Button title="Evidencias y certificados" variant="secondary" onPress={() => navigation.navigate('Evidencias')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  areaHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: colors.gray700, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
});
