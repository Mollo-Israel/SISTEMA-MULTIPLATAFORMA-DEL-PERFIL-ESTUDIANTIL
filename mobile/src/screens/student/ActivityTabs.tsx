import { useState } from 'react';
import { rango } from '../../fechas';
import { StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { activityService, recommendationService, type RecommendationItem } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Button, EmptyState, ErrorText, Muted, SkeletonCards } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { REGISTRATION_STATUS_LABEL, lbl } from '../../constants';
import { colors, registrationColor } from '../../theme';

/**
 * «Para ti» dentro de Actividades: las oportunidades sugeridas con su motivo
 * en palabras. V6 §9.1: sin «No me interesa» ni «Más sugerencias»; «Guardar»
 * es un favorito que no cambia el orden.
 */
export function ParaTi() {
  const { data, loading, error, reload } = useAsync(() => recommendationService.mine(), []);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const toast = useToast();
  const items = (data?.groups ?? [])
    .flatMap((g) => g.items)
    .filter((i: RecommendationItem) => i.type === 'activity' || i.type === 'opportunity');
  const [guardadas, setGuardadas] = useState<Set<string>>(new Set());

  const guardar = async (i: RecommendationItem) => {
    setOcupado(i.id);
    try {
      const ya = guardadas.has(i.targetId);
      await (ya ? activityService.unfavorite(i.targetId) : activityService.favorite(i.targetId));
      setGuardadas((s) => { const n = new Set(s); if (ya) n.delete(i.targetId); else n.add(i.targetId); return n; });
      toast.success(ya ? 'Quitada de guardadas.' : 'Guardada.', ya ? undefined : 'No cambia lo que te sugerimos.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <View>
      <Muted>Según lo que quieres explorar o mejorar, no según lo que ya sabes.</Muted>
      {loading && !data && <SkeletonCards count={2} />}
      {error && <ErrorText message={error} />}
      {data && items.length === 0 && <EmptyState icon="compass" message={data.message || 'Por ahora no hay sugerencias de actividades.'} />}
      {items.map((i) => (
        <View key={i.id} style={styles.card}>
          <Text style={styles.titulo}>{i.title}</Text>
          {i.area && <Muted>{i.area.name}</Muted>}
          {i.reasons.filter((r) => r.points > 0 || r.code === 'context_match').slice(0, 2).map((r, k) => <Text key={k} style={styles.motivo}>• {r.label}</Text>)}
          <View style={styles.fila}>
            <Button small icon="bookmark" title={guardadas.has(i.targetId) ? 'Quitar de guardadas' : 'Guardar'} loading={ocupado === i.id} onPress={() => void guardar(i)} />
          </View>
        </View>
      ))}
      <Muted>Se ordena por lo que declaraste en tu perfil. Guardar o inscribirte no cambia el orden.</Muted>
    </View>
  );
}

const GRUPOS: Record<'inscritas' | 'historial', { estados: string[]; vacio: string }> = {
  inscritas: { estados: ['registered', 'accepted'], vacio: 'No tienes inscripciones pendientes.' },
  historial: { estados: ['confirmed', 'absent'], vacio: 'Todavía no hay participaciones confirmadas.' },
};

/** Inscritas e Historial, desde tus inscripciones. */
export function MisInscripciones({ grupo }: { grupo: keyof typeof GRUPOS }) {
  const { data, loading, error } = useAsync(() => activityService.myRegistrations(), []);
  const filas = (data ?? []).filter((r: any) => GRUPOS[grupo].estados.includes(r.status));
  return (
    <View>
      {loading && !data && <SkeletonCards count={2} />}
      {error && <ErrorText message={error} />}
      {data && filas.length === 0 && <EmptyState icon="calendar" message={GRUPOS[grupo].vacio} />}
      {filas.map((r: any) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.titulo}>{r.activity?.title ?? 'Actividad'}</Text>
          <View style={styles.fila}>
            <Badge color={registrationColor(r.status)}>{lbl(REGISTRATION_STATUS_LABEL, r.status)}</Badge>
            {r.activity?.eventDate && <Muted>{rango(r.activity.eventDate, r.activity.endAt)}</Muted>}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.gray200, marginTop: 10 },
  titulo: { color: colors.gray900, fontWeight: '700', fontSize: 15, marginBottom: 4 },
  motivo: { color: colors.gray700, marginTop: 2 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
});
