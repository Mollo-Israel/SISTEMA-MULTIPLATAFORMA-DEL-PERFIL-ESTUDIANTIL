import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { trajectoryService, type TrajectoryHistory } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Screen, Card, Badge, Chip, EmptyState, ErrorText, Muted, PageHeader, SkeletonCards } from '../../components/ui';
import { colors } from '../../theme';

const COLOR_NIVEL: Record<string, string> = {
  declared: colors.gray500,
  supported: '#2f6db5',
  corroborated: colors.green,
  reviewed: colors.bordo,
  incomplete: colors.amber,
};
const TIPO: Record<string, string> = {
  project: 'Proyecto',
  activity: 'Actividad interna',
  external_opportunity: 'Oportunidad externa',
  constancy: 'Constancia',
  credential: 'Credencial externa',
  team: 'Equipo',
  feedback: 'Retroalimentación',
};

/**
 * Mi trayectoria (V3 §42): todo lo hecho, con el nivel de cada cosa en
 * palabras —declarado, con respaldo, corroborado, revisado o inconcluso—, y
 * qué puede ir al currículo. El currículo se arma desde la web.
 */
export default function TrajectoryScreen() {
  const { data, loading, error, reload } = useAsync<TrajectoryHistory>(() => trajectoryService.history(), []);
  const [filtro, setFiltro] = useState('todos');
  const entradas = (data?.entries ?? []).filter((e) => filtro === 'todos' || e.level === filtro);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader title="Mi trayectoria" description="Lo que hiciste y qué tan respaldado está cada cosa." />
      {loading && !data && <SkeletonCards count={3} />}
      {error && <ErrorText message={error} />}
      {data && (
        <>
          <Card title="Cómo leerla">
            {data.levels.map((l) => (
              <View key={l.key} style={styles.leyenda}>
                <Badge color={COLOR_NIVEL[l.key]}>{l.label}</Badge>
                <Text style={styles.explica}>{l.explain}</Text>
              </View>
            ))}
          </Card>
          <View style={styles.filtros}>
            <Chip label={`Todo (${data.entries.length})`} on={filtro === 'todos'} onPress={() => setFiltro('todos')} />
            {data.levels.map((l) => (
              <Chip key={l.key} label={`${l.label} (${l.count})`} on={filtro === l.key} onPress={() => setFiltro(l.key)} />
            ))}
          </View>
          {entradas.length === 0 && (
            <EmptyState icon="map" message={data.entries.length === 0 ? 'Todavía no hay nada en tu trayectoria.' : 'Nada en este nivel.'} />
          )}
          {entradas.map((e) => (
            <View key={`${e.kind}-${e.id}`} style={styles.entrada}>
              <Text style={styles.tipo}>{TIPO[e.kind] ?? e.kind}</Text>
              <Text style={styles.titulo}>{e.title}</Text>
              <View style={styles.fila}>
                {e.levelLabel && <Badge color={COLOR_NIVEL[e.level ?? 'declared']}>{e.levelLabel}</Badge>}
                {e.cvEligible && <Badge color={colors.green}>Puede ir al currículo</Badge>}
              </View>
              <Muted>
                {e.date ? `${new Date(e.date).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })} · ` : ''}
                {e.detail}
              </Muted>
            </View>
          ))}
          {data.evolution.length > 0 && (
            <Card title="Afinidad y respaldo actuales">
              {data.evolution.map((a, i) => (
                <Text key={i} style={styles.explica}>
                  {a.area} · afinidad {Math.round(a.score)}/100
                  {a.supportScore !== null ? ` · respaldo ${Math.round(a.supportScore)}/100` : ''}
                </Text>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  explica: { color: colors.gray700, flexShrink: 1 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  entrada: { backgroundColor: colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.gray200, marginBottom: 10 },
  tipo: { color: colors.gray500, fontSize: 12, fontWeight: '600' },
  titulo: { color: colors.gray900, fontWeight: '700', fontSize: 15, marginVertical: 4 },
  fila: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
});
