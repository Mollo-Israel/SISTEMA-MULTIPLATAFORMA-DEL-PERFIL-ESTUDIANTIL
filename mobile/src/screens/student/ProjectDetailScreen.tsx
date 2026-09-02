import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import {
  catalogService,
  evidenceService,
  profileService,
  projectFeedbackService,
  projectInvitationService,
  projectService,
  uploadService,
} from '../../services';
import {
  Screen,
  Card,
  H1,
  Muted,
  Field,
  Button,
  Loading,
  ErrorText,
  EmptyState,
  Success,
  Badge,
} from '../../components/ui';
import { colors } from '../../theme';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  active: 'En desarrollo',
  archived: 'Finalizado',
};

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Privado', hint: 'Solo tú y tus integrantes lo ven.' },
  { value: 'profile', label: 'En mi perfil', hint: 'Aparece en tu perfil dinámico.' },
  { value: 'teachers', label: 'Visible a docentes', hint: 'Tus docentes pueden revisarlo y comentarlo.' },
];

const INVITATION_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

const ROLE_SUGGESTIONS = [
  'Desarrollador Backend',
  'Desarrollador Frontend',
  'Diseñador UX',
  'Analista',
  'Tester',
  'Líder Técnico',
];

/**
 * Detalle de un proyecto del portafolio (RF13, RF14, RF15, RF16).
 *
 * La pantalla distingue al responsable del integrante: solo el responsable ve
 * la edición, la visibilidad y la gestión de invitaciones. El backend aplica la
 * misma regla; ocultar un botón no sería autorización.
 */
