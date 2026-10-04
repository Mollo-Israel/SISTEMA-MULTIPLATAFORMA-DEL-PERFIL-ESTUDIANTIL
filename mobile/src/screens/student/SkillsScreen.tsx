import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, profileService, type SkillInterestKind } from '../../services';
import {
  Screen, Card, Muted, Button, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonCards,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const OPCIONES: { value: SkillInterestKind | ''; label: string }[] = [
  { value: '', label: '—' },
  { value: 'interest', label: 'Me interesa' },
  { value: 'improve', label: 'Quiero mejorar' },
];

/**
 * Tecnologías que me interesan o quiero mejorar (V2 §21, §22).
 *
 * Ya no se declara un nivel: «soy avanzado en React» no era una señal fiable.
 * Lo que se sabe hacer aparece aparte, como tecnologías respaldadas por
 * proyectos y actividades confirmadas.
 */
export default function SkillsScreen() {
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, SkillInterestKind>>({});
  const [respaldadas, setRespaldadas] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      catalogService.skills(),
      profileService.skillInterests().catch(() => []),
      profileService.summary().catch(() => null),
    ])
      .then(([sk, intereses, resumen]) => {
        setSkills(sk.filter((s: any) => s.isActive !== false));
        setValues(Object.fromEntries(intereses.map((x) => [x.skillId, x.kind])));
        setRespaldadas(resumen?.skills ?? []);
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

  const marcadas = Object.keys(values).length;

  const save = async () => {
    setSaving(true);
    try {
      await profileService.replaceSkillInterests(
        Object.entries(values).map(([skillId, kind]) => ({ skillId, kind })),
      );
      toast.success('Tecnologías guardadas.', `${marcadas} tecnología${marcadas === 1 ? '' : 's'} marcada${marcadas === 1 ? '' : 's'}.`);
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
        title="Tecnologías"
        description="Marca las que te interesan o quieres mejorar. Nos ayudan a recomendarte; no cambian tu afinidad."
      />

      <Card title="Con respaldo en tu trayectoria">
        {respaldadas.length === 0 ? (
          <Muted>Todavía ninguna. Aparecen al confirmar tu contribución en un proyecto o tu participación en una actividad.</Muted>
        ) : (
          <View style={styles.chips}>
            {respaldadas.map((r: any) => (
              <Text key={r.skillId} style={styles.chip}>{r.skill} · {r.evidenceCount}</Text>
            ))}
          </View>
        )}
      </Card>

      <SearchInput value={query} onChangeText={setQuery} placeholder="Buscar tecnología o área…" />
      <View style={styles.counters}>
        <ResultCount shown={visible.length} total={skills.length} noun="tecnologías" />
        <Muted>{marcadas} marcadas</Muted>
      </View>

      <Card>
        {visible.length === 0 ? (
          <EmptyState
            icon="search"
            message={`Ninguna tecnología coincide con “${query}”.`}
            action={<Button icon="x" title="Limpiar búsqueda" variant="secondary" small onPress={() => setQuery('')} />}
          />
        ) : (
          visible.map((s) => (
            <View key={s.id} style={styles.row}>
              <Text style={styles.name}>{s.name} <Text style={styles.area}>· {s.academicArea?.name ?? 'General'}</Text></Text>
              <View style={styles.opts}>
                {OPCIONES.map((o) => {
                  const on = (values[s.id] ?? '') === o.value;
                  return (
                    <Pressable
                      key={o.label}
                      onPress={() => {
                        const next = { ...values };
                        if (o.value === '') delete next[s.id];
                        else next[s.id] = o.value;
                        setValues(next);
                      }}
                      style={[styles.opt, on && styles.optOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.optText, on && styles.optTextOn]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </Card>
      <Button icon="save" title="Guardar tecnologías" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  counters: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingBottom: 10 },
  name: { fontWeight: '600', color: colors.gray900, marginBottom: 6 },
  area: { fontWeight: '400', color: colors.gray500, fontSize: 12 },
  opts: { flexDirection: 'row', gap: 6 },
  opt: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.gray200 },
  optOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  optText: { fontSize: 12, color: colors.gray700 },
  optTextOn: { color: colors.white, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.bordoBg, color: colors.bordo, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, fontSize: 12, fontWeight: '600' },
});
