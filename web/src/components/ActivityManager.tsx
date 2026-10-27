import { FieldError, FormAlert, useFormErrors } from './form';
import { ImagenProtegida } from './ArchivoProtegido';
import PersonPicker from './PersonPicker';
import { entradaAIso, formatearFechaHora, isoAEntrada } from '../lib/fechas';
import { placeName } from '../lib/validators';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiAward, FiCalendar, FiCheck, FiCopy, FiEdit2, FiImage, FiLink, FiPlus, FiSave, FiSearch, FiSend, FiTrash2, FiUserX, FiUsers, FiX,
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import { enMemoria, useCachedState } from '../hooks/viewCache';
import { apiError } from '../api/client';
import { activityService, catalogService, constancyService, gamificationService, uploadService, validationReferenceService } from '../services';
import type {
  AcademicArea, Activity, ActivityCategoryItem, ActivityPerson, OutcomePolicy, Participant, ResourceLink, Skill,
} from '../services/types';
import AreaSkillPicker from './AreaSkillPicker';
import {
  Badge, Button, Card, Diferido, EmptyState, FILAS_POR_PAGINA, Modal, Paginacion, ResultCount, SearchInput,
  SkeletonTable, Stagger, ThOrden, useOrden, usePaginacion,
} from './ui';
import { useConfirm, useToast } from './feedback';
import { ACTIVITY_REVIEW_LABEL, ACTIVITY_TRANSITIONS } from '../services/types';
import {
  ACTIVITY_MODALITIES,
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_STATUSES,
  REGISTRATION_BADGE,
  registrationLabel,
  lbl,
} from '../constants';

/** V4.1 A41-006 (A.5): tope de imágenes por actividad. */
const MAX_IMAGENES = 5;

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const emptyForm = {
  title: '',
  description: '',
  categoryId: '',
  modality: 'presencial',
  areaIds: [] as string[],
  skillIds: [] as string[],
  /** V3.2 §11.4: área en la que se trabaja cada habilidad. */
  skillContexts: {} as Record<string, string>,
  originType: 'internal' as 'internal' | 'external',
  provider: '',
  outcomePolicy: 'none' as OutcomePolicy,
  expectedIssuerDomains: '',
  expectedKeywords: '',
  // V3 §17: referencia de validación para la credencial que llegue después.
  expectedCourseName: '',
  credentialIdPattern: '',
  sampleStoredFileId: '',
  sampleFileName: '',
  /** V3.2 §16–§17: responsables (el primero es el principal) y contactos. */
  responsables: [] as ActivityPerson[],
  contactos: [] as ActivityPerson[],
  /** V3.2 §38: hora de pared en la zona de la carrera («2026-10-12T16:45»). */
  activityDate: '',
  endAt: '',
  location: '',
  meetingUrl: '',
  externalUrl: '',
  resourceLinks: [] as ResourceLink[],
  /** V4.1 A41-006: hasta 5 imágenes; la primera es la portada. */
  imagenes: [] as { fileId: string; url: string }[],
  /** V3.2 §28.3: emisor real del certificado institucional. */
  certificateIssuer: '',
  capacity: '',
  /** V5 §6.1: abierta (admite sola si no hay cupo) o por aprobación del responsable. */
  registrationMode: 'open' as 'open' | 'approval',
  status: 'draft',
  semesterScope: [] as number[],
  /** V4.1 A41-016: criterio de puntos configurado (sin puntos libres). */
  criterionId: '',
};

/** Estado de revisión (V2 §27) en palabras y color. */
function revision(a: Activity): { label: string; tone: string } {
  if (!a.requiresReview) return { label: ACTIVITY_REVIEW_LABEL.not_required, tone: 'gray' };
  const k = a.reviewStatus ?? 'unsubmitted';
  const tone = { unsubmitted: 'gray', pending: 'amber', observed: 'amber', approved: 'green', rejected: 'red', not_required: 'gray' }[k];
  return { label: ACTIVITY_REVIEW_LABEL[k], tone };
}

/** V3.2 §28: lo que ofrece una actividad interna al terminar. */
const RESULTADOS: { value: OutcomePolicy; label: string; hint: string }[] = [
  { value: 'none', label: 'Sin resultado', hint: 'No genera ningún documento.' },
  { value: 'participation_only', label: 'Solo participación', hint: 'La asistencia que registra el responsable queda en la trayectoria del estudiante. No es un certificado.' },
  // V5 §1.2, §7: Afinia ya no emite constancias. Solo se muestra en una actividad antigua que la tenía.
  { value: 'internal_constancy', label: 'Constancia interna (histórica)', hint: 'Afinia ya no emite constancias nuevas: la asistencia registrada queda en la trayectoria. Las constancias ya emitidas se conservan.' },
  { value: 'institution_issued_certificate', label: 'Certificado emitido por la institución', hint: 'Lo emite Univalle u otro actor institucional: Afinia no se atribuye la autoría y guarda el emisor real.' },
  { value: 'external_credential_expected', label: 'Credencial externa esperada', hint: 'Conduce a una credencial de un tercero que el estudiante acreditará después.' },
];

/** Campos que la API puede señalar, para mostrar cada error debajo del suyo (§6.4). */
const CAMPOS = [
  'title', 'categoryId', 'activityDate', 'endAt', 'location', 'meetingUrl', 'areaIds', 'skillIds', 'skillContexts',
  'provider', 'externalUrl', 'responsibleUserIds', 'responsibleUserId', 'contactUserIds', 'resourceLinks',
  'imageFileIds', 'capacity', 'outcomePolicy', 'semesterScope', 'status', 'certificateIssuer', 'gamificationRules',
] as const;

const publicable = (a: Activity) =>
  !a.requiresReview || a.reviewStatus === 'approved' || a.reviewStatus === 'not_required';