export default function ProjectDetailScreen({ route, navigation }: any) {
  const { projectId } = route.params ?? {};

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [invitee, setInvitee] = useState('');
  const [role, setRole] = useState('');
  const [inviting, setInviting] = useState(false);

  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [addingEvidence, setAddingEvidence] = useState(false);

  const isOwner = !!project && !!me && project.createdByProfile?.userId === me.userId;

  const load = useCallback(async () => {
    const p = await projectService.get(projectId);
    setProject(p);
    setForm({
      title: p.title,
      description: p.description ?? '',
      technologies: (p.technologies ?? []).join(', '),
      repositoryUrl: p.repositoryUrl ?? '',
      demoUrl: p.demoUrl ?? '',
      areaId: p.academicAreaId ?? '',
      status: p.status,
      visibility: p.visibility,
    });
    const [m, f] = await Promise.all([
      projectService.members(projectId).catch(() => []),
      projectFeedbackService.list(projectId).catch(() => []),
    ]);
    setMembers(m);
    setFeedback(f);
    return p;
  }, [projectId]);

  const loadInvitations = useCallback(async () => {
    try {
      setInvitations(await projectInvitationService.ofProject(projectId));
    } catch {
      // Solo el responsable puede listarlas; para un integrante no es un error.
      setInvitations([]);
    }
  }, [projectId]);

  useEffect(() => {
    Promise.all([
      load(),
      catalogService.areas().then(setAreas).catch(() => {}),
      profileService
        .getMine()
        .then((p: any) => setMe({ userId: p.userId, profileId: p.id }))
        .catch(() => {}),
    ])
      .then(() => loadInvitations())
      .catch((e) => setError(apiError(e, 'No se pudo cargar el proyecto.')))
      .finally(() => setLoading(false));
  }, [load, loadInvitations]);

  const notify = (t: string) => {
    setMsg(t);
    setError(null);
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await projectService.update(projectId, {
        title: form.title,
        description: form.description || undefined,
        technologies: form.technologies
          ? form.technologies.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [],
        repositoryUrl: form.repositoryUrl || undefined,
        demoUrl: form.demoUrl || undefined,
        areaId: form.areaId || undefined,
        status: form.status,
        visibility: form.visibility,
      });
      notify('Proyecto actualizado.');
      setEditing(false);
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const openInvite = async () => {
    setShowInvite(true);
    setError(null);
    try {
      const dir = await profileService.listStudents();
      // Se excluyen el responsable y quienes ya son integrantes.
      const memberIds = new Set(members.map((m) => m.userId));
      setCandidates(
        (dir.students ?? []).filter(
          (s: any) => s.profileId !== project?.createdByProfileId && !memberIds.has(s.userId),
        ),
      );
    } catch {
      setCandidates([]);
    }
  };

  const sendInvite = async () => {
    if (!invitee || role.trim().length < 3) return;
    setError(null);
    setInviting(true);
    try {
      await projectInvitationService.invite(projectId, {
        invitedProfileId: invitee,
        proposedRole: role.trim(),
      });
      notify('Invitación enviada. El estudiante debe aceptarla para integrarse.');
      setInvitee('');
      setRole('');
      setShowInvite(false);
      await loadInvitations();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setInviting(false);
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    setError(null);
    try {
      await projectInvitationService.cancel(projectId, invitationId);
      notify('Invitación cancelada.');
      await loadInvitations();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const removeMember = (memberId: string, name: string) => {
    Alert.alert('Retirar integrante', `¿Retirar a ${name} del proyecto?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Retirar',
        style: 'destructive',
        onPress: async () => {
          try {
            await projectService.removeMember(projectId, memberId);
            notify('Integrante retirado.');
            setMembers(await projectService.members(projectId));
          } catch (e) {
            setError(apiError(e));
          }
        },
      },
    ]);
  };

  const addLinkEvidence = async () => {
    if (!evidenceUrl) return;
    setError(null);
    setAddingEvidence(true);
    try {
      await evidenceService.create({
        evidenceType: 'link',
        description: evidenceDesc || undefined,
        externalUrl: evidenceUrl,
        projectId,
      });
      setEvidenceUrl('');
      setEvidenceDesc('');
      notify('Evidencia adjuntada.');
      await load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setAddingEvidence(false);
    }
  };

  if (loading) return <Loading />;
  if (!project) {
    return (
      <Screen>
        <ErrorText message={error ?? 'No se pudo cargar el proyecto.'} />
        <Button title="Volver" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const visibility = VISIBILITY_OPTIONS.find((v) => v.value === project.visibility);
  const pendingInvites = invitations.filter((i) => i.status === 'pending');
  const answeredInvites = invitations.filter((i) => i.status !== 'pending');

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <H1>{project.title}</H1>
      <View style={styles.tags}>
        <Badge color={colors.bordo}>{STATUS_LABEL[project.status] ?? project.status}</Badge>
        {visibility && (
          <Badge color={project.visibility === 'teachers' ? colors.green : colors.gray500}>
            {visibility.label}
          </Badge>
        )}
        <Badge color={isOwner ? colors.bordo : colors.gray500}>
          {isOwner ? 'Responsable' : 'Integrante'}
        </Badge>
      </View>

      {error && <ErrorText message={error} />}
      {msg && <Success message={msg} />}

      {/* ---------------- Datos del proyecto ---------------- */}
      {!editing ? (
        <Card title="Información">
          {project.description ? (
            <Text style={styles.desc}>{project.description}</Text>
          ) : (
            <Muted>Sin descripción.</Muted>
          )}
          <Muted>Área: {project.academicArea?.name ?? 'Sin área'}</Muted>
          {project.technologies?.length ? (
            <View style={styles.tags}>
              {project.technologies.map((t: string) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </View>
          ) : (
            <Muted>Sin tecnologías declaradas.</Muted>
          )}
          {project.repositoryUrl ? (
            <Button
              title="Abrir repositorio"
              variant="secondary"
              onPress={() => Linking.openURL(project.repositoryUrl)}
            />
          ) : null}
          {project.demoUrl ? (
            <Button
              title="Abrir demostración"
              variant="secondary"
              onPress={() => Linking.openURL(project.demoUrl)}
            />
          ) : null}
          {isOwner && <Button title="Editar proyecto" onPress={() => setEditing(true)} />}
        </Card>
      ) : (
        <Card title="Editar proyecto">
          <Field
            label="Título"
            value={form.title}
            onChangeText={(t: string) => setForm({ ...form, title: t })}
          />
          <Field
            label="Descripción"
            value={form.description}
            onChangeText={(t: string) => setForm({ ...form, description: t })}
            multiline
          />
          <Field
            label="Tecnologías (separadas por coma)"
            value={form.technologies}
            onChangeText={(t: string) => setForm({ ...form, technologies: t })}
          />

          <Text style={styles.label}>Área académica</Text>
          <View style={styles.chips}>
            <Pressable
              onPress={() => setForm({ ...form, areaId: '' })}
              style={[styles.chip, form.areaId === '' && styles.chipOn]}
            >
              <Text style={form.areaId === '' ? styles.chipOnText : styles.chipText}>Sin área</Text>
            </Pressable>
            {areas.map((a: any) => (
              <Pressable
                key={a.id}
                onPress={() => setForm({ ...form, areaId: a.id })}
                style={[styles.chip, form.areaId === a.id && styles.chipOn]}
              >
                <Text style={form.areaId === a.id ? styles.chipOnText : styles.chipText}>
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Estado</Text>
          <View style={styles.chips}>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setForm({ ...form, status: value })}
                style={[styles.chip, form.status === value && styles.chipOn]}
              >
                <Text style={form.status === value ? styles.chipOnText : styles.chipText}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Visibilidad</Text>
          <View style={styles.chips}>
            {VISIBILITY_OPTIONS.map((v) => (
              <Pressable
                key={v.value}
                onPress={() => setForm({ ...form, visibility: v.value })}
                style={[styles.chip, form.visibility === v.value && styles.chipOn]}
              >
                <Text style={form.visibility === v.value ? styles.chipOnText : styles.chipText}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Muted>{VISIBILITY_OPTIONS.find((v) => v.value === form.visibility)?.hint}</Muted>

          <Field
            label="Repositorio"
            value={form.repositoryUrl}
            onChangeText={(t: string) => setForm({ ...form, repositoryUrl: t })}
          />
          <Field
            label="Demostración"
            value={form.demoUrl}
            onChangeText={(t: string) => setForm({ ...form, demoUrl: t })}
          />

          <Button title={saving ? 'Guardando…' : 'Guardar cambios'} onPress={save} disabled={saving} />
          <Button
            title="Cancelar"
            variant="secondary"
            onPress={() => {
              setEditing(false);
              load();
            }}
          />
        </Card>
      )}

      {/* ---------------- Integrantes ---------------- */}
      <Card title={`Integrantes (${members.length})`}>
        {members.length === 0 ? (
          <Muted>Proyecto individual: todavía no tiene integrantes adicionales.</Muted>
        ) : (
          members.map((m) => (
            <View key={m.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{m.name ?? 'Estudiante'}</Text>
                <Text style={styles.meta}>{m.role ?? 'Sin rol declarado'}</Text>
              </View>
              {isOwner && (
                <Pressable onPress={() => removeMember(m.id, m.name ?? 'este integrante')} hitSlop={8}>
                  <Text style={styles.danger}>Retirar</Text>
                </Pressable>
              )}
            </View>
          ))
        )}

        {isOwner && !showInvite && (
          <Button title="Invitar integrante" variant="secondary" onPress={openInvite} />
        )}

        {isOwner && showInvite && (
          <View style={styles.inviteBox}>
            <Text style={styles.label}>Estudiante</Text>
            {candidates.length === 0 ? (
              <Muted>No hay estudiantes disponibles para invitar.</Muted>
            ) : (
              <View style={styles.chips}>
                {candidates.slice(0, 20).map((c: any) => (
                  <Pressable
                    key={c.profileId}
                    onPress={() => setInvitee(c.profileId)}
                    style={[styles.chip, invitee === c.profileId && styles.chipOn]}
                  >
                    <Text style={invitee === c.profileId ? styles.chipOnText : styles.chipText}>
                      {c.studentName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.label}>Rol propuesto</Text>
            <View style={styles.chips}>
              {ROLE_SUGGESTIONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.chip, role === r && styles.chipOn]}
                >
                  <Text style={role === r ? styles.chipOnText : styles.chipText}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <Field
              label="O escribe un rol"
              value={role}
              onChangeText={setRole}
              placeholder="Desarrollador Backend"
            />
            <Button
              title={inviting ? 'Enviando…' : 'Enviar invitación'}
              onPress={sendInvite}
              disabled={inviting || !invitee || role.trim().length < 3}
            />
            <Button
              title="Cancelar"
              variant="secondary"
              onPress={() => {
                setShowInvite(false);
                setInvitee('');
                setRole('');
              }}
            />
          </View>
        )}
      </Card>

      {/* ---------------- Invitaciones enviadas (solo responsable) ---------------- */}
      {isOwner && (
        <Card title={`Invitaciones enviadas (${invitations.length})`}>
          {invitations.length === 0 ? (
            <Muted>Todavía no enviaste invitaciones.</Muted>
          ) : (
            <>
              {pendingInvites.map((i) => (
                <View key={i.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{i.invitedName ?? 'Estudiante'}</Text>
                    <Text style={styles.meta}>{i.proposedRole}</Text>
                    <View style={{ marginTop: 4 }}>
                      <Badge color={colors.amber}>{INVITATION_LABEL[i.status]}</Badge>
                    </View>
                  </View>
                  <Pressable onPress={() => cancelInvitation(i.id)} hitSlop={8}>
                    <Text style={styles.danger}>Cancelar</Text>
                  </Pressable>
                </View>
              ))}
              {answeredInvites.map((i) => (
                <View key={i.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{i.invitedName ?? 'Estudiante'}</Text>
                    <Text style={styles.meta}>{i.proposedRole}</Text>
                    <View style={{ marginTop: 4 }}>
                      <Badge
                        color={
                          i.status === 'accepted'
                            ? colors.green
                            : i.status === 'rejected'
                              ? colors.red
                              : colors.gray500
                        }
                      >
                        {INVITATION_LABEL[i.status]}
                      </Badge>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </Card>
      )}

      {/* ---------------- Evidencias ---------------- */}
      <Card title={`Evidencias (${project.evidences?.length ?? 0})`}>
        {(project.evidences ?? []).length === 0 ? (
          <Muted>Todavía no adjuntas evidencias a este proyecto.</Muted>
        ) : (
          (project.evidences ?? []).map((ev: any) => (
            <View key={ev.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{ev.description || ev.fileName || 'Evidencia'}</Text>
                <Text style={styles.meta}>
                  {ev.evidenceType === 'file' ? 'Archivo adjunto' : 'Enlace'}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    ev.evidenceType === 'file' ? uploadService.fileUrl(ev.fileUrl) : ev.externalUrl,
                  )
                }
                hitSlop={8}
              >
                <Text style={styles.action}>Abrir</Text>
              </Pressable>
            </View>
          ))
        )}

        <Field
          label="Adjuntar enlace"
          value={evidenceUrl}
          onChangeText={setEvidenceUrl}
          placeholder="https://github.com/usuario/proyecto"
        />
        <Field
          label="Descripción (opcional)"
          value={evidenceDesc}
          onChangeText={setEvidenceDesc}
          placeholder="Repositorio del proyecto"
        />
        <Button
          title={addingEvidence ? 'Adjuntando…' : 'Adjuntar enlace'}
          variant="secondary"
          onPress={addLinkEvidence}
          disabled={addingEvidence || !evidenceUrl}
        />
        <Muted>
          Para adjuntar un archivo (PDF o imagen), usa la pantalla “Evidencias y certificados” de tu
          perfil y elige este proyecto.
        </Muted>
      </Card>

      {/* ---------------- Retroalimentación docente ---------------- */}
      <Card title={`Retroalimentación docente (${feedback.length})`}>
        <Muted>
          Orientación académica complementaria de tus docentes. No es una nota ni una evaluación
          oficial.
        </Muted>
        {feedback.length === 0 ? (
          <EmptyState
            message={
              project.visibility === 'teachers'
                ? 'Todavía no recibes retroalimentación en este proyecto.'
                : 'Marca el proyecto como visible para docentes si quieres recibir retroalimentación.'
            }
          />
        ) : (
          feedback.map((f: any) => (
            <View key={f.id} style={styles.feedbackBox}>
              <Text style={styles.desc}>{f.comment}</Text>
              <Text style={styles.meta}>
                {f.teacher ?? 'Docente'} ·{' '}
                {new Date(f.createdAt).toLocaleDateString('es-BO', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
                {f.editedAt ? ' · editada' : ''}
              </Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 6 },
  label: { fontSize: 13, color: colors.gray700, marginTop: 8, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  chipText: { color: colors.gray700, fontSize: 12.5 },
  chipOnText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  desc: { fontSize: 13.5, color: colors.gray700, marginBottom: 6, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  name: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  meta: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  action: { fontSize: 12.5, fontWeight: '600', color: colors.bordo },
  danger: { fontSize: 12.5, fontWeight: '600', color: colors.red },
  inviteBox: {
    marginTop: 12,
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 12,
  },
  feedbackBox: {
    marginTop: 10,
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 12,
  },
});
