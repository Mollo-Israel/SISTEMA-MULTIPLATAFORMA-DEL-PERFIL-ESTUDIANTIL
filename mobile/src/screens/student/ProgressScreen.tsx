import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { gamificationService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Card, EmptyState, Muted, SkeletonCards } from '../../components/ui';
import { colors } from '../../theme';

const FECHA = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

/**
 * Progreso del estudiante (§66).
 *
 * Solo lectura: los puntos no se piden ni se canjean, se obtienen haciendo
 * cosas. Y no hay tabla de posiciones —§66 no la exige y publicarla convertiria
 * un reconocimiento en una comparacion entre companeros—, asi que esta pantalla
 * no tiene con que compararse.
 */
export default function ProgressScreen() {
  const { data, loading } = useAsync(() => gamificationService.myProgress(), []);

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.contenido}>
        <SkeletonCards count={3} />
      </ScrollView>
    );
  }

  const p = data;
  if (!p) {
    return (
      <ScrollView contentContainerStyle={styles.contenido}>
        <Card>
          <EmptyState message="Todavia no hay nada que mostrar." />
        </Card>
      </ScrollView>
    );
  }

  const obtenidas = p.badges.filter((b) => b.earned);

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <Card>
        <Text style={styles.total}>{p.totalPoints}</Text>
        <Muted>
          {p.eventsCount} {p.eventsCount === 1 ? 'reconocimiento' : 'reconocimientos'} ·{' '}
          {obtenidas.length} {obtenidas.length === 1 ? 'insignia' : 'insignias'}
        </Muted>
        {/* §66 es explicito en que la gamificacion es independiente de la
            afinidad. Si el sistema lo cumple pero no lo dice, el estudiante
            seguira creyendo que acumular puntos le mejora el perfil. */}
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>{p.note}</Text>
        </View>
      </Card>

      <Card title="Insignias">
        {p.badges.map((b) => (
          <View key={b.code} style={[styles.insignia, b.earned && styles.obtenida]}>
            <View style={styles.fila}>
              <Text style={styles.nombre}>{b.name}</Text>
              {b.earned ? (
                <Badge color={colors.green}>{FECHA(b.earnedAt)}</Badge>
              ) : (
                <Muted>{b.progress} de {b.threshold}</Muted>
              )}
            </View>
            <Muted>{b.description}</Muted>
          </View>
        ))}
      </Card>

      <Card title="Que se reconoce">
        <Muted>
          Solo cosas hechas. Declarar un interes, adjuntar un archivo o registrar un proyecto
          vacio no suman: son declaraciones, no trayectoria.
        </Muted>
        {p.rules.map((r) => (
          <View key={r.trigger} style={styles.fila}>
            <Text style={styles.regla}>{r.label}</Text>
            <Badge color={colors.gray500}>+{r.points}</Badge>
          </View>
        ))}
      </Card>

      <Card title="Historial">
        {p.events.length === 0 && (
          <EmptyState message="Todavia no hay nada reconocido. Participa en una actividad o consigue respaldo para un proyecto." />
        )}
        {p.events.map((e) => (
          <View key={e.id} style={styles.evento}>
            <Text style={styles.nombre}>{e.reason}</Text>
            <View style={styles.fila}>
              <Muted>{e.triggerLabel} · {FECHA(e.occurredAt)}</Muted>
              <Badge color={colors.gray500}>+{e.points}</Badge>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: 16, gap: 12, paddingBottom: 32 },
  total: { fontSize: 40, fontWeight: '700', color: colors.bordo, lineHeight: 44 },
  aviso: {
    backgroundColor: colors.gray100,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  avisoTexto: { fontSize: 12, color: colors.gray700, lineHeight: 18 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  insignia: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
    opacity: 0.6,
  },
  obtenida: { opacity: 1 },
  nombre: { fontWeight: '700', color: colors.gray700, flexShrink: 1 },
  regla: { color: colors.gray700, flexShrink: 1 },
  evento: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
});
