import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { apiError } from '../../api/client';
import {
  catalogService,
  certificateService,
  constancyService,
  evidenceService,
  uploadService,
  type StoredFile,
} from '../../services';
import {
  Screen,
  Card,
  Muted,
  Field,
  Button,
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

/** §27.3: maximo por archivo. */
const MAX_BYTES = 10 * 1024 * 1024;
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
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

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
    ])
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const notify = (t: string) => toast.success(t);

  const needle = normalize(query.trim());
  const visibleEvidences = useMemo(
    () =>
      !needle
        ? evidences
        : evidences.filter((e: any) =>
            [e.description ?? '', e.fileName ?? '', e.project?.title ?? '',
              e.activity?.title ?? '', e.academicArea?.name ?? '']
              .some((f: string) => normalize(f).includes(needle)),
          ),
    [evidences, needle],
  );
  const visibleCertificates = useMemo(
    () =>
      !needle
        ? certificates
        : certificates.filter((c: any) =>
            [c.certificateName ?? '', c.issuer ?? '', c.academicArea?.name ?? '']
              .some((f: string) => normalize(f).includes(needle)),
          ),
    [certificates, needle],
  );

  const removeEvidence = async (evidence: any) => {
    const ok = await confirm({
      title: 'Eliminar evidencia',
      message: 'Se eliminará la evidencia y su archivo. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    setRemoving(evidence.id);
    try {
      await evidenceService.remove(evidence.id);
      notify('Evidencia eliminada.');
      await load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRemoving(null);
    }
  };

  const removeCertificate = async (certificate: any) => {
    const ok = await confirm({
      title: 'Eliminar certificado',
      message: `Se eliminará “${certificate.certificateName}” y su archivo. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    setRemoving(certificate.id);
    try {
      await certificateService.remove(certificate.id);
      notify('Certificado eliminado.');
      await load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRemoving(null);
    }
  };

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
        title="Credenciales y constancias"
        description="Tus credenciales externas y las constancias internas que recibiste. Afinia no las certifica: las valida por niveles."
      />

      {/* V3 §23: ya no hay una bandeja genérica de evidencias; las de un
          proyecto se agregan dentro del proyecto. Aquí quedan las credenciales,
          las constancias y las evidencias registradas antes. */}
      <Muted>Las evidencias de un proyecto se agregan dentro de cada proyecto, en «Proyectos».</Muted>

      <CertificateForm
        areas={areas}
        onError={(m: string) => toast.error(m)}
        onSaved={async () => {
          notify('Certificado registrado.');
          await load();
        }}
      />

      {(evidences.length > 0 || certificates.length > 0) && (
        <View style={{ marginTop: 14 }}>
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar evidencia, certificado o emisor…"
          />
        </View>
      )}

      <Card title={`Evidencias registradas antes (${evidences.length})`}>
        {evidences.length > 0 && (
          <ResultCount
            shown={visibleEvidences.length}
            total={evidences.length}
            noun="evidencias"
          />
        )}
        {evidences.length === 0 ? (
          <EmptyState icon="file-text" message="Todavía no registras evidencias." />
        ) : visibleEvidences.length === 0 ? (
          <EmptyState
            icon="search"
            message={`Ninguna evidencia coincide con “${query}”.`}
            action={
              <Button
                title="Limpiar búsqueda"
                icon="x"
                variant="secondary"
                small
                onPress={() => setQuery('')}
              />
            }
          />
        ) : (
          visibleEvidences.map((e, index) => (
            <FadeIn key={e.id} index={index}>
            <View style={styles.row}>
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
                      icon="external-link"
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
                    <Button
                      title="Eliminar"
                      icon="trash-2"
                      variant="secondary"
                      loading={removing === e.id}
                      onPress={() => removeEvidence(e)}
                    />
                  </View>
                </View>
              </View>
            </View>
            </FadeIn>
          ))
        )}
      </Card>

      <Card title={`Certificados externos (${certificates.length})`}>
        {certificates.length > 0 && (
          <ResultCount
            shown={visibleCertificates.length}
            total={certificates.length}
            noun="certificados"
          />
        )}
        {certificates.length === 0 ? (
          <EmptyState icon="award" message="Todavía no registras certificados externos." />
        ) : visibleCertificates.length === 0 ? (
          <EmptyState
            icon="search"
            message={`Ningún certificado coincide con “${query}”.`}
            action={
              <Button
                title="Limpiar búsqueda"
                icon="x"
                variant="secondary"
                small
                onPress={() => setQuery('')}
              />
            }
          />
        ) : (
          visibleCertificates.map((c, index) => (
            <FadeIn key={c.id} index={index}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.certificateName}</Text>
                <Text style={styles.rowMeta}>
                  {c.issuer}
                  {c.issueDate ? ` · ${c.issueDate}` : ''}
                  {c.academicArea ? ` · ${c.academicArea.name}` : ''}
                </Text>
                {/* V2 §41: las tecnologías que el certificado acredita. */}
                {(c.skills ?? []).length > 0 && (
                  <Text style={styles.rowMeta}>
                    {(c.skills ?? []).map((s: any) => s.skill?.name).filter(Boolean).join(' · ')}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {(c.fileUrl || c.certificateUrl) && (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Ver"
                        icon="external-link"
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
                      icon="trash-2"
                      variant="secondary"
                      loading={removing === c.id}
                      onPress={() => removeCertificate(c)}
                    />
                  </View>
                </View>
              </View>
            </View>
            </FadeIn>
          ))
        )}
      </Card>

      <Card title={`Constancias internas (${constancies.length})`}>
        <Muted>
          Las emite la dirección de carrera cuando tu participación queda confirmada. No sustituyen
          a un certificado oficial de la universidad.
        </Muted>
        {constancies.length === 0 ? (
          <EmptyState icon="check-circle" message="Todavía no recibes constancias internas." />
        ) : (
          constancies.map((c: any) => (
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
      onError('El archivo supera el máximo de 10 MB.');
      return;
    }
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    if (!ACCEPTED.includes(mimeType)) {
      onError('Formato no permitido. Se aceptan archivos PDF, PNG, JPG o WEBP.');
      return;
    }

    setBusy(true);
    try {
      const subido = await uploadService.upload({
        uri: asset.uri,
        name: asset.name ?? 'archivo',
        mimeType,
      });
      setFile(subido);
      // §28: no se impide, se avisa. El mismo documento puede respaldar
      // legitimamente dos cosas; lo que no hara es contar dos veces.
      if (subido.duplicateOfId) {
        onError('Ya habías subido este mismo archivo. Puedes usarlo igual, pero no sumará respaldo por separado.');
      }
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
  // V3 §15/§16: de una oportunidad terminada en la que participó, o histórica.
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [activityId, setActivityId] = useState('');
  useEffect(() => {
    certificateService.eligibleOpportunities().then(setOportunidades).catch(() => setOportunidades([]));
  }, []);
  const elegir = (id: string) => {
    setActivityId(id);
    const o = oportunidades.find((x) => x.activityId === id);
    if (o) {
      setForm((f) => ({
        ...f,
        certificateName: f.certificateName || o.expectedCourseName || o.title,
        issuer: f.issuer || o.provider || '',
      }));
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await certificateService.create({
        activityId: activityId || undefined,
        certificateName: form.certificateName,
        issuer: form.issuer,
        issueDate: form.issueDate || undefined,
        description: form.description || undefined,
        academicAreaId: areaId || undefined,
        storedFileId: file?.id,
      });
      setForm({ certificateName: '', issuer: '', issueDate: '', description: '' });
      setAreaId('');
      setFile(null);
      setActivityId('');
      certificateService.eligibleOpportunities().then(setOportunidades).catch(() => {});
      onSaved();
    } catch (e) {
      onError(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Adjuntar credencial externa">
      <Picker
        label="¿De dónde viene?"
        emptyLabel="Histórica: la obtuve antes o fuera de Afinia"
        value={activityId}
        onChange={elegir}
        options={oportunidades.map((o) => ({
          id: o.activityId,
          label: o.provider ? `${o.title} · ${o.provider}` : o.title,
        }))}
      />
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
            {file.originalFilename} · {humanSize(file.sizeBytes)}
          </Text>
        )}
      </View>
      <Button
        title="Adjuntar credencial"
        icon="award"
        onPress={submit}
        loading={saving}
        disabled={busy}
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
