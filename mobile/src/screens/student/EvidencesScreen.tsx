import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { apiError } from '../../api/client';
import {
  activityService,
  catalogService,
  certificateService,
  constancyService,
  evidenceService,
  projectService,
  uploadService,
  type StoredFile,
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

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

const humanSize = (bytes?: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function EvidencesScreen() {
  const [loading, setLoading] = useState(true);
  const [evidences, setEvidences] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [constancies, setConstancies] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [tab, setTab] = useState<'evidencia' | 'certificado'>('evidencia');

  const load = useCallback(async () => {
    const [ev, ce, co] = await Promise.all([
      evidenceService.mine().catch(() => []),
      certificateService.mine().catch(() => []),
      constancyService.mine().catch(() => []),
    ]);
    setEvidences(ev);
    setCertificates(ce);
    setConstancies(co);
  }, []);

  useEffect(() => {
    Promise.all([
      load(),
      catalogService.areas().then(setAreas).catch(() => {}),
      projectService.mine().then(setProjects).catch(() => {}),
      activityService
        .myRegistrations()
        .then((rows: any[]) => setActivities(rows.map((r) => r.activity).filter(Boolean)))
        .catch(() => {}),
    ])
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [load]);

  const notify = (t: string) => {
    setMsg(t);
    setError(null);
  };

  const removeEvidence = async (id: string) => {
    setError(null);
    try {
      await evidenceService.remove(id);
      notify('Evidencia eliminada.');
      await load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const removeCertificate = async (id: string) => {
    setError(null);
    try {
      await certificateService.remove(id);
      notify('Certificado eliminado.');
      await load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  if (loading) return <Loading />;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <H1>Evidencias y certificados</H1>
      <Muted>
        Respalda tu trayectoria con enlaces o archivos. Los certificados externos se registran como
        evidencia: el sistema no los certifica oficialmente.
      </Muted>

      {error && <ErrorText message={error} />}
      {msg && <Success message={msg} />}

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('evidencia')}
          style={[styles.tab, tab === 'evidencia' && styles.tabOn]}
        >
          <Text style={tab === 'evidencia' ? styles.tabOnText : styles.tabText}>Evidencia</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('certificado')}
          style={[styles.tab, tab === 'certificado' && styles.tabOn]}
        >
          <Text style={tab === 'certificado' ? styles.tabOnText : styles.tabText}>Certificado</Text>
        </Pressable>
      </View>

      {tab === 'evidencia' ? (
        <EvidenceForm
          areas={areas}
          projects={projects}
          activities={activities}
          onError={setError}
          onSaved={async () => {
            notify('Evidencia registrada.');
            await load();
          }}
        />
      ) : (
        <CertificateForm
          areas={areas}
          onError={setError}
          onSaved={async () => {
            notify('Certificado registrado.');
            await load();
          }}
        />
      )}

      <Card title={`Mis evidencias (${evidences.length})`}>
        {evidences.length === 0 ? (
          <EmptyState message="Todavía no registras evidencias." />
        ) : (
          evidences.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {e.description || e.fileName || 'Evidencia'}
                </Text>
                <Text style={styles.rowMeta}>
                  {e.evidenceType === 'file' ? `Archivo · ${humanSize(e.fileSize)}` : 'Enlace'}
                  {e.project ? ` · ${e.project.title}` : ''}
                  {e.activity ? ` · ${e.activity.title}` : ''}
                  {e.academicArea ? ` · ${e.academicArea.name}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Abrir"
                      variant="secondary"
                      onPress={() =>
                        Linking.openURL(
                          e.evidenceType === 'file'
                            ? uploadService.fileUrl(e.fileUrl)
                            : e.externalUrl,
                        )
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Eliminar" variant="secondary" onPress={() => removeEvidence(e.id)} />
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card title={`Certificados externos (${certificates.length})`}>
        {certificates.length === 0 ? (
          <EmptyState message="Todavía no registras certificados externos." />
        ) : (
          certificates.map((c) => (
            <View key={c.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.certificateName}</Text>
                <Text style={styles.rowMeta}>
                  {c.issuer}
                  {c.issueDate ? ` · ${c.issueDate}` : ''}
                  {c.academicArea ? ` · ${c.academicArea.name}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {(c.fileUrl || c.certificateUrl) && (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Ver"
                        variant="secondary"
                        onPress={() =>
                          Linking.openURL(
                            c.fileUrl ? uploadService.fileUrl(c.fileUrl) : c.certificateUrl,
                          )
                        }
                      />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Eliminar"
                      variant="secondary"
                      onPress={() => removeCertificate(c.id)}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card title={`Constancias internas (${constancies.length})`}>
        <Muted>
          Las emite la dirección de carrera cuando tu participación queda confirmada. No sustituyen
          a un certificado oficial de la universidad.
        </Muted>
        {constancies.length === 0 ? (
          <EmptyState message="Todavía no recibes constancias internas." />
        ) : (
          constancies.map((c) => (
            <View key={c.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.description}</Text>
                <Text style={styles.rowMeta}>{c.activity?.title ?? 'Sin actividad'}</Text>
                <View style={{ marginTop: 6 }}>
                  <Badge color={colors.green}>Autorizada</Badge>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function useFilePicker(onError: (m: string) => void) {
  const [file, setFile] = useState<StoredFile | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    onError('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_BYTES) {
      onError('El archivo supera el máximo de 5 MB.');
      return;
    }
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    if (!ACCEPTED.includes(mimeType)) {
      onError('Formato no permitido. Se aceptan archivos PDF, PNG, JPG o WEBP.');
      return;
    }

    setBusy(true);
    try {
      setFile(
        await uploadService.upload({
          uri: asset.uri,
          name: asset.name ?? 'archivo',
          mimeType,
        }),
      );
    } catch (e) {
      onError(apiError(e, 'No se pudo subir el archivo.'));
    } finally {
      setBusy(false);
    }
  };

  return { file, setFile, pick, busy };
}

function Picker({
  label,
  options,
  value,
  onChange,
  emptyLabel,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  emptyLabel: string;
}) {
  if (options.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        <Pressable onPress={() => onChange('')} style={[styles.chip, value === '' && styles.chipOn]}>
          <Text style={value === '' ? styles.chipOnText : styles.chipText}>{emptyLabel}</Text>
        </Pressable>
        {options.map((o) => (
          <Pressable
            key={o.id}
            onPress={() => onChange(value === o.id ? '' : o.id)}
            style={[styles.chip, value === o.id && styles.chipOn]}
          >
            <Text style={value === o.id ? styles.chipOnText : styles.chipText}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function EvidenceForm({
  areas,
  projects,
  activities,
  onSaved,
  onError,
}: {
  areas: any[];
  projects: any[];
  activities: any[];
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [type, setType] = useState<'link' | 'file'>('link');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [projectId, setProjectId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [saving, setSaving] = useState(false);
  const { file, setFile, pick, busy } = useFilePicker(onError);

  const submit = async () => {
    if (type === 'file' && !file) {
      onError('Selecciona y sube un archivo antes de guardar.');
      return;
    }
    setSaving(true);
    try {
      await evidenceService.create({
        evidenceType: type,
        description: description || undefined,
        externalUrl: type === 'link' ? externalUrl : undefined,
        fileUrl: type === 'file' ? file?.url : undefined,
        fileName: type === 'file' ? file?.originalName : undefined,
        mimeType: type === 'file' ? file?.mimeType : undefined,
        fileSize: type === 'file' ? file?.size : undefined,
        projectId: projectId || undefined,
        activityId: activityId || undefined,
        academicAreaId: areaId || undefined,
      });
      setDescription('');
      setExternalUrl('');
      setFile(null);
      setProjectId('');
      setActivityId('');
      setAreaId('');
      onSaved();
    } catch (e) {
      onError(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Registrar evidencia">
      <View style={styles.chips}>
        <Pressable onPress={() => setType('link')} style={[styles.chip, type === 'link' && styles.chipOn]}>
          <Text style={type === 'link' ? styles.chipOnText : styles.chipText}>Enlace</Text>
        </Pressable>
        <Pressable onPress={() => setType('file')} style={[styles.chip, type === 'file' && styles.chipOn]}>
          <Text style={type === 'file' ? styles.chipOnText : styles.chipText}>Archivo</Text>
        </Pressable>
      </View>

      <Field
        label="Descripción"
        value={description}
        onChangeText={setDescription}
        placeholder="Certificado de asistencia al taller"
      />

      {type === 'link' ? (
        <Field
          label="Enlace"
          value={externalUrl}
          onChangeText={setExternalUrl}
          placeholder="https://github.com/usuario/proyecto"
        />
      ) : (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label}>Archivo (PDF, PNG, JPG o WEBP · máx. 5 MB)</Text>
          <Button
            title={busy ? 'Subiendo…' : file ? 'Cambiar archivo' : 'Seleccionar archivo'}
            variant="secondary"
            onPress={pick}
            disabled={busy}
          />
          {file && (
            <Text style={styles.fileChip}>
              {file.originalName} · {humanSize(file.size)}
            </Text>
          )}
        </View>
      )}

      <Picker
        label="Proyecto"
        emptyLabel="Ninguno"
        value={projectId}
        onChange={setProjectId}
        options={projects.map((p) => ({ id: p.id, label: p.title }))}
      />
      <Picker
        label="Actividad (solo en las que participas)"
        emptyLabel="Ninguna"
        value={activityId}
        onChange={setActivityId}
        options={activities.map((a) => ({ id: a.id, label: a.title }))}
      />
      <Picker
        label="Área académica"
        emptyLabel="Ninguna"
        value={areaId}
        onChange={setAreaId}
        options={areas.map((a) => ({ id: a.id, label: a.name }))}
      />

      <Button title={saving ? 'Guardando…' : 'Registrar evidencia'} onPress={submit} disabled={saving || busy} />
    </Card>
  );
}

function CertificateForm({
  areas,
  onSaved,
  onError,
}: {
  areas: any[];
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({
    certificateName: '',
    issuer: '',
    issueDate: '',
    description: '',
  });
  const [areaId, setAreaId] = useState('');
  const [saving, setSaving] = useState(false);
  const { file, setFile, pick, busy } = useFilePicker(onError);

  const submit = async () => {
    setSaving(true);
    try {
      await certificateService.create({
        certificateName: form.certificateName,
        issuer: form.issuer,
        issueDate: form.issueDate || undefined,
        description: form.description || undefined,
        academicAreaId: areaId || undefined,
        fileUrl: file?.url,
        fileName: file?.originalName,
        mimeType: file?.mimeType,
        fileSize: file?.size,
      });
      setForm({ certificateName: '', issuer: '', issueDate: '', description: '' });
      setAreaId('');
      setFile(null);
      onSaved();
    } catch (e) {
      onError(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Registrar certificado externo">
      <Field
        label="Nombre del certificado"
        value={form.certificateName}
        onChangeText={(t) => setForm({ ...form, certificateName: t })}
        placeholder="Fundamentos de pruebas automatizadas"
      />
      <Field
        label="Entidad emisora"
        value={form.issuer}
        onChangeText={(t) => setForm({ ...form, issuer: t })}
        placeholder="Plataforma externa de formación"
      />
      <Field
        label="Fecha de emisión (aaaa-mm-dd)"
        value={form.issueDate}
        onChangeText={(t) => setForm({ ...form, issueDate: t })}
        placeholder="2026-03-10"
      />
      <Field
        label="Descripción"
        value={form.description}
        onChangeText={(t) => setForm({ ...form, description: t })}
        placeholder="Curso de 40 horas con evaluación final"
        multiline
      />
      <Picker
        label="Área académica"
        emptyLabel="Sin área"
        value={areaId}
        onChange={setAreaId}
        options={areas.map((a) => ({ id: a.id, label: a.name }))}
      />
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>Archivo del certificado (opcional)</Text>
        <Button
          title={busy ? 'Subiendo…' : file ? 'Cambiar archivo' : 'Adjuntar archivo'}
          variant="secondary"
          onPress={pick}
          disabled={busy}
        />
        {file && (
          <Text style={styles.fileChip}>
            {file.originalName} · {humanSize(file.size)}
          </Text>
        )}
      </View>
      <Button
        title={saving ? 'Guardando…' : 'Registrar certificado'}
        onPress={submit}
        disabled={saving || busy}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 4 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  tabOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  tabText: { color: colors.gray700, fontSize: 13.5, fontWeight: '600' },
  tabOnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },
  label: { fontSize: 13, color: colors.gray700, marginBottom: 6, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
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
  fileChip: { marginTop: 8, fontSize: 12.5, color: colors.bordo, fontWeight: '600' },
  row: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: colors.gray900 },
  rowMeta: { fontSize: 12.5, color: colors.gray500, marginTop: 2 },
});
