import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { activityService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  Screen,
  Card,
  Muted,
  Button,
  Chip,
  ErrorText,
  EmptyState,
  FadeIn,
  Badge,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
} from '../../components/ui';
import {
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_TYPE_LABEL,
  categoryLabel,
  lbl,
} from '../../constants';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    let list = data ?? [];
    if (type) list = list.filter((a: any) => a.type === type);
    if (q) {
      list = list.filter((a: any) =>
        [a.title, a.description ?? '', a.location ?? '', a.academicArea?.name ?? '']
          .some((f: string) => normalize(f).includes(q)),
      );
    }
    return list;
  }, [data, type, query]);

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader
        title="Actividades del programa"
        description="Oferta vigente para orientar a sus estudiantes. Las académicas las publica el director de carrera; las extracurriculares, la sociedad científica."
      />

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por título, lugar o área…"
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip
            key={f.value || 'all'}
            label={f.label}
            on={type === f.value}
            onPress={() => setType(f.value)}
          />
        ))}
      </View>

      {loading && <SkeletonCards count={3} />}
      {error && <ErrorText message={error} />}

      {!loading && (data ?? []).length > 0 && (
        <ResultCount
          shown={filtered.length}
          total={(data ?? []).length}
          noun="actividades"
        />
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={query || type ? '⌕' : '☷'}
          message={
            query || type
              ? 'Ninguna actividad coincide con los filtros aplicados.'
              : 'Todavía no hay actividades publicadas.'
          }
          action={
            query || type ? (
              <Button
                title="Quitar filtros"
                variant="secondary"
                small
                onPress={() => {
                  setQuery('');
                  setType('');
                }}
              />
            ) : undefined
          }
        />
      )}

      {filtered.map((a: any, index: number) => (
        <FadeIn key={a.id} index={index}>
        <Card>
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
        </FadeIn>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  title: { fontSize: 15.5, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  desc: { fontSize: 13.5, color: colors.gray700, marginBottom: 6 },
});
