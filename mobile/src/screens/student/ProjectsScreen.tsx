import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import {
  catalogService,
  projectInvitationService,
  projectService,
} from '../../services';
import {
  Screen,
  Card,
  Muted,
  Field,
  Button,
  Chip,
  EmptyState,
  FadeIn,
  Badge,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  active: 'En desarrollo',
  archived: 'Finalizado',
};

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Privado', hint: 'Solo tú y tus integrantes.' },
  { value: 'profile', label: 'En mi perfil', hint: 'Aparece en tu perfil dinámico.' },
  { value: 'teachers', label: 'Visible a docentes', hint: 'Tus docentes pueden revisarlo y comentarlo.' },
];

const emptyForm = {
  title: '',
  description: '',
  technologies: '',
  repositoryUrl: '',
  demoUrl: '',
  areaId: '',
  status: 'active',
  visibility: 'profile',
};

/**
 * Portafolio de proyectos del estudiante (RF13 y RF15).
 *
 * Tres secciones: los proyectos de los que es responsable, aquellos en los que
 * participa por haber aceptado una invitación, y las invitaciones pendientes.
 */
export default function ProjectsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<'mine' | 'shared' | 'invites'>('mine');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        projectService.mine().then(setProjects),
        projectInvitationService.mine(true).then(setInvitations),
      ]),
    [],
  );

  useEffect(() => {
    Promise.all([load(), catalogService.areas().then(setAreas)])
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Al volver del detalle, el portafolio se refresca.
  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => {
      load().catch(() => {});
    });
    return unsubscribe;
  }, [navigation, load]);

  const notify = (t: string, detail?: string) => toast.success(t, detail);

  const create = async () => {
    setSaving(true);
    try {
      await projectService.create({
        title: form.title,
        description: form.description || undefined,
        technologies: form.technologies
          ? form.technologies.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
        repositoryUrl: form.repositoryUrl || undefined,
        demoUrl: form.demoUrl || undefined,
        areaId: form.areaId || undefined,
        status: form.status,
        visibility: form.visibility,
      });
      setForm(emptyForm);
      setShowForm(false);
      notify('Proyecto registrado en tu portafolio.', 'Ya suma a tu perfil y a tu afinidad.');
      await load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const respond = async (invitation: any, decision: 'accept' | 'reject') => {
    const title = invitation.project?.title ?? 'el proyecto';
    const ok = await confirm({
      title: decision === 'accept' ? 'Aceptar la invitación' : 'Rechazar la invitación',
      message:
        decision === 'accept'
          ? `Pasarás a integrar “${title}” y aparecerá en tu portafolio.`
          : `Rechazar “${title}” no deja ningún registro en tu portafolio.`,
      confirmLabel: decision === 'accept' ? 'Aceptar' : 'Rechazar',
      tone: decision === 'accept' ? 'default' : 'danger',
    });
    if (!ok) return;
    setRespondingId(invitation.id);
    try {
      await projectInvitationService.respond(invitation.id, decision);
      notify(
        decision === 'accept' ? 'Invitación aceptada.' : 'Invitación rechazada.',
        decision === 'accept' ? `“${title}” ya forma parte de tu portafolio.` : undefined,
      );
      await load();
      if (decision === 'accept') setTab('shared');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRespondingId(null);
    }
  };

  const match = (p: any) => {
    const q = normalize(query.trim());
    if (!q) return true;
    return [p.title ?? '', p.description ?? '', p.academicArea?.name ?? '',
      (p.technologies ?? []).join(' ')]
      .some((f: string) => normalize(f).includes(q));
  };

  const allOwned = projects.filter((p) => p.isOwner);
  const allShared = projects.filter((p) => !p.isOwner);
  const owned = allOwned.filter(match);
  const shared = allShared.filter(match);

  const TABS = [
    { key: 'mine' as const, label: `Mis proyectos (${allOwned.length})` },
    { key: 'shared' as const, label: `Participo (${allShared.length})` },
    { key: 'invites' as const, label: `Invitaciones (${invitations.length})` },
  ];

  if (loading) {
    return (
      <Screen>
        <SkeletonCards count={3} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <PageHeader
        title="Portafolio"
        description="Registra tus proyectos académicos, invita integrantes y comparte tu trabajo con tus docentes."
      />

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabOn]}
          >
            <Text style={tab === t.key ? styles.tabOnText : styles.tabText}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab !== 'invites' && (allOwned.length > 0 || allShared.length > 0) && (
        <>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por título, área o tecnología…"
          />
          <ResultCount
            shown={tab === 'mine' ? owned.length : shared.length}
            total={tab === 'mine' ? allOwned.length : allShared.length}
            noun="proyectos"
          />
        </>
      )}

      {/* ---------------- Mis proyectos ---------------- */}
      {tab === 'mine' && (
        <>
          {!showForm ? (
            <Button title="Nuevo proyecto" onPress={() => setShowForm(true)} />
          ) : (
            <Card title="Nuevo proyecto">
              <Field
                label="Título"
                value={form.title}
                onChangeText={(t) => setForm({ ...form, title: t })}
                placeholder="Sistema de monitoreo IoT para laboratorios"
              />
              <Field
                label="Descripción"
                value={form.description}
                onChangeText={(t) => setForm({ ...form, description: t })}
                placeholder="Qué resuelve el proyecto y cómo."
                multiline
              />
              <Field
                label="Tecnologías (separadas por coma)"
                value={form.technologies}
                onChangeText={(t) => setForm({ ...form, technologies: t })}
                placeholder="Python, Docker, PostgreSQL"
              />

              <Text style={styles.label}>Área académica</Text>
              <View style={styles.chips}>
                <Chip
                  label="Sin área"
                  on={form.areaId === ''}
                  onPress={() => setForm({ ...form, areaId: '' })}
                />
                {areas.map((a: any) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    on={form.areaId === a.id}
                    onPress={() => setForm({ ...form, areaId: a.id })}
                  />
                ))}
              </View>

              <Text style={styles.label}>Estado</Text>
              <View style={styles.chips}>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    on={form.status === value}
                    onPress={() => setForm({ ...form, status: value })}
                  />
                ))}
              </View>

              <Text style={styles.label}>Visibilidad</Text>
              <View style={styles.chips}>
                {VISIBILITY_OPTIONS.map((v) => (
                  <Chip
                    key={v.value}
                    label={v.label}
                    on={form.visibility === v.value}
                    onPress={() => setForm({ ...form, visibility: v.value })}
                  />
                ))}
              </View>
              <Muted>{VISIBILITY_OPTIONS.find((v) => v.value === form.visibility)?.hint}</Muted>

              <Field
                label="Repositorio (opcional)"
                value={form.repositoryUrl}
                onChangeText={(t) => setForm({ ...form, repositoryUrl: t })}
                placeholder="https://github.com/usuario/proyecto"
              />
              <Field
                label="Demostración (opcional)"
                value={form.demoUrl}
                onChangeText={(t) => setForm({ ...form, demoUrl: t })}
                placeholder="https://demo.example.com"
              />

              <Button
                title="Crear proyecto"
                onPress={create}
                loading={saving}
                disabled={form.title.trim().length < 3}
              />
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                }}
              />
            </Card>
          )}

          {owned.length === 0 ? (
            <EmptyState
              icon={query ? '⌕' : '☰'}
              message={
                query
                  ? `Ningún proyecto tuyo coincide con “${query}”.`
                  : 'Todavía no registras proyectos. Crea el primero con el botón de arriba.'
              }
              action={
                query ? (
                  <Button
                    title="Limpiar búsqueda"
                    variant="secondary"
                    small
                    onPress={() => setQuery('')}
                  />
                ) : undefined
              }
            />
          ) : (
            owned.map((p, index) => (
              <FadeIn key={p.id} index={index}>
                <ProjectCard
                  project={p}
                  onOpen={() => navigation.navigate('DetalleProyecto', { projectId: p.id })}
                />
              </FadeIn>
            ))
          )}
        </>
      )}

      {/* ---------------- Proyectos donde participo ---------------- */}
      {tab === 'shared' && (
        <>
          <Muted>
            Proyectos de otros estudiantes en los que participas por haber aceptado su invitación.
          </Muted>
          {shared.length === 0 ? (
            <EmptyState
              icon={query ? '⌕' : '☰'}
              message={
                query
                  ? `Ningún proyecto compartido coincide con “${query}”.`
                  : 'Todavía no participas en proyectos de otros estudiantes.'
              }
              action={
                query ? (
                  <Button
                    title="Limpiar búsqueda"
                    variant="secondary"
                    small
                    onPress={() => setQuery('')}
                  />
                ) : undefined
              }
            />
          ) : (
            shared.map((p, index) => (
              <FadeIn key={p.id} index={index}>
                <ProjectCard
                  project={p}
                  onOpen={() => navigation.navigate('DetalleProyecto', { projectId: p.id })}
                />
              </FadeIn>
            ))
          )}
        </>
      )}

      {/* ---------------- Invitaciones recibidas ---------------- */}
      {tab === 'invites' && (
        <>
          <Muted>
            Solo pasarás a integrar el proyecto cuando aceptes. Rechazar no deja ningún registro en
            tu portafolio.
          </Muted>
          {invitations.length === 0 ? (
            <EmptyState icon="✉" message="No tienes invitaciones pendientes." />
          ) : (
            invitations.map((inv, index) => (
              <FadeIn key={inv.id} index={index}>
              <Card>
                <Text style={styles.title}>{inv.project?.title ?? 'Proyecto'}</Text>
                <Muted>
                  Te invita {inv.invitedBy ?? inv.project?.owner ?? 'otro estudiante'}
                  {inv.project?.area ? ` · ${inv.project.area}` : ''}
                </Muted>
                {inv.project?.description ? (
                  <Text style={styles.desc}>{inv.project.description}</Text>
                ) : null}
                <View style={{ marginTop: 8, marginBottom: 4 }}>
                  <Badge color={colors.bordo}>Rol propuesto: {inv.proposedRole}</Badge>
                </View>
                {inv.project?.technologies?.length ? (
                  <View style={styles.tags}>
                    {inv.project.technologies.map((t: string) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Aceptar"
                      onPress={() => respond(inv, 'accept')}
                      loading={respondingId === inv.id}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Rechazar"
                      variant="secondary"
                      onPress={() => respond(inv, 'reject')}
                      loading={respondingId === inv.id}
                    />
                  </View>
                </View>
              </Card>
              </FadeIn>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function ProjectCard({ project, onOpen }: { project: any; onOpen: () => void }) {
  const visibility = VISIBILITY_OPTIONS.find((v) => v.value === project.visibility);
  return (
    <Card>
      <Pressable onPress={onOpen}>
        <Text style={styles.title}>{project.title}</Text>
        <View style={styles.tags}>
          <Badge color={colors.bordo}>{STATUS_LABEL[project.status] ?? project.status}</Badge>
          {visibility && (
            <Badge color={project.visibility === 'teachers' ? colors.green : colors.gray500}>
              {visibility.label}
            </Badge>
          )}
          {!project.isOwner && project.myRole ? <Badge>{project.myRole}</Badge> : null}
        </View>
        {project.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {project.description}
          </Text>
        ) : null}
        <Muted>
          {project.academicArea?.name ?? 'Sin área'} · {project.members?.length ?? 0} integrante
          {(project.members?.length ?? 0) === 1 ? '' : 's'} · {project.evidences?.length ?? 0}{' '}
          evidencia{(project.evidences?.length ?? 0) === 1 ? '' : 's'}
        </Muted>
        {project.technologies?.length ? (
          <View style={styles.tags}>
            {project.technologies.map((t: string) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </View>
        ) : null}
        <Text style={styles.open}>Abrir proyecto ›</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 8 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  tabOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  tabText: { color: colors.gray700, fontSize: 12, fontWeight: '600' },
  tabOnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  label: { fontSize: 13, color: colors.gray700, marginTop: 8, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  title: { fontSize: 15.5, fontWeight: '700', color: colors.gray900, marginBottom: 6 },
  desc: { fontSize: 13.5, color: colors.gray700, marginVertical: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  open: { color: colors.bordo, fontSize: 12.5, fontWeight: '700', marginTop: 10 },
});
