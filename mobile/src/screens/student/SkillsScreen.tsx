import { useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import {
  Screen, Card, Muted, Button, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonCards,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import { LevelPicker } from '../../components/LevelPicker';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function SkillsScreen() {
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([catalogService.skills(), profileService.summary().catch(() => null)])
      .then(([sk, s]) => {
        setSkills(sk);
        if (s) setValues(Object.fromEntries(s.skills.map((x: any) => [x.skillId, x.level])));
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return skills;
    return skills.filter((s) =>
      [s.name, s.academicArea?.name ?? ''].some((f: string) => normalize(f).includes(q)),
    );
  }, [skills, query]);

  const declared = Object.values(values).filter((l) => l > 0).length;

  const save = async () => {
    setSaving(true);
    try {
      await profileService.setSkills(
        Object.entries(values).filter(([, l]) => l > 0).map(([skillId, level]) => ({ skillId, level })),
      );
      toast.success(
        'Habilidades guardadas.',
        `${declared} habilidad${declared === 1 ? '' : 'es'} con nivel declarado.`,
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
        title="Habilidades declaradas"
        description="Nivel de 1 a 5 (— para ninguno). El área de cada habilidad es la que recibe puntaje en tu afinidad."
      />

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar habilidad o área…"
      />
      <View style={styles.counters}>
        <ResultCount shown={visible.length} total={skills.length} noun="habilidades" />
        <Muted>{declared} con nivel</Muted>
      </View>

      <Card>
        {visible.length === 0 ? (
          <EmptyState
            icon="search"
            message={`Ninguna habilidad coincide con “${query}”.`}
            action={<Button icon="x" title="Limpiar búsqueda" variant="secondary" small onPress={() => setQuery('')} />}
          />
        ) : (
          visible.map((s) => (
            <View key={s.id} style={styles.row}>
              <Text style={styles.name}>{s.name} <Text style={styles.area}>· {s.academicArea?.name ?? 'General'}</Text></Text>
              <LevelPicker value={values[s.id] ?? 0} onChange={(v) => setValues({ ...values, [s.id]: v })} />
            </View>
          ))
        )}
      </Card>
      <Button icon="save" title="Guardar habilidades" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  counters: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingBottom: 10 },
  name: { fontWeight: '600', color: colors.gray900, marginBottom: 6 },
  area: { fontWeight: '400', color: colors.gray500, fontSize: 12 },
});
