import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activityService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  Screen,
  Card,
  H1,
  Muted,
  Loading,
  ErrorText,
  EmptyState,
  Badge,
} from '../../components/ui';
import {
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_TYPE_LABEL,
  categoryLabel,
  lbl,
} from '../../constants';
import { colors } from '../../theme';

const FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'academica', label: 'Académicas' },
  { value: 'extracurricular', label: 'Extracurriculares' },
];

/**
 * Consulta de la oferta de actividades para el docente.
 * La publicacion corresponde al director de carrera y a la sociedad cientifica.
 */
export default function TeacherActivities() {
  const { data, loading, error, reload } = useAsync(() => activityService.list(), []);
  const [type, setType] = useState('');

  const filtered = useMemo(
    () => (type ? (data ?? []).filter((a: any) => a.type === type) : (data ?? [])),
    [data, type],
  );

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Actividades del programa</H1>
      <Muted>
        Oferta vigente para orientar a sus estudiantes. Las académicas las publica el director de
        carrera; las extracurriculares, la sociedad científica.
      </Muted>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value || 'all'}
            onPress={() => setType(f.value)}
            style={[styles.filter, type === f.value && styles.filterOn]}
          >
            <Text style={type === f.value ? styles.filterOnText : styles.filterText}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading && <Loading />}
      {error && <ErrorText message={error} />}
      {!loading && filtered.length === 0 && (
        <EmptyState message="Todavía no hay actividades publicadas." />
      )}

      {filtered.map((a: any) => (
        <Card key={a.id}>
          <View style={styles.badges}>
            <Badge color={a.type === 'academica' ? colors.bordo : colors.amber}>
              {lbl(ACTIVITY_TYPE_LABEL, a.type)}
            </Badge>
            <Badge>{categoryLabel(a.category)}</Badge>
            <Badge color={colors.green}>{lbl(ACTIVITY_STATUS_LABEL, a.status)}</Badge>
          </View>
          <Text style={styles.title}>{a.title}</Text>
          {a.description ? <Text style={styles.desc}>{a.description}</Text> : null}
          <Muted>
            {a.academicArea ? `${a.academicArea.name} · ` : ''}
            {a.confirmedCount ?? 0} confirmado{(a.confirmedCount ?? 0) === 1 ? '' : 's'}
            {a.capacity ? ` de ${a.capacity}` : ''}
            {a.eventDate
              ? ` · ${new Date(a.eventDate).toLocaleDateString('es-BO', {
                  day: '2-digit',
                  month: 'short',
                })}`
              : ''}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 4 },
  filter: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  filterOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  filterText: { color: colors.gray700, fontSize: 12.5 },
  filterOnText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  title: { fontSize: 15.5, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  desc: { fontSize: 13.5, color: colors.gray700, marginBottom: 6 },
});
