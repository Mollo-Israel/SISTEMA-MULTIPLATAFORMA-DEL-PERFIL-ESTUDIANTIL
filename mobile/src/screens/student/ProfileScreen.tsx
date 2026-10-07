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
  // Semestre y codigo van aparte del formulario: §17.1 los declara
  // institucionales y el estudiante solo los consulta.
  const [institucional, setInstitucional] = useState({
    universityCode: null as string | null,
    semester: null as number | null,
  });
  const [form, setForm] = useState({ bio: '', improvementAreaIds: [] as string[] });
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
          setInstitucional({
            universityCode: p.universityCode ?? null,
            semester: p.semester ?? null,
          });
          setForm({
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
        <View style={styles.institucional}>
          <Text style={styles.instTitulo}>Datos institucionales</Text>
          <Text style={styles.instFila}>
            Semestre: <Text style={styles.instValor}>
              {institucional.semester ? `${institucional.semester}.º` : "Sin asignar"}
            </Text>
          </Text>
          <Text style={styles.instFila}>
            Código: <Text style={styles.instValor}>{institucional.universityCode ?? "Sin asignar"}</Text>
          </Text>
          <Muted>Los aporta la carrera desde el padrón. No se editan aquí.</Muted>
        </View>

        <Field label="Descripción / bio" value={form.bio} onChangeText={(t) => setForm({ ...form, bio: t })} multiline />

        <View style={styles.areaHead}>
          <Text style={styles.label}>Áreas donde deseas mejorar</Text>
          <Muted>{chosen} seleccionada{chosen === 1 ? '' : 's'}</Muted>
        </View>
        <SearchInput value={areaQuery} onChangeText={setAreaQuery} placeholder="Buscar área…" />
        <ResultCount shown={visibleAreas.length} total={areas.length} noun="áreas" />

        {visibleAreas.length === 0 ? (
          <EmptyState
            icon="search"
            message={`Ningún área coincide con “${areaQuery}”.`}
            action={
              <Button
                title="Limpiar búsqueda"
                icon="x"
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

      <Button icon="target" title="Registrar intereses" variant="secondary" onPress={() => navigation.navigate('Intereses')} />
      <Button icon="award" title="Tecnologías que me interesan" variant="secondary" onPress={() => navigation.navigate('Habilidades')} />
      <Button icon="paperclip" title="Evidencias y certificados" variant="secondary" onPress={() => navigation.navigate('Evidencias')} />
      <Button icon="map" title="Mi trayectoria" variant="secondary" onPress={() => navigation.navigate('Trayectoria')} />
      <Button icon="users" title="Colaboración y equipos" variant="secondary" onPress={() => navigation.navigate('Colaboracion')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  areaHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: colors.gray700, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  // Borde discontinuo: dice "esto no se edita" sin un candado por campo.
  institucional: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray300,
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  instTitulo: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.gray500,
    fontWeight: '700',
    marginBottom: 6,
  },
  instFila: { fontSize: 13, color: colors.gray700, marginBottom: 2 },
  instValor: { fontWeight: '700', color: colors.gray900 },
});
