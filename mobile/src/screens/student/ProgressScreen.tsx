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
 * Los puntos no se piden: se obtienen haciendo cosas, y se canjean por las
 * recompensas de los docentes (en la web). Muestra el saldo y los puntos de la
 * semana, el mes y el año. Y no hay tabla de posiciones —§66 no la exige y publicarla convertiria
 * un reconocimiento en una comparacion entre companeros—, asi que esta pantalla
 * no tiene con que compararse.
 */
export default function ProgressScreen() {
  const { data, loading } = useAsync(() => gamificationService.myProgress(), []);
  const wallet = useAsync(() => gamificationService.wallet(), []);

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

      {wallet.data && (
        <Card title="Tus puntos">
          <View style={styles.periodos}>
            {([
              [wallet.data.balance.available, 'para canjear'],
              [wallet.data.periods.week, 'esta semana'],
              [wallet.data.periods.month, 'este mes'],
              [wallet.data.periods.year, 'este año'],
            ] as [number, string][]).map(([n, label], i) => (
              <View key={label} style={[styles.periodo, i === 0 && styles.periodoMain]}>
                <Text style={[styles.periodoN, i === 0 && { color: colors.white }]}>{n}</Text>
                <Text style={[styles.periodoL, i === 0 && { color: colors.white }]}>{label}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

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
  periodos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodo: { flexBasis: '47%', flexGrow: 1, padding: 10, borderRadius: 12, backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200 },
  periodoMain: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  periodoN: { fontSize: 22, fontWeight: '800', color: colors.gray900 },
  periodoL: { fontSize: 12, color: colors.gray500 },
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
