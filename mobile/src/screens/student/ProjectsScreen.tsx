import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { apiError } from '../../api/client';
import { catalogService, evidenceService, projectService } from '../../services';
import { Screen, Card, H1, Muted, Field, Button, Loading, ErrorText, EmptyState, Success, Badge } from '../../components/ui';
import { colors } from '../../theme';

export default function ProjectsScreen() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', technologies: '', repositoryUrl: '' });
  const [evidence, setEvidence] = useState<Record<string, string>>({});

  const load = () => projectService.mine().then(setProjects);

  useEffect(() => {
    Promise.all([projectService.mine(), catalogService.areas()])
      .then(([p, a]) => { setProjects(p); setAreas(a); })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    setError(null); setMsg(null);
    try {
      await projectService.create({
        title: form.title,
        description: form.description || undefined,
        technologies: form.technologies ? form.technologies.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        repositoryUrl: form.repositoryUrl || undefined,
        status: 'active',
      });
      setForm({ title: '', description: '', technologies: '', repositoryUrl: '' });
      setMsg('Proyecto creado.');
      await load();
    } catch (e) { setError(apiError(e)); }
  };

  const addEvidence = async (projectId: string) => {
    const url = evidence[projectId];
    if (!url) return;
    try {
      await evidenceService.add(projectId, { evidenceType: 'link', externalUrl: url });
      setEvidence({ ...evidence, [projectId]: '' });
      await load();
    } catch (e) { setError(apiError(e)); }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <H1>Proyectos</H1>
      {error && <ErrorText message={error} />}
      {msg && <Success message={msg} />}

      <Card title="Registrar proyecto">
        <Field label="Título" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} />
        <Field label="Descripción" value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} multiline />
        <Field label="Tecnologías (coma)" value={form.technologies} onChangeText={(t) => setForm({ ...form, technologies: t })} placeholder="React, Node.js" />
        <Field label="Repositorio (URL)" value={form.repositoryUrl} onChangeText={(t) => setForm({ ...form, repositoryUrl: t })} placeholder="https://..." />
        <Button title="Crear proyecto" onPress={create} />
      </Card>

      <H1>Mis proyectos</H1>
      {projects.length === 0 && <EmptyState message="Aún no tienes proyectos." />}
      {projects.map((p) => (
        <Card key={p.id} title={p.title}>
          <Badge color={colors.bordo}>{p.status}</Badge>
          {p.description ? <Text style={{ marginTop: 6 }}>{p.description}</Text> : null}
          <Muted>Área: {p.academicArea?.name ?? '—'} · Integrantes: {p.members?.length ?? 0}</Muted>
          {p.technologies?.length ? (
            <View style={styles.tags}>{p.technologies.map((t: string) => <Badge key={t}>{t}</Badge>)}</View>
          ) : null}
          <Text style={{ fontWeight: '600', marginTop: 8 }}>Evidencias ({p.evidences?.length ?? 0})</Text>
          {(p.evidences ?? []).map((ev: any) => (
            <Muted key={ev.id}>• {ev.description || ev.evidenceType}: {ev.externalUrl ?? ev.fileUrl}</Muted>
          ))}
          <Field label="Adjuntar evidencia (enlace)" value={evidence[p.id] ?? ''} onChangeText={(t) => setEvidence({ ...evidence, [p.id]: t })} placeholder="https://..." />
          <Button title="Agregar enlace" variant="secondary" onPress={() => addEvidence(p.id)} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
