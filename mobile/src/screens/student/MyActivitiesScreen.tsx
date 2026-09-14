import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { activityService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  Screen, Card, Muted, ErrorText, EmptyState, Badge, Button, FadeIn, PageHeader,
  ResultCount, SearchInput, SkeletonCards,
} from '../../components/ui';
import { REGISTRATION_STATUS_LABEL, categoryLabel, lbl } from '../../constants';
import { colors, registrationColor } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const EXPLANATION: Record<string, string> = {
  interested: 'Marcaste interés. Inscríbete para que el responsable pueda registrar tu asistencia.',
  registered: 'Tu inscripción está pendiente de que el responsable registre tu participación.',
  confirmed: 'Tu participación fue confirmada y ya cuenta en tu perfil y en tus áreas de afinidad.',
  absent: 'El responsable te registró como ausente en esta actividad.',
};

export default function MyActivitiesScreen() {
  const { data, loading, error, reload } = useAsync(() => activityService.myRegistrations(), []);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const all = data ?? [];
    const q = normalize(query.trim());
    if (!q) return all;
    return all.filter((r: any) =>
      [r.activity?.title ?? '', r.activity?.academicArea?.name ?? '', r.activity?.location ?? '']
        .some((f: string) => normalize(f).includes(q)),
    );
  }, [data, query]);

  const groups = [
    { key: 'confirmed', title: 'Participación confirmada' },
    { key: 'registered', title: 'Inscripciones pendientes' },
    { key: 'interested', title: 'Marcadas como interés' },
    { key: 'absent', title: 'Ausencias registradas' },
  ];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader
        title="Mis actividades"
        description="Estado de tu participación en cada actividad."
      />

      {loading && <SkeletonCards count={3} />}
      {error && <ErrorText message={error} />}

      {data && data.length > 0 && (
        <>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por título, área o lugar…"
          />
          <ResultCount shown={rows.length} total={data.length} noun="actividades" />
        </>
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon="☷"
          message="Todavía no te has inscrito ni has marcado interés en ninguna actividad."
        />
      )}

      {data && data.length > 0 && rows.length === 0 && (
        <EmptyState
          icon="⌕"
          message={`Ninguna actividad coincide con “${query}”.`}
          action={
            <Button
              title="Limpiar búsqueda"
              variant="secondary"
              small
              onPress={() => setQuery('')}
            />
          }
        />
      )}

      {data &&
        groups.map(({ key, title }) => {
          const group = rows.filter((r: any) => r.status === key);
          if (group.length === 0) return null;
          return (
            <View key={key}>
              <Text style={styles.group}>
                {title} ({group.length})
              </Text>
              {group.map((r: any, index: number) => (
                <FadeIn key={r.registrationId} index={index}>
                <Card>
                  <Text style={styles.title}>{r.activity?.title ?? 'Actividad'}</Text>
                  <Muted>
                    {categoryLabel(r.activity?.category ?? '')}
                    {r.activity?.academicArea ? ` · ${r.activity.academicArea.name}` : ''}
                    {r.activity?.eventDate
                      ? ` · ${new Date(r.activity.eventDate).toLocaleDateString('es-BO', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}`
                      : ''}
                  </Muted>
                  <View style={{ marginTop: 8, marginBottom: 6 }}>
                    <Badge color={registrationColor(r.status)}>
                      {lbl(REGISTRATION_STATUS_LABEL, r.status)}
                    </Badge>
                  </View>
                  <Text style={styles.hint}>{EXPLANATION[r.status]}</Text>
                </Card>
                </FadeIn>
              ))}
            </View>
          );
        })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray700,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 3 },
  hint: { fontSize: 12.5, color: colors.gray500, lineHeight: 17 },
});
