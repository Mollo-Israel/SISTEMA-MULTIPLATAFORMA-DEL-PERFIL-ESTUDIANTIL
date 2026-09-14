import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { affinityService, profileService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  Screen,
  Card,
  Muted,
  Button,
  ErrorText,
  EmptyState,
  FadeIn,
  Badge,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import { affinityColor, colors } from '../../theme';

export default function StudentSummary() {
  const { data, loading, error, reload } = useAsync(() => profileService.listStudents(), []);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<any>(null);
  const [affinity, setAffinity] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const scope = data?.scope;
  const students = (data?.students ?? []).filter((s: any) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      (s.studentName ?? '').toLowerCase().includes(term) ||
      (s.email ?? '').toLowerCase().includes(term)
    );
  });

  const open = async (profileId: string) => {
    setSelected(profileId);
    setBusy(true);
    setView(null);
    setAffinity([]);
    try {
      const [v, a] = await Promise.all([
        profileService.allowedView(profileId),
        affinityService.student(profileId).catch(() => []),
      ]);
      setView(v);
      setAffinity(a as any[]);
    } catch (e) {
      toast.error(apiError(e, 'No se pudo cargar el perfil.'));
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  const noScope = scope?.restricted && scope.semesters.length === 0;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader
        title="Perfil del estudiante"
        description="Vista permitida: sin notas, datos sensibles ni constancias internas."
      />

      {loading && <SkeletonCards count={2} />}
      {error && <ErrorText message={error} />}

      {scope?.restricted && !noScope && (
        <View style={styles.scope}>
          <Text style={styles.scopeText}>
            Semestres habilitados: {scope.semesters.map((s) => `${s}º`).join(', ')}
          </Text>
        </View>
      )}

      {noScope && (
        <Card title="Sin semestres habilitados">
          <Muted>
            El administrador todavía no le asignó semestres. Hasta entonces no puede consultar
            perfiles de estudiantes.
          </Muted>
        </Card>
      )}

      {!noScope && data && (
        <Card title={`Estudiantes (${data.students?.length ?? 0})`}>
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre o correo…"
          />
          <ResultCount
            shown={students.length}
            total={data.students?.length ?? 0}
            noun="estudiantes"
          />
          {students.length === 0 ? (
            <EmptyState
              icon={search ? '⌕' : '☰'}
              message={
                search
                  ? `Ningún estudiante coincide con “${search}”.`
                  : 'No hay estudiantes en los semestres habilitados.'
              }
              action={
                search ? (
                  <Button
                    title="Limpiar búsqueda"
                    variant="secondary"
                    small
                    onPress={() => setSearch('')}
                  />
                ) : undefined
              }
            />
          ) : (
            students.map((s: any, index: number) => (
              <FadeIn key={s.profileId} index={index}>
                <Pressable
                  onPress={() => open(s.profileId)}
                  style={[styles.row, selected === s.profileId && styles.rowOn]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{s.studentName}</Text>
                    <Text style={styles.meta}>
                      {s.semester ? `${s.semester}º semestre` : 'Sin semestre'} · perfil{' '}
                      {s.completionPercentage}%
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </FadeIn>
            ))
          )}
        </Card>
      )}

      {busy && <SkeletonCards count={1} />}

      {view && !busy && (
        <FadeIn>
        <Card title={view.studentName ?? 'Estudiante'}>
          <Text style={styles.line}>
            Semestre: {view.semester ? `${view.semester}º` : '—'} · Perfil {view.status}
          </Text>
          {view.bio ? <Text style={styles.bio}>{view.bio}</Text> : null}

          <Text style={styles.section}>Áreas de interés</Text>
          {view.interests?.length ? (
            <View style={styles.chips}>
              {view.interests.map((i: any) => (
                <Badge key={i.academicAreaId} color={colors.bordo}>
                  {i.area} · {i.priority}
                </Badge>
              ))}
            </View>
          ) : (
            <Muted>Sin áreas de interés declaradas.</Muted>
          )}

          <Text style={styles.section}>Habilidades</Text>
          {view.skills?.length ? (
            <View style={styles.chips}>
              {view.skills.map((s: any) => (
                <Badge key={s.skillId}>
                  {s.skill} · nivel {s.level}
                </Badge>
              ))}
            </View>
          ) : (
            <Muted>Sin habilidades declaradas.</Muted>
          )}

          <Text style={styles.section}>Trayectoria</Text>
          <Text style={styles.line}>Proyectos: {view.projects?.length ?? 0}</Text>
          <Text style={styles.line}>Actividades: {view.activities?.length ?? 0}</Text>
          <Text style={styles.line}>
            Certificados externos: {view.externalCertificates?.length ?? 0}
          </Text>

          <Text style={styles.section}>Áreas de afinidad</Text>
          {affinity.length === 0 ? (
            <Muted>Todavía no hay afinidades calculadas.</Muted>
          ) : (
            <View style={styles.chips}>
              {affinity.map((a) => (
                <Badge key={a.id} color={affinityColor(a.level)}>
                  {a.academicArea?.name}: {a.score}
                </Badge>
              ))}
            </View>
          )}
        </Card>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scope: {
    backgroundColor: colors.bordoBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  scopeText: { color: colors.bordo, fontSize: 12.5, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  rowOn: { backgroundColor: colors.bordoBg },
  name: { fontSize: 14.5, fontWeight: '600', color: colors.gray900 },
  meta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.gray500, paddingHorizontal: 4 },
  line: { fontSize: 13.5, color: colors.gray700, paddingVertical: 1 },
  bio: { fontSize: 13.5, color: colors.gray700, marginTop: 6, fontStyle: 'italic' },
  section: { fontSize: 13, fontWeight: '700', color: colors.gray900, marginTop: 12, marginBottom: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