export default function ActivityManager({
  activityType,
  filtroOrigen,
  puedeCrear = true,
  onFormularioAbierto,
}: {
  activityType: 'academica' | 'extracurricular';
  /** V3.2 §26: la vista «Externas» de Dirección muestra las externas de cualquier tipo. */
  filtroOrigen?: 'internal' | 'external';
  /** Dirección da seguimiento a lo extracurricular aprobado, pero no lo crea (§15). */
  puedeCrear?: boolean;
  /** V5 §5.1: avisa si hay un formulario abierto, para confirmar antes de cambiar de pestaña. */
  onFormularioAbierto?: (abierto: boolean) => void;
}) {
  const { user } = useAuth();
  /** Docente y Sociedad proponen; Dirección decide. Dirección y Administración publican sin revisión (V3 §12.2). */
  const necesitaRevision = user?.role !== 'CAREER_DIRECTOR' && user?.role !== 'ADMIN';
  const esAdmin = user?.role === 'ADMIN';
  // V4.1 A41-009: Dirección o Administración (autoridad que asigna responsables).
  const esAutoridad = user?.role === 'ADMIN' || user?.role === 'CAREER_DIRECTOR';
  // Con memoria de la sesión: al volver a la gestión se pinta al instante.
  const [semestresPermitidos, setSemestresPermitidos] = useCachedState<number[]>('semestres', [1, 2, 3, 4, 5, 6, 7, 8]);
  const [activities, setActivities] = useCachedState<Activity[]>(`actividades-${activityType}-${filtroOrigen ?? 'todas'}`, []);
  const [areas, setAreas] = useCachedState<AcademicArea[]>('areas', []);
  const [skills, setSkills] = useCachedState<Skill[]>('skills', []);
  const errores = useFormErrors(CAMPOS);
  /** V3.2 §21.6: cancelar pide un motivo. */
  const [cancelando, setCancelando] = useState<Activity | null>(null);
  const [motivo, setMotivo] = useState('');
  const [motivoError, setMotivoError] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [loading, setLoading] = useState(() => !enMemoria(`actividades-${activityType}-${filtroOrigen ?? 'todas'}`));
  /** Solo el fallo de la carga inicial: el resto de errores son avisos flotantes. */
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const [categories, setCategories] = useCachedState<ActivityCategoryItem[]>('categorias', []);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [showForm, setShowForm] = useState(false);
  useEffect(() => { onFormularioAbierto?.(showForm); }, [showForm, onFormularioAbierto]);
  const [form, setForm] = useState(emptyForm);

  const [selected, setSelected] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [partLoading, setPartLoading] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [partQuery, setPartQuery] = useState('');

  // Del catálogo administrable: las que aplican a este tipo o a ambos (RF4).
  const usableCategories = categories.filter(
    (c) => c.isActive && (!c.appliesTo || c.appliesTo === activityType),
  );

  const notify = (t: string, detail?: string) => toast.success(t, detail);

  const load = useCallback(async () => {
    const list = await activityService.managed();
    setActivities(list.filter((a) => (filtroOrigen === 'external'
      ? a.originType === 'external'
      : a.type === activityType && (!filtroOrigen || (a.originType ?? 'internal') === filtroOrigen))));
  }, [activityType, filtroOrigen]);

  // V4.1 A41-016 (§9.2): los puntos salen de un criterio vigente; no se escriben a mano.
  const [criterios, setCriterios] = useState<{ id: string; name: string; points: number }[]>([]);
  useEffect(() => {
    gamificationService.availableCriteria('participacion_confirmada').then(setCriterios).catch(() => setCriterios([]));
  }, []);

  useEffect(() => {
    Promise.all([
      load(),
      catalogService.areas().then(setAreas),
      catalogService.skills().then((s) => setSkills(s.filter((x) => x.isActive))),
      catalogService.activityCategories().then(setCategories),
      user?.role === 'TEACHER'
        ? activityService.myScope().then((r) => setSemestresPermitidos(r.semesters))
        : Promise.resolve(),
    ])
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [load]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return activities.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (!q) return true;
      return [a.title, a.description ?? '', a.location ?? '', a.category?.name ?? '',
        a.academicArea?.name ?? '', (a.searchKeywords ?? []).join(' ')]
        .some((field) => normalize(field).includes(q));
    });
  }, [activities, query, statusFilter]);

  // V3.2 §6.1: 10 por página. V4.1 A41-003: orden por columna.
  const { ordenados: gestionOrdenada, orden: ordenGestion, alternar: alternarGestion } = useOrden(visible, {
    titulo: (a) => a.title,
    categoria: (a) => a.category?.name ?? '',
    fecha: (a) => (a.eventDate ? new Date(a.eventDate).getTime() : null),
    estado: (a) => a.status,
    revision: (a) => a.reviewStatus ?? 'unsubmitted',
    confirmados: (a) => a.confirmedCount ?? 0,
    pendientes: (a) => (a.registrationCount ?? 0) - (a.confirmedCount ?? 0),
  });
  const pagGestion = usePaginacion(gestionOrdenada, FILAS_POR_PAGINA, [query, statusFilter, activities.length, ordenGestion]);

  const resetForm = () => {
    setForm({ ...emptyForm, categoryId: usableCategories[0]?.id ?? '' });
    setEditing(null);
    setShowForm(false);
    errores.reset();
  };

  const externa = form.originType === 'external';
  const presencial = form.modality === 'presencial' || form.modality === 'hibrida';
  const virtual = form.modality === 'virtual' || form.modality === 'hibrida';
  const esDocente = user?.role === 'TEACHER';

  /**
   * V3.2 §6.4, §18, §21.1: errores por campo. Un borrador puede quedar
   * incompleto; publicar o enviar a revisión exige lo mínimo. El servidor
   * valida lo mismo (esto solo evita el viaje).
   */
  const validarLocal = (completa: boolean): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'El título es obligatorio.';
    else if (!/\p{L}/u.test(form.title)) e.title = 'El título no puede contener solo símbolos.';
    if (!form.categoryId) e.categoryId = 'Elige una categoría.';
    const ini = entradaAIso(form.activityDate);
    const fin = entradaAIso(form.endAt);
    if (ini && fin && new Date(fin).getTime() <= new Date(ini).getTime()) {
      e.endAt = 'La fecha final debe ser posterior a la fecha inicial.';
    }
    form.resourceLinks.forEach((l) => {
      if (!l.label.trim() || !/^https:\/\/\S+\.\S+/.test(l.url.trim())) {
        e.resourceLinks = 'Cada enlace necesita un nombre y una URL https.';
      }
    });
    if (form.meetingUrl && !/^https:\/\/\S+\.\S+/.test(form.meetingUrl.trim())) {
      e.meetingUrl = 'El enlace de la reunión debe ser una URL https.';
    }
    // V4.1 A41-004: el formato del aula vale siempre que se escriba (también en
    // borrador); que sea obligatoria lo decide la modalidad al publicar.
    if (!externa && presencial && form.location.trim()) {
      const lugar = placeName(form.location);
      if (lugar) e.location = lugar;
    }
    if (completa) {
      if (!ini) e.activityDate = 'Indica la fecha y hora de inicio.';
      if (!fin && !e.endAt) e.endAt = 'Indica la fecha y hora de fin.';
      if (!externa && presencial && !form.location.trim()) e.location = 'Indica el aula o el lugar.';
      if (!externa && virtual && !form.meetingUrl.trim()) e.meetingUrl = 'Indica el enlace de la reunión.';
      if (externa && !form.provider.trim()) e.provider = 'Indica el proveedor de la oportunidad externa.';
      if (externa && !form.externalUrl.trim()) e.externalUrl = 'Indica el enlace oficial de la oportunidad externa.';
      if (!externa && form.outcomePolicy === 'institution_issued_certificate' && !form.certificateIssuer.trim()) {
        e.certificateIssuer = 'Indica quién emite el certificado: Afinia no se atribuye su autoría.';
      }
      if (form.areaIds.length === 0) e.areaIds = 'Selecciona al menos un área.';
      if (cobertura && (form.semesterScope.length === 0 || form.semesterScope.some((n) => !cobertura.includes(n)))) {
        e.semesterScope = 'Elige semestres que cubran los docentes responsables, o suma un responsable que cubra toda la carrera.';
      }
      // V4.1 V41-01: una charla general puede no tener una habilidad concreta.
      // V4.1 A41-007: el borrador puede guardarse sin responsable; se pide al publicar.
      if (esAdmin && form.responsables.length === 0) e.responsibleUserIds = 'Indica quién responde por esta oportunidad antes de publicar.';
    }
    errores.setErrors(e as never);
    if (Object.keys(e).length) {
      const primero = document.querySelector<HTMLElement>(`[data-campo="${Object.keys(e)[0]}"] input, [data-campo="${Object.keys(e)[0]}"] select, [data-campo="${Object.keys(e)[0]}"] textarea, [data-campo="${Object.keys(e)[0]}"] button`);
      primero?.focus();
    }
    return Object.keys(e).length === 0;
  };

  /**
   * V3.2 §22: acciones explícitas. Guardar nunca publica por accidente.
   *   Dirección / Administración → «Guardar borrador» o «Publicar».
   *   Docente / Sociedad         → «Guardar borrador» o «Enviar a revisión».
   * Editar algo ya publicado → «Guardar cambios».
   */
  const guardar = async (accion: 'draft' | 'publish' | 'review' | 'save') => {
    if (!validarLocal(accion !== 'draft')) return;
    setSaving(true);
    errores.reset();
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || undefined,
      type: activityType,
      categoryId: form.categoryId,
      modality: form.modality,
      areaIds: form.areaIds,
      skillIds: form.skillIds,
      skillContexts: form.skillIds
        .filter((id) => form.skillContexts[id] && form.areaIds.includes(form.skillContexts[id]))
        .map((id) => ({ skillId: id, areaId: form.skillContexts[id] })),
      originType: form.originType,
      // V3.2 §29: una externa no tiene selector; su resultado es la credencial.
      ...(externa ? {} : { outcomePolicy: form.outcomePolicy }),
      ...(!externa && form.outcomePolicy === 'institution_issued_certificate'
        ? { certificateIssuer: form.certificateIssuer.trim() }
        : {}),
      ...(externa || form.outcomePolicy === 'external_credential_expected'
        ? {
          provider: form.provider.trim(),
          expectedIssuerDomains: form.expectedIssuerDomains.split(',').map((t) => t.trim()).filter(Boolean),
          expectedKeywords: form.expectedKeywords.split(',').map((t) => t.trim()).filter(Boolean),
        }
        : {}),
      ...(!esDocente && (esAdmin || form.responsables.length > 0)
        ? { responsibleUserIds: form.responsables.map((p) => p.id) }
        : {}),
      contactUserIds: form.contactos.map((p) => p.id),
      activityDate: entradaAIso(form.activityDate),
      endAt: entradaAIso(form.endAt),
      location: presencial ? form.location || undefined : undefined,
      meetingUrl: virtual ? form.meetingUrl.trim() || null : null,
      externalUrl: form.externalUrl || undefined,
      resourceLinks: form.resourceLinks
        .filter((l) => l.label.trim() || l.url.trim())
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
      imageFileIds: editing || form.imagenes.length ? form.imagenes.map((i) => i.fileId) : undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      ...(externa ? {} : { registrationMode: form.registrationMode }),
      semesterScope: form.semesterScope.length ? form.semesterScope : undefined,
      gamificationRules: form.criterionId
        ? [{ trigger: 'participacion_confirmada', criterionId: form.criterionId }]
        : [],
    };
    if (!editing) payload.status = accion === 'publish' ? 'open' : 'draft';
    else if (accion === 'publish' && editing.status === 'draft') payload.status = 'open';
    const conReferencia = externa || form.outcomePolicy === 'external_credential_expected';
    const guardarReferencia = async (id: string) => {
      if (!conReferencia) return;
      if (!editing && !form.expectedCourseName.trim() && !form.credentialIdPattern.trim() && !form.sampleStoredFileId) return;
      await validationReferenceService.save(id, {
        expectedCourseName: form.expectedCourseName.trim() || null,
        credentialIdPattern: form.credentialIdPattern.trim() || null,
        sampleStoredFileId: form.sampleStoredFileId || null,
      });
    };
    try {
      let id: string;
      if (editing) {
        delete payload.type;
        await activityService.update(editing.id, payload);
        id = editing.id;
      } else {
        id = (await activityService.create(payload as never) as Activity).id;
      }
      await guardarReferencia(id);
      if (accion === 'review') await activityService.submit(id);
      notify(
        accion === 'review' ? 'Enviada a revisión de Dirección.'
          : accion === 'publish' ? 'Actividad publicada: ya acepta inscripciones.'
            : accion === 'draft' ? 'Borrador guardado. Nadie más lo ve todavía.'
              : 'Cambios guardados.',
      );
      resetForm();
      await load();
    } catch (err) {
      errores.fromApi(err);
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  /** V4.1 A41-006: agrega imágenes hasta un máximo de 5, sin tocar las ya elegidas. */
  const subirImagenes = async (archivos: File[]) => {
    const libres = MAX_IMAGENES - form.imagenes.length;
    if (archivos.some((f) => !/^image\/(png|jpeg|webp)$/.test(f.type))) {
      errores.setErrors({ imageFileIds: 'Las imágenes tienen que ser PNG, JPG o WEBP.' } as never);
      return;
    }
    if (archivos.length > libres) {
      errores.setErrors({ imageFileIds: `Puedes agregar hasta ${MAX_IMAGENES} imágenes (te quedan ${Math.max(libres, 0)}).` } as never);
      return;
    }
    setSubiendoImagen(true);
    try {
      const nuevas: { fileId: string; url: string }[] = [];
      for (const f of archivos) {
        const subido = await uploadService.upload(f);
        nuevas.push({ fileId: subido.id, url: URL.createObjectURL(f) });
      }
      setForm((x) => ({ ...x, imagenes: [...x.imagenes, ...nuevas].slice(0, MAX_IMAGENES) }));
      errores.clear('imageFileIds');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubiendoImagen(false);
    }
  };
  const quitarImagen = (fileId: string) =>
    setForm((x) => ({ ...x, imagenes: x.imagenes.filter((i) => i.fileId !== fileId) }));
  const hacerPortada = (fileId: string) =>
    setForm((x) => {
      const elegida = x.imagenes.find((i) => i.fileId === fileId);
      return elegida ? { ...x, imagenes: [elegida, ...x.imagenes.filter((i) => i.fileId !== fileId)] } : x;
    });

  /**
   * V4.1 A41-009 (§4.5): si todos los responsables son docentes, los semestres
   * que pueden atender son la unión de sus alcances. `null` si no aplica.
   */
  const cobertura = useMemo(() => {
    if (!esAutoridad || activityType !== 'academica' || form.responsables.length === 0) return null;
    if (!form.responsables.every((p) => p.role === 'TEACHER' && Array.isArray(p.semesters))) return null;
    return [...new Set(form.responsables.flatMap((p) => p.semesters ?? []))].sort((x, y) => x - y);
  }, [esAutoridad, activityType, form.responsables]);

  /** V5-06 (B07): borrar un borrador propio sin historia; lo publicado se cancela. */
  const borrarBorrador = async (a: Activity) => {
    const ok = await confirm({
      title: 'Borrar el borrador',
      message: (
        <>
          Se borrará <strong>{a.title}</strong> con su configuración. No se puede deshacer.
          Solo se borran borradores que nunca se enviaron ni se publicaron.
        </>
      ),
      confirmLabel: 'Borrar borrador',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await activityService.deleteDraft(a.id);
      if (selected === a.id) setSelected(null);
      await load();
      notify('Borrador eliminado.', 'Queda registrado en la auditoría.');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const duplicar = async (a: Activity) => {
    try {
      const copia = await activityService.duplicate(a.id);
      toast.success('Copia creada como borrador.', 'Revisa las fechas y publícala cuando esté lista.');
      await load();
      startEdit(copia);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const startEdit = (a: Activity) => {
    setEditing(a);
    setShowForm(true);
    setForm({
      title: a.title,
      description: a.description ?? '',
      categoryId: a.categoryId,
      modality: a.modality,
      areaIds: (a.activityAreas ?? []).map((x) => x.academicAreaId).length
        ? (a.activityAreas ?? []).map((x) => x.academicAreaId)
        : a.academicAreaId ? [a.academicAreaId] : [],
      skillIds: (a.activitySkills ?? []).map((x) => x.skillId),
      skillContexts: Object.fromEntries(
        (a.activitySkills ?? []).filter((x) => x.academicAreaId).map((x) => [x.skillId, x.academicAreaId as string]),
      ),
      originType: a.originType ?? 'internal',
      provider: a.provider ?? '',
      outcomePolicy: a.outcomePolicy ?? (a.internalConstancyEnabled ? 'internal_constancy' : 'none'),
      expectedIssuerDomains: (a.expectedIssuerDomains ?? []).join(', '),
      expectedKeywords: (a.expectedKeywords ?? []).join(', '),
      responsables: a.responsibles ?? [],
      contactos: a.contacts ?? [],
      // V3.2 §38 (C11): se recupera exactamente el instante, en la zona de la carrera.
      activityDate: isoAEntrada(a.eventDate),
      endAt: isoAEntrada(a.endAt),
      location: a.location ?? '',
      meetingUrl: a.meetingUrl ?? '',
      externalUrl: a.externalUrl ?? '',
      resourceLinks: a.resourceLinks ?? [],
      imagenes: a.images?.length ? a.images : a.imageFileId && a.imageUrl ? [{ fileId: a.imageFileId, url: a.imageUrl }] : [],
      certificateIssuer: a.certificateIssuer ?? '',
      capacity: a.capacity ? String(a.capacity) : '',
      registrationMode: a.registrationMode ?? 'open',
      status: a.status,
      semesterScope: a.semesterScope ?? [],
      criterionId: a.gamificationRules?.find((r) => r.trigger === 'participacion_confirmada')?.criterionId ?? '',
      expectedCourseName: '',
      credentialIdPattern: '',
      sampleStoredFileId: '',
      sampleFileName: '',
    });
    if (a.originType === 'external' || a.outcomePolicy === 'external_credential_expected') {
      validationReferenceService.get(a.id).then((r) => setForm((f) => ({
        ...f,
        expectedCourseName: r.expectedCourseName ?? '',
        credentialIdPattern: r.credentialIdPattern ?? '',
        sampleStoredFileId: r.sampleStoredFileId ?? '',
        sampleFileName: r.sampleFileName ?? '',
      }))).catch(() => {});
    }
    errores.reset();
    // El detalle trae responsables, contactos, imágenes y (V4.1 A41-005) las
    // habilidades con su área: el formulario no abre con menos de lo guardado.
    activityService.get(a.id).then((d) => setForm((f) => ({
      ...f,
      responsables: d.responsibles ?? f.responsables,
      contactos: d.contacts ?? f.contactos,
      imagenes: d.images?.length ? d.images : f.imagenes,
      ...(d.activitySkills ? {
        skillIds: d.activitySkills.map((x) => x.skillId),
        skillContexts: Object.fromEntries(
          d.activitySkills.filter((x) => x.academicAreaId).map((x) => [x.skillId, x.academicAreaId as string]),
        ),
      } : {}),
      ...(d.activityAreas?.length ? { areaIds: d.activityAreas.map((x) => x.academicAreaId) } : {}),
    }))).catch(() => {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Pasar a cancelada o volver a borrador saca la actividad de la vista del
   * estudiante, asi que esos dos casos se confirman antes.
   */
  /** V3.2 §23.1: retirar el envío para corregir antes de que Dirección decida. */
  const cancelarEnvio = async (a: Activity) => {
    try {
      await activityService.cancelSubmission(a.id);
      notify('Envío retirado.', 'La actividad volvió a borrador: corrígela y envíala de nuevo.');
      await load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  /** V3.2 §23.3 (C10): aprobada, Docente y Sociedad ya no editan su contenido. */
  /*
   * V5-09 (B08, I03): «Editar» aparece solo donde el backend lo permite. Quien
   * fue asignado responsable de una actividad que creó Dirección o
   * Administración opera (inscripciones, asistencia, abrir o cerrar), pero no
   * cambia su contenido: no se le ofrece un botón que fallaría al guardar.
   */
  const soloOpera = (a: Activity) => a.creatorId !== user?.id && !esAutoridad
    && ['CAREER_DIRECTOR', 'ADMIN'].includes(a.creator?.role?.name ?? '');
  const editable = (a: Activity) => !soloOpera(a) && !(necesitaRevision && a.requiresReview && a.reviewStatus === 'approved');

  const enviarARevision = async (a: Activity) => {
    try {
      await activityService.submit(a.id);
      notify('Enviada a Dirección.', 'Te avisaremos aquí con su decisión.');
      await load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const changeStatus = async (a: Activity, status: string) => {
    const label = lbl(ACTIVITY_STATUS_LABEL, status);
    if (status === 'cancelled') {
      // V3.2 §21.6: cancelar exige motivo, que verá el estudiante.
      setMotivo('');
      setMotivoError(null);
      setCancelando(a);
      return;
    }
    if (status === 'draft') {
      const ok = await confirm({
        title: 'Devolver a borrador',
        message: (
          <>
            <strong>{a.title}</strong> dejará de estar disponible para los estudiantes
            {(a.registrationCount ?? 0) > 0
              ? ` y ya tiene ${a.registrationCount} inscripción(es) registrada(s).`
              : '.'}
          </>
        ),
        confirmLabel: 'Devolver a borrador',
        cancelLabel: 'Dejar como está',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await activityService.update(a.id, { status });
      notify(`Estado actualizado a “${label}”.`);
      await load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  /** V3.2 §28.3: entrega del certificado que emitió la institución. */
  const [entrega, setEntrega] = useState<{ ids: string[]; nombre: string } | null>(null);
  /** V4.1 A41-011: corrección excepcional en curso. */
  const [correccion, setCorreccion] = useState<{ row: Participant; status: 'confirmed' | 'absent' } | null>(null);
  const [rechazo, setRechazo] = useState<Participant | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [errorRechazo, setErrorRechazo] = useState<string | null>(null);
  const [motivoCorr, setMotivoCorr] = useState('');
  const [errorCorr, setErrorCorr] = useState<string | null>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [archivoCert, setArchivoCert] = useState<{ id: string; nombre: string } | null>(null);
  const [entregando, setEntregando] = useState(false);
  const entregarCertificado = async () => {
    if (!entrega || !selected) return;
    setEntregando(true);
    try {
      const r = await constancyService.deliverInstitutionCertificates(selected, {
        profileIds: entrega.ids,
        ...(archivoCert ? { storedFileId: archivoCert.id } : {}),
        ...(codigo.trim() ? { certificateCode: codigo.trim() } : {}),
      });
      notify('Certificado entregado.', `${r.delivered} estudiante(s) lo tienen en su trayectoria.`);
      setEntrega(null);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setEntregando(false);
    }
  };

  const confirmarCancelacion = async () => {
    if (!cancelando) return;
    if (motivo.trim().length < 10) {
      setMotivoError('Explica el motivo en al menos 10 caracteres.');
      return;
    }
    try {
      await activityService.update(cancelando.id, { status: 'cancelled', cancellationReason: motivo.trim() });
      notify('Actividad cancelada.', 'Los estudiantes verán el motivo.');
      setCancelando(null);
      await load();
    } catch (e) {
      setMotivoError(apiError(e));
    }
  };

  const openParticipants = async (activityId: string) => {
    setSelected(activityId);
    setPartQuery('');
    setPartLoading(true);
    try {
      setParticipants(await activityService.participants(activityId));
    } catch (e) {
      toast.error(apiError(e));
      setParticipants([]);
    } finally {
      setPartLoading(false);
    }
  };

  /**
   * Marcar ausente retira participacion que ya cuenta en el perfil del
   * estudiante (RN-9), de modo que se confirma antes de enviarlo.
   */
  const decide = async (
    activityId: string,
    row: Participant,
    status: 'confirmed' | 'absent' | 'accepted' | 'rejected',
    reason?: string,
  ) => {
    const who = row.studentName ?? 'el estudiante';
    const externa = activities.find((a) => a.id === activityId)?.originType === 'external';
    if (status === 'absent') {
      const ok = await confirm({
        title: 'Registrar ausencia',
        message: (
          <>
            Se registrará a <strong>{who}</strong> como ausente.
            {row.status === 'confirmed'
              && ' Su participación estaba confirmada y dejará de contar en su perfil.'}
          </>
        ),
        confirmLabel: 'Registrar ausente',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusyRow(row.id);
    try {
      await activityService.confirm(activityId, row.studentProfileId, status, reason);
      setParticipants(await activityService.participants(activityId));
      await load();
      // V5 §6: cada aviso dice qué pasó; admitir no es asistir.
      const aviso: Record<typeof status, [string, string]> = {
        confirmed: ['Asistencia registrada.', 'suma a su trayectoria'],
        accepted: externa
          ? ['Aceptación registrada.', 'podrá adjuntar su credencial cuando termine la oportunidad']
          : ['Inscripción admitida.', 'tiene un lugar; la asistencia se registra el día del evento'],
        rejected: ['Solicitud no admitida.', 'verá el motivo'],
        absent: ['Registrado como ausente.', 'no cuenta en su trayectoria'],
      };
      notify(aviso[status][0], `${who} · ${aviso[status][1]}`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusyRow(null);
    }
  };

  /** V5 §6: no admitir una solicitud exige un motivo que verá el estudiante. */
  const noAdmitir = async () => {
    if (!selected || !rechazo) return;
    if (motivoRechazo.trim().length < 5) { setErrorRechazo('Explica el motivo (al menos 5 caracteres): el estudiante lo verá.'); return; }
    await decide(selected, rechazo, 'rejected', motivoRechazo.trim());
    setRechazo(null);
  };

  /** V4.1 A41-011 (§5, B19): cerrar el acta; después no se editan filas por la vía ordinaria. */
  const cerrarAsistencia = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: 'Cerrar asistencia',
      message: 'Después de cerrarla ya no se registra asistencia por la vía ordinaria. Un error lo corrige Dirección con un motivo.',
      confirmLabel: 'Cerrar asistencia',
    });
    if (!ok) return;
    try {
      await activityService.closeAttendance(selected);
      await load();
      notify('Asistencia cerrada.', 'El registro queda como está; el historial se conserva.');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  /** V4.1 A41-011 (§5, B18): corrección excepcional con motivo. */
  const corregir = async () => {
    if (!selected || !correccion) return;
    if (motivoCorr.trim().length < 10) { setErrorCorr('Explica el motivo (al menos 10 caracteres): queda en la auditoría.'); return; }
    setCorrigiendo(true);
    try {
      await activityService.correctParticipation(selected, correccion.row.studentProfileId, correccion.status, motivoCorr.trim());
      setParticipants(await activityService.participants(selected));
      await load();
      setCorreccion(null);
      notify('Corrección aplicada.', 'Se ajustaron la constancia, la trayectoria y los puntos.');
    } catch (e) {
      setErrorCorr(apiError(e));
    } finally {
      setCorrigiendo(false);
    }
  };

  /*
   * V3 §53: enlaces directos. «Crear actividad» llega con ?nuevo=1 y
   * «Participantes» con ?actividad=<id>. Se atienden una sola vez, cuando ya
   * hay categorías y actividades cargadas.
   */
  const [params, setParams] = useSearchParams();
  const atendido = useRef(false);
  useEffect(() => {
    if (atendido.current || loading) return;
    const nuevo = params.get('nuevo') === '1';
    const actividad = params.get('actividad');
    if (!nuevo && !actividad) return;
    atendido.current = true;
    if (nuevo) {
      setForm({
        ...emptyForm,
        categoryId: usableCategories[0]?.id ?? '',
        ...(filtroOrigen === 'external' ? { originType: 'external' as const, outcomePolicy: 'external_credential_expected' as OutcomePolicy } : {}),
      });
      setShowForm(true);
    } else if (actividad && activities.some((a) => a.id === actividad)) {
      void openParticipants(actividad);
    }
    const resto = new URLSearchParams(params);
    resto.delete('nuevo');
    resto.delete('actividad');
    setParams(resto, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, activities, categories]);

  if (loading) return <Diferido><SkeletonTable rows={5} columns={6} /></Diferido>;

  const selectedActivity = activities.find((a) => a.id === selected);
  const partNeedle = normalize(partQuery.trim());
  const shownParticipants = partNeedle
    ? participants.filter((r) => normalize(r.studentName ?? '').includes(partNeedle))
    : participants;
  // V3 §15: en una externa el responsable registra la aceptación; la
  // credencial la emite el proveedor y la adjunta el estudiante al terminar.
  const esExterna = activities.find((a) => a.id === selected)?.originType === 'external';
  /*
   * V5 §6: solicitar, ser admitido y asistir son tres cosas. Una interna
   * abierta y sin cupo admite sola, y sus solicitudes anteriores cuentan como
   * admitidas. La asistencia se registra cuando el evento ya empezó.
   */
  const autoAdmite = !esExterna && (selectedActivity?.registrationMode ?? 'open') === 'open' && !selectedActivity?.capacity;
  const empezo = !!selectedActivity?.eventDate && new Date(selectedActivity.eventDate).getTime() - 2 * 60_000 <= Date.now();
  const pending = shownParticipants.filter((r) => r.status === 'registered' && !autoAdmite);
  const interested = shownParticipants.filter((r) => r.status === 'interested');
  const admitted = shownParticipants.filter((r) => r.status === 'accepted' || (r.status === 'registered' && autoAdmite));
  const confirmed = shownParticipants.filter((r) => r.status === 'confirmed' || (esExterna && r.status === 'accepted'));
  const absent = shownParticipants.filter((r) => r.status === 'absent');
  const rejected = shownParticipants.filter((r) => r.status === 'rejected');
  const allConfirmed = participants.filter((r) => r.status === 'confirmed' || r.status === 'accepted');
  const okStatus: 'confirmed' | 'accepted' = esExterna ? 'accepted' : 'confirmed';
  const okLabel = esExterna ? 'Registrar aceptación' : 'Presente';
  const full = !!(selectedActivity?.capacity && allConfirmed.length >= selectedActivity.capacity);
  // V4.1 A41-011: acta cerrada y participación consolidada (la actividad ya terminó).
  const actaCerrada = selectedActivity?.attendanceStatus === 'locked';
  const consolidada = selectedActivity?.status === 'finished' || actaCerrada;
  const tipo = activityType === 'academica' ? 'académica' : 'extracurricular';


  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {!showForm && puedeCrear && (
        <Button
          onClick={() => {
            setForm({
              ...emptyForm,
              categoryId: usableCategories[0]?.id ?? '',
              ...(filtroOrigen === 'external' ? { originType: 'external' as const, outcomePolicy: 'external_credential_expected' as OutcomePolicy } : {}),
            });
            setShowForm(true);
          }}
          icon={<FiPlus size={15} />}
        >
          {filtroOrigen === 'external' ? 'Nueva oportunidad externa' : `Nueva actividad ${tipo}`}
        </Button>
      )}

      <AnimatePresence initial={false}>
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          style={{ overflow: 'hidden' }}
        >
        <Card
          title={editing ? `Editar “${editing.title}”` : `Nueva actividad ${tipo}`}
          actions={
            <Button variant="ghost" size="sm" onClick={resetForm} icon={<FiX size={14} />}>
              Cancelar
            </Button>
          }
        >
          <form noValidate onSubmit={(e) => { e.preventDefault(); void guardar(editing && editing.status !== 'draft' ? 'save' : 'draft'); }}>
            <FormAlert message={errores.general} />
            {/* V5 §5.1 (V5-10): el origen lo da la pestaña; no hay selector que mezcle formularios. */}
            <p className="muted small" style={{ marginTop: 0 }}>
              {form.originType === 'external'
                ? 'Oportunidad externa: la ofrece un proveedor; su resultado es la credencial que el estudiante acreditará.'
                : `Actividad interna ${tipo}: la organiza la carrera.`}
            </p>
            <div className="row">
              <div className={`field ${errores.errors.title ? 'has-error' : ''}`} data-campo="title">
                <label htmlFor="activity-manager-titulo">Título *</label>
                <input id="activity-manager-titulo"
                  value={form.title}
                  onChange={(e) => { setForm({ ...form, title: e.target.value }); errores.clear('title'); }}
                  placeholder={
                    activityType === 'academica'
                      ? 'Taller de arquitectura de software'
                      : 'Hackathon interna de innovación'
                  }
                  maxLength={160}
                  aria-invalid={!!errores.errors.title}
                />
                <FieldError message={errores.errors.title} />
              </div>
              <div className={`field ${errores.errors.categoryId ? 'has-error' : ''}`} data-campo="categoryId">
                <label htmlFor="activity-manager-categoria">Categoría *</label>
                <select id="activity-manager-categoria"
                  value={form.categoryId}
                  onChange={(e) => { setForm({ ...form, categoryId: e.target.value }); errores.clear('categoryId'); }}
                >
                  <option value="">Seleccione una categoría…</option>
                  {usableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <FieldError message={errores.errors.categoryId} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="activity-manager-descripcion">Descripción</label>
              <textarea id="activity-manager-descripcion"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Objetivo de la actividad, a quién está dirigida y qué se espera del participante."
                maxLength={2000}
              />
            </div>

            {/* V3.2 §18, §38: inicio y fin, en la hora de la carrera. */}
            <div className="row">
              <div className={`field ${errores.errors.activityDate ? 'has-error' : ''}`} data-campo="activityDate">
                <label htmlFor="activity-manager-inicio">Inicio</label>
                <input id="activity-manager-inicio"
                  type="datetime-local"
                  value={form.activityDate}
                  onChange={(e) => { setForm({ ...form, activityDate: e.target.value }); errores.clear('activityDate'); }}
                />
                <FieldError message={errores.errors.activityDate} />
              </div>
              <div className={`field ${errores.errors.endAt ? 'has-error' : ''}`} data-campo="endAt">
                <label htmlFor="activity-manager-fin">Fin</label>
                <input id="activity-manager-fin"
                  type="datetime-local"
                  value={form.endAt}
                  min={form.activityDate || undefined}
                  onChange={(e) => { setForm({ ...form, endAt: e.target.value }); errores.clear('endAt'); }}
                />
                <FieldError message={errores.errors.endAt} />
              </div>
              <div className="field">
                <label htmlFor="activity-manager-modalidad">Modalidad</label>
                <select id="activity-manager-modalidad"
                  value={form.modality}
                  onChange={(e) => setForm({ ...form, modality: e.target.value })}
                >
                  {ACTIVITY_MODALITIES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="muted small" style={{ margin: '-0.3rem 0 0.6rem' }}>
              Hora de Bolivia. Al empezar se cierran las inscripciones; al terminar queda finalizada.
            </p>

            {/* V3.2 §18.1: presencial pide aula; virtual, enlace; híbrida, ambos. */}
            {(presencial || virtual) && (
              <div className="row">
                {presencial && (
                  <div className={`field ${errores.errors.location ? 'has-error' : ''}`} data-campo="location">
                    <label htmlFor="activity-manager-ubicacion">Aula o lugar</label>
                    <input id="activity-manager-ubicacion"
                      value={form.location}
                      onChange={(e) => { setForm({ ...form, location: e.target.value }); errores.clear('location'); }}
                      placeholder="Aula 301, Bloque B"
                      maxLength={200}
                    />
                    <FieldError message={errores.errors.location} />
                  </div>
                )}
                {virtual && (
                  <div className={`field ${errores.errors.meetingUrl ? 'has-error' : ''}`} data-campo="meetingUrl">
                    <label htmlFor="activity-manager-reunion">Enlace de la reunión</label>
                    <input id="activity-manager-reunion"
                      type="url"
                      value={form.meetingUrl}
                      onChange={(e) => { setForm({ ...form, meetingUrl: e.target.value }); errores.clear('meetingUrl'); }}
                      placeholder="https://meet.google.com/…"
                      maxLength={500}
                    />
                    <FieldError message={errores.errors.meetingUrl} />
                  </div>
                )}
              </div>
            )}

            <div data-campo="areaIds">
              <AreaSkillPicker
                areas={areas}
                skills={skills}
                value={{ areaIds: form.areaIds, skillIds: form.skillIds, contexts: form.skillContexts }}
                onChange={(v) => {
                  setForm({ ...form, areaIds: v.areaIds, skillIds: v.skillIds, skillContexts: v.contexts ?? {} });
                  errores.clear('areaIds');
                  errores.clear('skillIds');
                }}
                areaLabel="Áreas que trabaja"
                skillLabel="Habilidades que trabaja"
                maxAreas={6}
                areaError={errores.errors.areaIds}
                skillError={errores.errors.skillIds ?? errores.errors.skillContexts}
              />
            </div>

            {externa && (
              <div className={`field ${errores.errors.externalUrl ? 'has-error' : ''}`} data-campo="externalUrl">
                <label htmlFor="activity-manager-enlace-oficial">Enlace oficial de la oportunidad</label>
                <input id="activity-manager-enlace-oficial"
                  type="url"
                  value={form.externalUrl}
                  onChange={(e) => { setForm({ ...form, externalUrl: e.target.value }); errores.clear('externalUrl'); }}
                  placeholder="https://www.netacad.com/…"
                  maxLength={500}
                />
                <FieldError message={errores.errors.externalUrl} />
              </div>
            )}

            {(form.originType === 'external' || form.outcomePolicy === 'external_credential_expected') && (
              <div className="external-box">
                <div className="row">
                  <div className="field">
                    <label htmlFor="op-proveedor">Proveedor</label>
                    <input
                      id="op-proveedor"
                      value={form.provider}
                      onChange={(e) => setForm({ ...form, provider: e.target.value })}
                      placeholder="Cisco Networking Academy, IBM SkillsBuild, Coursera…"
                      maxLength={160}
                      aria-invalid={!!errores.errors.provider}
                    />
                    <FieldError message={errores.errors.provider} />
                  </div>
                </div>
                <div className="row">
                  <div className="field">
                    <label htmlFor="op-dominios">Dominios oficiales del emisor (separados por coma)</label>
                    <input
                      id="op-dominios"
                      value={form.expectedIssuerDomains}
                      onChange={(e) => setForm({ ...form, expectedIssuerDomains: e.target.value })}
                      placeholder="netacad.com, credly.com"
                    />
                    <span className="field-hint">Sirven para comprobar después la credencial que adjunte el estudiante.</span>
                  </div>
                  <div className="field">
                    <label htmlFor="op-claves">Palabras clave esperadas (separadas por coma)</label>
                    <input
                      id="op-claves"
                      value={form.expectedKeywords}
                      onChange={(e) => setForm({ ...form, expectedKeywords: e.target.value })}
                      placeholder="Introduction to Networks, CCNA"
                    />
                  </div>
                </div>
                <p className="muted small" style={{ margin: '0.4rem 0' }}>
                  Referencia de validación (opcional): ayuda a leer y comparar la credencial que adjunte el
                  estudiante. Parecerse al ejemplo no prueba que una credencial sea auténtica.
                </p>
                <div className="row">
                  <div className="field">
                    <label htmlFor="op-curso">Nombre esperado del curso</label>
                    <input
                      id="op-curso"
                      value={form.expectedCourseName}
                      onChange={(e) => setForm({ ...form, expectedCourseName: e.target.value })}
                      placeholder="CCNA: Introduction to Networks"
                      maxLength={200}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="op-patron">Patrón del código de credencial</label>
                    <input
                      id="op-patron"
                      value={form.credentialIdPattern}
                      onChange={(e) => setForm({ ...form, credentialIdPattern: e.target.value })}
                      placeholder="NA-####-@@*"
                      maxLength={80}
                    />
                    <span className="field-hint"># = dígito · @ = letra · * = varios caracteres; el resto se copia tal cual.</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="op-ejemplo">Certificado de ejemplo (PDF o imagen)</label>
                  <input
                    id="op-ejemplo"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const subido = await uploadService.upload(f);
                        setForm((x) => ({ ...x, sampleStoredFileId: subido.id, sampleFileName: subido.originalFilename ?? f.name }));
                      } catch (err) {
                        toast.error(apiError(err));
                      }
                    }}
                  />
                  {form.sampleStoredFileId && (
                    <span className="field-hint">
                      Adjunto: {form.sampleFileName || 'certificado de ejemplo'} ·{' '}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setForm({ ...form, sampleStoredFileId: '', sampleFileName: '' })}
                      >
                        quitar
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* V3.2 §16–§17: responsables y contactos no son lo mismo. */}
            <div className="row">
              <div data-campo="responsibleUserIds" style={{ flex: 1, minWidth: 0 }}>
                {esDocente ? (
                  <div className="field">
                    <span className="field-label">Responsable</span>
                    <p className="muted small" style={{ margin: 0 }}>
                      Tú. Para sumar a alguien a quien los estudiantes puedan escribir, agrégalo como contacto.
                    </p>
                  </div>
                ) : (
                  <PersonPicker
                    kind="responsible"
                    activityType={activityType}
                    value={form.responsables}
                    onChange={(v) => { setForm({ ...form, responsables: v }); errores.clear('responsibleUserIds'); }}
                    label={esAdmin ? 'Responsables *' : 'Responsables'}
                    hint={esAdmin
                      ? 'Administración puede publicarla, pero no es su emisor académico: el responsable confirma la asistencia.'
                      : 'Gestionan la actividad y confirman la participación. Si no eliges, eres tú.'}
                    error={errores.errors.responsibleUserIds ?? errores.errors.responsibleUserId}
                  />
                )}
              </div>
              <div data-campo="contactUserIds" style={{ flex: 1, minWidth: 0 }}>
                <PersonPicker
                  kind="contact"
                  activityType={activityType}
                  value={form.contactos}
                  onChange={(v) => { setForm({ ...form, contactos: v }); errores.clear('contactUserIds'); }}
                  label="Contactos"
                  hint={esDocente
                    ? 'A quién puede escribir el estudiante. Puede ser un estudiante de tus semestres: no gestiona nada.'
                    : 'A quién puede escribir el estudiante.'}
                  error={errores.errors.contactUserIds}
                />
              </div>
            </div>

            {/* V3.2 §18.2: enlaces de apoyo, 0..N. */}
            <div className={`field ${errores.errors.resourceLinks ? 'has-error' : ''}`} data-campo="resourceLinks">
              <span className="field-label">Enlaces de apoyo</span>
              <div className="links-editor">
                {form.resourceLinks.map((l, k) => (
                  <div key={k} className="link-row">
                    <input
                      aria-label={`Nombre del enlace ${k + 1}`}
                      value={l.label}
                      onChange={(e) => setForm({ ...form, resourceLinks: form.resourceLinks.map((x, n) => (n === k ? { ...x, label: e.target.value } : x)) })}
                      placeholder="Guía, material, sitio del evento…"
                      maxLength={80}
                    />
                    <input
                      aria-label={`URL del enlace ${k + 1}`}
                      type="url"
                      value={l.url}
                      onChange={(e) => setForm({ ...form, resourceLinks: form.resourceLinks.map((x, n) => (n === k ? { ...x, url: e.target.value } : x)) })}
                      placeholder="https://…"
                      maxLength={500}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<FiTrash2 size={14} />}
                      aria-label={`Quitar el enlace ${k + 1}`}
                      onClick={() => setForm({ ...form, resourceLinks: form.resourceLinks.filter((_, n) => n !== k) })}
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
              {form.resourceLinks.length < 10 && (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<FiLink size={14} />}
                    onClick={() => setForm({ ...form, resourceLinks: [...form.resourceLinks, { label: '', url: '' }] })}
                  >
                    Agregar enlace
                  </Button>
                </div>
              )}
              <FieldError message={errores.errors.resourceLinks} />
            </div>

            {/* V4.1 A41-006: hasta 5 imágenes opcionales; la primera es la portada. */}
            <div className={`field ${errores.errors.imageFileIds ? 'has-error' : ''}`} data-campo="imageFileIds">
              <label htmlFor="activity-manager-imagen">
                Imágenes (opcional, hasta {MAX_IMAGENES}) <span className="muted small">· {form.imagenes.length}/{MAX_IMAGENES}</span>
              </label>
              {form.imagenes.length > 0 && (
                <ul className="activity-images-edit" aria-label="Imágenes de la actividad">
                  {form.imagenes.map((img, i) => (
                    <li key={img.fileId}>
                      <ImagenProtegida src={img.url} className="activity-image-thumb" />
                      {i === 0 ? <Badge tone="green">Portada</Badge> : (
                        <button type="button" className="link-button" onClick={() => hacerPortada(img.fileId)}>Usar como portada</button>
                      )}
                      <button type="button" className="link-button" onClick={() => quitarImagen(img.fileId)} aria-label={`Quitar la imagen ${i + 1}`}>
                        <FiImage size={12} /> Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {form.imagenes.length < MAX_IMAGENES && (
                <input
                  id="activity-manager-imagen"
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const archivos = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (archivos.length) void subirImagenes(archivos);
                  }}
                  disabled={subiendoImagen}
                />
              )}
              <p className="field-hint">PNG, JPG o WEBP. La portada se ve en la tarjeta; todas, en el detalle.</p>
              <FieldError message={errores.errors.imageFileIds} />
            </div>

            <div className="row">
              <div className={`field ${errores.errors.capacity ? 'has-error' : ''}`} data-campo="capacity">
                <label htmlFor="activity-manager-cupo">Cupo</label>
                <input id="activity-manager-cupo"
                  type="number"
                  min={1}
                  max={1000}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="Sin límite"
                />
                <FieldError message={errores.errors.capacity} />
              </div>
              {!externa && (
                <div className="field">
                  <label htmlFor="activity-manager-admision">Admisión</label>
                  <select id="activity-manager-admision" value={form.registrationMode}
                    onChange={(e) => setForm({ ...form, registrationMode: e.target.value as 'open' | 'approval' })}>
                    <option value="open">Abierta</option>
                    <option value="approval">Cada solicitud la admite el responsable</option>
                  </select>
                  <span className="field-hint">
                    {form.registrationMode === 'open' && !form.capacity
                      ? 'Sin cupo, quien se inscribe queda admitido. La asistencia se registra el día del evento.'
                      : 'Las solicitudes quedan pendientes hasta que las admitas; así el cupo nunca se supera.'}
                  </span>
                </div>
              )}
              <div className="field">
                <label htmlFor="activity-manager-puntos-por-participar-opcional">Criterio de puntos (opcional)</label>
                <select id="activity-manager-puntos-por-participar-opcional"
                  value={form.criterionId}
                  onChange={(e) => setForm({ ...form, criterionId: e.target.value })}
                >
                  <option value="">El criterio general de participación</option>
                  {criterios.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.points} puntos</option>
                  ))}
                </select>
                <span className="muted small">Los puntos los fija el criterio que configuran Dirección o Administración.</span>
                <FieldError message={errores.errors.gamificationRules} />
              </div>
            </div>

            {activityType === 'academica' && (
              <div className="field">
                <span className="field-label" id="activity-manager-semestres-a-los-que">Semestres a los que va dirigida</span>
                <div role="group" aria-labelledby="activity-manager-semestres-a-los-que" className="chip-row">
                  {semestresPermitidos.map((n) => {
                    const on = form.semesterScope.includes(n);
                    // V5-08: un semestre que no cubre ningún docente responsable se marca y se explica.
                    const fuera = !!cobertura && !cobertura.includes(n);
                    return (
                      <button
                        type="button"
                        key={n}
                        className={`chip ${on ? 'on' : ''} ${fuera ? 'chip-fuera' : ''}`}
                        aria-pressed={on}
                        title={fuera ? 'Ningún docente responsable cubre este semestre' : undefined}
                        onClick={() =>
                          setForm({
                            ...form,
                            semesterScope: on ? form.semesterScope.filter((x) => x !== n) : [...form.semesterScope, n].sort((a, b) => a - b),
                          })}
                      >
                        {n}º
                      </button>
                    );
                  })}
                </div>
                <small className="muted">
                  {user?.role === 'TEACHER'
                    ? 'Solo aparecen tus semestres habilitados. Sin marcar ninguno, va a todos ellos.'
                    : 'Sin marcar ninguno, va a toda la carrera.'}
                </small>
                {cobertura && (
                  <p className="field-hint" data-testid="cobertura">
                    Los docentes responsables cubren: {cobertura.length ? cobertura.map((n) => `${n}.º`).join(', ') : 'ningún semestre'}.
                    {' '}Para publicar, elige solo esos semestres o suma un responsable que cubra toda la carrera.
                    {/* V5-08: qué cubre cada uno; la unión no amplía el alcance de nadie. */}
                    <span className="block small">
                      {form.responsables.map((p) => `${p.firstName} ${p.lastName}: ${(p.semesters ?? []).length ? (p.semesters ?? []).map((n) => `${n}.º`).join(', ') : 'sin semestres'}`).join(' · ')}.
                      {' '}Cada docente gestiona solo a los estudiantes de sus semestres.
                    </span>
                  </p>
                )}
                <FieldError message={errores.errors.semesterScope} />
              </div>
            )}

            {/* V3.2 §28–§29: solo una interna elige su resultado. */}
            {externa ? (
              <p className="muted small">
                <strong>Resultado:</strong> la credencial del proveedor. Al terminar, el estudiante aceptado la
                acredita con su evidencia y se valida contra la referencia de arriba.
              </p>
            ) : (
              <div className="field" data-campo="outcomePolicy">
                <label htmlFor="op-resultado">Al terminar genera</label>
                <select
                  id="op-resultado"
                  value={form.outcomePolicy}
                  onChange={(e) => setForm({ ...form, outcomePolicy: e.target.value as OutcomePolicy })}
                >
                  {/* V4.1 A41-013 (§4.1): «Credencial externa esperada» es el flujo de una oportunidad
                      externa; y V5 §7: «Constancia interna» ya no se emite. Las dos solo se muestran
                      si una actividad antigua ya las tiene. */}
                  {RESULTADOS
                    .filter((o) => (o.value !== 'external_credential_expected' && o.value !== 'internal_constancy') || form.outcomePolicy === o.value)
                    .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="field-hint">
                  {RESULTADOS.find((o) => o.value === form.outcomePolicy)?.hint}
                  {' '}El estudiante nunca sube evidencia de asistencia: la confirma el responsable.
                </span>
                <FieldError message={errores.errors.outcomePolicy} />
                {form.outcomePolicy === 'institution_issued_certificate' && (
                  <div className={`field ${errores.errors.certificateIssuer ? 'has-error' : ''}`} data-campo="certificateIssuer" style={{ marginTop: '0.5rem' }}>
                    <label htmlFor="activity-manager-emisor">Emisor del certificado *</label>
                    <input
                      id="activity-manager-emisor"
                      value={form.certificateIssuer}
                      onChange={(e) => { setForm({ ...form, certificateIssuer: e.target.value }); errores.clear('certificateIssuer'); }}
                      placeholder="Universidad del Valle — Facultad de Informática"
                      maxLength={200}
                    />
                    <FieldError message={errores.errors.certificateIssuer} />
                  </div>
                )}
              </div>
            )}

            <p className="muted" style={{ fontSize: '0.78rem', marginBottom: '0.7rem' }}>
              {necesitaRevision
                ? 'El borrador es privado: solo tú lo ves. Para publicarla, envíala a revisión: Dirección la aprueba, la observa o la rechaza.'
                : 'El borrador no es visible para los estudiantes. «Publicar» la hace visible y abre las inscripciones.'}
            </p>

            {/* V3.2 §22: acciones explícitas; guardar nunca publica por accidente. */}
            <div className="form-actions">
              {(!editing || editing.status === 'draft') ? (
                <>
                  <Button type="button" variant="secondary" loading={saving} icon={<FiSave size={15} />} onClick={() => void guardar('draft')}>
                    Guardar borrador
                  </Button>
                  {necesitaRevision ? (
                    <Button type="button" loading={saving} icon={<FiSend size={15} />} onClick={() => void guardar('review')}>
                      {editing?.reviewStatus === 'observed' ? 'Reenviar a revisión' : 'Enviar a revisión'}
                    </Button>
                  ) : (
                    <Button type="button" loading={saving} icon={<FiCheck size={15} />} onClick={() => void guardar('publish')}>
                      Publicar
                    </Button>
                  )}
                </>
              ) : (
                <Button type="button" loading={saving} icon={<FiSave size={15} />} onClick={() => void guardar('save')}>
                  Guardar cambios
                </Button>
              )}
            </div>
          </form>
        </Card>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="section-title">
        <h2>Actividades que gestiona</h2>
        {activities.length > 0 && (
          <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Buscar por título, lugar, categoría o etiqueta…"
            />
            <select
              className="status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              {ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {lbl(ACTIVITY_STATUS_LABEL, s)}
                </option>
              ))}
            </select>
            <ResultCount shown={visible.length} total={activities.length} noun="actividades" />
          </div>
        )}
      </div>

      {activities.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FiCalendar size={22} />}
            message={`Todavía no ha publicado ninguna actividad ${tipo}. Use el botón “Nueva actividad” para crear la primera.`}
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FiSearch size={22} />}
            message="Ninguna actividad coincide con los filtros aplicados."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('');
                }}
              >
                Quitar filtros
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <ThOrden clave="titulo" orden={ordenGestion} alternar={alternarGestion}>Título</ThOrden>
                  <ThOrden clave="categoria" orden={ordenGestion} alternar={alternarGestion}>Categoría</ThOrden>
                  <ThOrden clave="fecha" orden={ordenGestion} alternar={alternarGestion}>Fecha</ThOrden>
                  <ThOrden clave="estado" orden={ordenGestion} alternar={alternarGestion}>Estado</ThOrden>
                  <ThOrden clave="revision" orden={ordenGestion} alternar={alternarGestion}>Revisión</ThOrden>
                  <ThOrden clave="confirmados" orden={ordenGestion} alternar={alternarGestion}>Confirmados</ThOrden>
                  <ThOrden clave="pendientes" orden={ordenGestion} alternar={alternarGestion}>Pendientes</ThOrden>
                  <th><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {pagGestion.visibles.map((a) => {
                  const pend = (a.registrationCount ?? 0) - (a.confirmedCount ?? 0);
                  return (
                    <tr key={a.id} className={selected === a.id ? 'row-picked' : undefined}>
                      <td>
                        <strong>{a.title}</strong>
                        {a.originType === 'external' && (
                          <div><Badge tone="gray">Externa{a.provider ? ` · ${a.provider}` : ''}</Badge></div>
                        )}
                        {a.location && <div className="muted">{a.location}</div>}
                      </td>
                      <td className="muted">{a.category?.name ?? '—'}</td>
                      <td className="muted">
                        {a.eventDate ? (
                          <>
                            {formatearFechaHora(a.eventDate)}
                            {a.endAt && <div className="small">hasta {formatearFechaHora(a.endAt)}</div>}
                          </>
                        ) : (
                          <span>Sin fecha</span>
                        )}
                        {a.status === 'cancelled' && a.cancellationReason && (
                          <div className="small" style={{ maxWidth: 220 }}>Motivo: {a.cancellationReason}</div>
                        )}
                      </td>
                      <td>
                        {/*
                          §22: solo se ofrecen las transiciones que existen. De
                          una actividad finalizada o cancelada no se sale, así
                          que su estado se muestra y no se edita: enseñar seis
                          opciones para que el servidor rechace cinco no es una
                          interfaz, es una trampa.
                        */}
                        {ACTIVITY_TRANSITIONS[a.status]?.length ? (
                        <select
                          className="status-select"
                          value={a.status}
                          onChange={(e) => changeStatus(a, e.target.value)}
                          aria-label={`Estado de ${a.title}`}
                        >
                          {[a.status, ...ACTIVITY_TRANSITIONS[a.status].filter((s) =>
                            publicable(a) || (s !== 'published' && s !== 'open'))].map((s) => (
                            <option key={s} value={s}>
                              {lbl(ACTIVITY_STATUS_LABEL, s)}
                            </option>
                          ))}
                        </select>
                        ) : (
                          <Badge tone={a.status === 'cancelled' ? 'red' : 'gray'}>
                            {lbl(ACTIVITY_STATUS_LABEL, a.status)}
                          </Badge>
                        )}
                      </td>
                      <td>
                        <Badge tone={revision(a).tone}>{revision(a).label}</Badge>
                        {a.reviewComment && ['observed', 'rejected', null].includes(a.reviewStatus ?? null) && (
                          <div className="muted small" style={{ maxWidth: 240 }}>«{a.reviewComment}»</div>
                        )}
                        {a.requiresReview && a.status === 'draft'
                          && (a.reviewStatus === null || a.reviewStatus === undefined || a.reviewStatus === 'observed') && (
                          <div style={{ marginTop: '0.3rem' }}>
                            <Button size="sm" icon={<FiSend size={13} />} onClick={() => enviarARevision(a)}>
                              {a.reviewStatus === 'observed' ? 'Reenviar' : 'Enviar a revisión'}
                            </Button>
                          </div>
                        )}
                        {a.reviewStatus === 'pending' && necesitaRevision && (
                          <div style={{ marginTop: '0.3rem' }}>
                            <Button size="sm" variant="secondary" icon={<FiX size={13} />} onClick={() => cancelarEnvio(a)}>
                              Cancelar envío
                            </Button>
                          </div>
                        )}
                      </td>
                      <td>
                        {a.confirmedCount ?? 0} / {a.capacity ?? '∞'}
                      </td>
                      <td>
                        {pend > 0 ? (
                          <Badge tone="amber">{pend}</Badge>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex" style={{ gap: '0.35rem' }}>
                          {editable(a) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => startEdit(a)}
                              title="Editar actividad"
                              aria-label={`Editar ${a.title}`}
                            >
                              <FiEdit2 />
                            </button>
                          )}
                          {/* V5-06: solo un borrador propio que nunca se envió; lo publicado se cancela. */}
                          {a.status === 'draft' && !a.submittedAt && (a.creatorId === user?.id || esAdmin) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => void borrarBorrador(a)}
                              title="Borrar borrador"
                              aria-label={`Borrar el borrador ${a.title}`}
                            >
                              <FiTrash2 />
                            </button>
                          )}
                          {/* V4.1 A41-010: repetir una actividad (también una finalizada) es duplicarla. */}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => duplicar(a)}
                            title="Duplicar como borrador nuevo"
                            aria-label={`Duplicar ${a.title}`}
                          >
                            <FiCopy />
                          </button>
                          <button
                            className={`btn btn-sm ${selected === a.id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => openParticipants(a.id)}
                          >
                            <FiUsers /> Participación
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacion {...pagGestion} noun="actividades" />
        </Card>
      )}

      {selectedActivity && (
        <Stagger index={0}>
        <Card
          title={`Participación · ${selectedActivity.title}`}
          actions={
            <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
              {participants.length > 0 && (
                <SearchInput
                  value={partQuery}
                  onChange={setPartQuery}
                  placeholder="Buscar estudiante…"
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(null)}
                icon={<FiX size={14} />}
              >
                Cerrar
              </Button>
            </div>
          }
        >
          <p className="muted">
            {esExterna ? 'Aceptados' : 'Lugares ocupados (admitidos y asistentes)'}: <strong>{allConfirmed.length}</strong> de{' '}
            {selectedActivity.capacity ?? 'cupo ilimitado'}
            {full && ' · el cupo está lleno'}
            {!esExterna && (autoAdmite
              ? ' · admisión automática (abierta y sin cupo)'
              : ' · cada solicitud la admites tú')}
          </p>
          {/* V4.1 A41-011 (§5): terminar el evento no cierra el acta; se regulariza y se cierra a mano. */}
          {!esExterna && actaCerrada && (
            <div className="inline-note" role="status" data-testid="acta-cerrada">
              <FiCheck size={13} /> Asistencia cerrada{selectedActivity.attendanceClosedAt ? ` el ${formatearFechaHora(selectedActivity.attendanceClosedAt)}` : ''}.
              {' '}{esAutoridad ? 'Puedes hacer una corrección excepcional con motivo.' : 'Si hay un error, lo corrige Dirección con un motivo.'}
            </div>
          )}
          {!esExterna && !actaCerrada && selectedActivity.status === 'finished' && !esAdmin && (
            <div className="inline-note" role="status">
              La actividad terminó: puedes registrar la asistencia pendiente y, cuando termines,
              <Button size="sm" variant="secondary" icon={<FiCheck size={13} />} onClick={() => void cerrarAsistencia()} style={{ marginLeft: '0.4rem' }}>
                Cerrar asistencia
              </Button>
            </div>
          )}

          {partLoading ? (
            <SkeletonTable rows={3} columns={3} />
          ) : participants.length === 0 ? (
            <EmptyState
              icon={<FiUsers size={22} />}
              message="Todavía nadie manifestó interés ni se inscribió en esta actividad."
            />
          ) : shownParticipants.length === 0 ? (
            <EmptyState
              icon={<FiSearch size={22} />}
              message={`Ningún participante coincide con “${partQuery}”.`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setPartQuery('')}>
                  Limpiar búsqueda
                </Button>
              }
            />
          ) : (
            <>
              {/* V5 §6: primero se decide la solicitud; asistir es otro paso. */}
              {(pending.length > 0 || !autoAdmite) && (
                <ParticipantGroup
                  title={esExterna ? 'Inscritos: falta registrar si el proveedor los aceptó' : 'Solicitudes pendientes de admisión'}
                  rows={pending}
                  externa={esExterna}
                  empty="No hay solicitudes pendientes."
                  render={(r) => (
                    <div className="flex" style={{ gap: '0.35rem' }}>
                      <Button
                        size="sm"
                        disabled={full || actaCerrada}
                        loading={busyRow === r.id}
                        title={full ? 'El cupo está lleno' : esExterna ? 'El proveedor lo aceptó' : 'Darle un lugar'}
                        onClick={() => decide(selectedActivity.id, r, 'accepted')}
                        icon={<FiCheck size={14} />}
                      >
                        {esExterna ? 'Registrar aceptación' : 'Admitir'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={actaCerrada}
                        loading={busyRow === r.id}
                        onClick={() => { setRechazo(r); setMotivoRechazo(''); setErrorRechazo(null); }}
                        icon={<FiUserX size={14} />}
                      >
                        No admitir
                      </Button>
                    </div>
                  )}
                />
              )}

              {!esExterna && (
                <ParticipantGroup
                  title="Admitidos: falta registrar asistencia"
                  rows={admitted}
                  empty={autoAdmite ? 'Nadie se inscribió todavía. Esta actividad admite sola: es abierta y sin cupo.' : 'Todavía no admitiste a nadie.'}
                  render={(r) => (
                    empezo ? (
                      <div className="flex" style={{ gap: '0.35rem' }}>
                        <Button
                          size="sm"
                          disabled={actaCerrada}
                          loading={busyRow === r.id}
                          title="Asistió"
                          onClick={() => decide(selectedActivity.id, r, 'confirmed')}
                          icon={<FiCheck size={14} />}
                        >
                          Presente
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={actaCerrada}
                          loading={busyRow === r.id}
                          onClick={() => decide(selectedActivity.id, r, 'absent')}
                          icon={<FiUserX size={14} />}
                        >
                          Ausente
                        </Button>
                      </div>
                    ) : (
                      <div className="flex" style={{ gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="muted small">La asistencia se registra cuando empiece.</span>
                        {r.status === 'accepted' && (
                          <Button variant="ghost" size="sm" disabled={actaCerrada} loading={busyRow === r.id}
                            onClick={() => { setRechazo(r); setMotivoRechazo(''); setErrorRechazo(null); }}>
                            Retirar admisión
                          </Button>
                        )}
                      </div>
                    )
                  )}
                />
              )}

              {interested.length > 0 && (
                <ParticipantGroup
                  title="Solo interesados (no pidieron un lugar)"
                  rows={interested}
                  empty=""
                  render={() => <span className="muted small">«Me interesa» no es una inscripción.</span>}
                />
              )}

              <ParticipantGroup
                title={esExterna ? 'Aceptados por el proveedor' : 'Asistieron'}
                rows={confirmed}
                externa={esExterna}
                empty={esExterna ? 'Todavía no registras aceptados.' : 'Todavía no registras asistencia.'}
                render={(r) => (
                  <div className="flex" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
                    {selectedActivity.outcomePolicy === 'institution_issued_certificate' && r.status === 'confirmed' && (
                      <Button size="sm" variant="secondary" icon={<FiAward size={14} />}
                        onClick={() => { setEntrega({ ids: [r.studentProfileId], nombre: r.studentName ?? 'el estudiante' }); setCodigo(''); setArchivoCert(null); }}>
                        Entregar certificado
                      </Button>
                    )}
                    {!consolidada && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busyRow === r.id}
                        onClick={() => decide(selectedActivity.id, r, 'absent')}
                        icon={<FiUserX size={14} />}
                      >
                        Marcar ausente
                      </Button>
                    )}
                    {consolidada && esAutoridad && !esExterna && (
                      <Button variant="ghost" size="sm" icon={<FiEdit2 size={13} />}
                        onClick={() => { setCorreccion({ row: r, status: 'absent' }); setMotivoCorr(''); setErrorCorr(null); }}>
                        Corregir
                      </Button>
                    )}
                    {consolidada && !esAutoridad && <span className="muted small">Consolidada: la corrige Dirección</span>}
                  </div>
                )}
              />
              {selectedActivity.outcomePolicy === 'institution_issued_certificate' && confirmed.some((r) => r.status === 'confirmed') && (
                <div style={{ marginTop: '0.5rem' }}>
                  <Button size="sm" icon={<FiAward size={14} />}
                    onClick={() => {
                      setEntrega({ ids: confirmed.filter((r) => r.status === 'confirmed').map((r) => r.studentProfileId), nombre: 'todos los confirmados' });
                      setCodigo('');
                      setArchivoCert(null);
                    }}>
                    Entregar a todos los confirmados
                  </Button>
                  <span className="muted small" style={{ marginLeft: '0.5rem' }}>
                    Emite: {selectedActivity.certificateIssuer ?? '—'}. Afinia lo registra; no se atribuye la autoría.
                  </span>
                </div>
              )}

              {rejected.length > 0 && (
                <ParticipantGroup
                  title="No admitidos"
                  rows={rejected}
                  externa={esExterna}
                  empty=""
                  render={(r) => (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={full || actaCerrada}
                      loading={busyRow === r.id}
                      onClick={() => decide(selectedActivity.id, r, 'accepted')}
                      icon={<FiCheck size={14} />}
                    >
                      {esExterna ? 'Registrar aceptación' : 'Admitir'}
                    </Button>
                  )}
                />
              )}

              {absent.length > 0 && (
                <ParticipantGroup
                  title="Ausentes"
                  rows={absent}
                  empty=""
                  render={(r) => (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={full || actaCerrada}
                      loading={busyRow === r.id}
                      onClick={() => decide(selectedActivity.id, r, okStatus)}
                      icon={<FiCheck size={14} />}
                    >
                      {okLabel}
                    </Button>
                  )}
                />
              )}
            </>
          )}
        </Card>
        </Stagger>
      )}

      {!selectedActivity && activities.length > 0 && (
        <div className="state">
          <FiCalendar size={24} style={{ opacity: 0.4 }} />
          <p className="muted">
            Seleccione “Participación” en una actividad para registrar la asistencia.
          </p>
        </div>
      )}
      {entrega && (
        <Modal title="Entregar certificado" subtitle={`A ${entrega.nombre}`} onClose={() => setEntrega(null)} width={520}>
          <p className="muted">
            Lo emite <strong>{selectedActivity?.certificateIssuer ?? 'la institución'}</strong>. Afinia lo registra y lo deja en la
            trayectoria del estudiante, que no tiene que volver a subirlo.
          </p>
          <div className="field">
            <label htmlFor="cert-archivo">Archivo del certificado (opcional)</label>
            <input id="cert-archivo" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const subido = await uploadService.upload(f);
                  setArchivoCert({ id: subido.id, nombre: f.name });
                } catch (err) { toast.error(apiError(err)); }
              }} />
            {archivoCert && <span className="field-hint">Adjunto: {archivoCert.nombre}</span>}
          </div>
          <div className="field">
            <label htmlFor="cert-codigo">Código de verificación del emisor (opcional)</label>
            <input id="cert-codigo" value={codigo} maxLength={80} onChange={(e) => setCodigo(e.target.value)} placeholder="UV-2026-0042" />
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setEntrega(null)}>Cancelar</Button>
            <Button loading={entregando} icon={<FiAward size={14} />} onClick={() => void entregarCertificado()}>Entregar</Button>
          </div>
        </Modal>
      )}
      {rechazo && selectedActivity && (
        <Modal title={rechazo.status === 'accepted' ? 'Retirar la admisión' : 'No admitir la solicitud'} subtitle={rechazo.studentName ?? 'Solicitud'} onClose={() => setRechazo(null)} width={520}>
          <p className="muted">
            No es una ausencia: la solicitud queda como «No admitida» y el estudiante verá tu motivo.
            {rechazo.status === 'accepted' && ' Su lugar queda libre.'}
          </p>
          <div className={`field ${errorRechazo ? 'has-error' : ''}`}>
            <label htmlFor="rechazo-motivo">Motivo</label>
            <textarea id="rechazo-motivo" value={motivoRechazo} maxLength={300}
              onChange={(e) => { setMotivoRechazo(e.target.value); setErrorRechazo(null); }}
              placeholder="Por ejemplo: el taller es solo para 5.º semestre." />
            <FieldError message={errorRechazo} />
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setRechazo(null)}>Volver</Button>
            <Button variant="danger" loading={busyRow === rechazo.id} onClick={() => void noAdmitir()}>No admitir</Button>
          </div>
        </Modal>
      )}
      {correccion && selectedActivity && (
        <Modal title="Corrección excepcional" subtitle={correccion.row.studentName ?? 'Participación'} onClose={() => setCorreccion(null)} width={520}>
          <p className="muted">
            Cambia una participación ya consolidada. Se ajustan la constancia, la trayectoria, la afinidad y los puntos;
            nada se borra: queda en la auditoría con tu motivo, y el estudiante lo verá.
          </p>
          <div className="field">
            <label htmlFor="corr-estado">Dejarla como</label>
            <select id="corr-estado" value={correccion.status}
              onChange={(e) => setCorreccion({ ...correccion, status: e.target.value as 'confirmed' | 'absent' })}>
              <option value="absent">Ausente</option>
              <option value="confirmed">Confirmada</option>
            </select>
          </div>
          <div className={`field ${errorCorr ? 'has-error' : ''}`}>
            <label htmlFor="corr-motivo">Motivo</label>
            <textarea id="corr-motivo" value={motivoCorr} maxLength={400}
              onChange={(e) => { setMotivoCorr(e.target.value); setErrorCorr(null); }}
              placeholder="Por ejemplo: la lista firmada muestra que no asistió." />
            <FieldError message={errorCorr} />
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setCorreccion(null)}>Volver</Button>
            <Button loading={corrigiendo} onClick={() => void corregir()}>Aplicar corrección</Button>
          </div>
        </Modal>
      )}
      {cancelando && (
        <Modal title="Cancelar la actividad" subtitle={cancelando.title} onClose={() => setCancelando(null)} width={520}>
          <p className="muted">
            Dejará de estar disponible
            {(cancelando.registrationCount ?? 0) > 0 ? ` y ya tiene ${cancelando.registrationCount} inscripción(es).` : '.'}
            {' '}Los estudiantes verán el motivo.
          </p>
          <div className={`field ${motivoError ? 'has-error' : ''}`}>
            <label htmlFor="activity-manager-motivo">Motivo de la cancelación</label>
            <textarea
              id="activity-manager-motivo"
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setMotivoError(null); }}
              maxLength={500}
              placeholder="Por ejemplo: el expositor no puede asistir; se reprogramará."
            />
            <FieldError message={motivoError} />
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setCancelando(null)}>Dejar como está</Button>
            <Button variant="danger" onClick={() => void confirmarCancelacion()}>Cancelar actividad</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ParticipantGroup({
  title,
  rows,
  empty,
  render,
  externa,
}: {
  title: string;
  rows: Participant[];
  empty: string;
  render: (r: Participant) => React.ReactNode;
  /** En una externa, admitir es «aceptado por el proveedor». */
  externa?: boolean;
}) {
  // V3.2 §64 (C17): 10 por página, con contador, y apilada en el teléfono.
  const pag = usePaginacion(rows, FILAS_POR_PAGINA, [rows.length]);
  if (rows.length === 0 && !empty) return null;
  return (
    <div className="mt">
      <h3>{title} <span className="muted small">({rows.length})</span></h3>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <>
        <div className="table-scroll">
          <table className="tabla-apilable">
            <tbody>
              {pag.visibles.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.studentName ?? 'Estudiante'}</strong>
                    <div className="muted">
                      {r.semester ? `${r.semester}º semestre` : 'Semestre no declarado'}
                    </div>
                    {r.status === 'rejected' && r.decisionReason && (
                      <div className="muted small">Motivo: {r.decisionReason}</div>
                    )}
                  </td>
                  <td style={{ width: 130 }}>
                    <Badge tone={(REGISTRATION_BADGE[r.status] ?? 'badge-gray').replace('badge-', '')}>
                      {registrationLabel(r.status, externa)}
                    </Badge>
                  </td>
                  <td style={{ width: 300 }}>{render(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacion {...pag} noun="participantes" />
        </>
      )}
    </div>
  );
}
