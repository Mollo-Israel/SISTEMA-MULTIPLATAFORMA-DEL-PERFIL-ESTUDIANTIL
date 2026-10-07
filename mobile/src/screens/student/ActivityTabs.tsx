import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { activityService, recommendationService, type RecommendationItem } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Button, EmptyState, ErrorText, Muted, SkeletonCards } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { REGISTRATION_STATUS_LABEL, lbl } from '../../constants';
import { colors, registrationColor } from '../../theme';

/**
 * «Para ti» dentro de Actividades (V3 §34.2): las oportunidades sugeridas con
 * su motivo, «Guardar» y «No me interesa». Lo demás (recursos, áreas para
 * fortalecer, compañeros) queda en «Más sugerencias».
 */
export function ParaTi({ onMas }: { onMas: () => void }) {
  const { data, loading, error, reload } = useAsync(() => recommendationService.mine(), []);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const toast = useToast();
  const items = (data?.groups ?? [])
    .flatMap((g) => g.items)
    .filter((i: RecommendationItem) => (i.type === 'activity' || i.type === 'opportunity') && i.status !== 'dismissed');

  const decidir = async (i: RecommendationItem, status: 'saved' | 'dismissed') => {
    setOcupado(i.id);
    try {
      await recommendationService.decide(i.id, status);
      toast.success(status === 'saved' ? 'Guardada.' : 'Listo: verás menos de esto.', status === 'dismissed' ? 'Tus intereses no cambian.' : undefined);
      reload();
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
          {i.reasons.slice(0, 2).map((r, k) => <Text key={k} style={styles.motivo}>• {r.label}</Text>)}
          <View style={styles.fila}>
            <Button small icon="bookmark" title={i.status === 'saved' ? 'Guardada' : 'Guardar'} disabled={i.status === 'saved'} loading={ocupado === i.id} onPress={() => decidir(i, 'saved')} />
            <Button small variant="secondary" icon="x" title="No me interesa" onPress={() => decidir(i, 'dismissed')} />
          </View>
        </View>
      ))}
      <View style={{ marginTop: 12 }}>
        <Button variant="secondary" icon="compass" title="Más sugerencias" onPress={onMas} />
      </View>
    </View>
  );
}

const GRUPOS: Record<'interesadas' | 'inscritas' | 'historial', { estados: string[]; vacio: string }> = {
  interesadas: { estados: ['interested'], vacio: 'No marcaste interés en ninguna actividad.' },
  inscritas: { estados: ['registered', 'accepted'], vacio: 'No tienes inscripciones pendientes.' },
  historial: { estados: ['confirmed', 'absent'], vacio: 'Todavía no hay participaciones confirmadas.' },
};

/** Interesadas, Inscritas e Historial (V3 §34.2), desde tus inscripciones. */
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
            {r.activity?.eventDate && (
              <Muted>{new Date(r.activity.eventDate).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })}</Muted>
            )}
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
