import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { activityService, catalogService } from '../../services';
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
  Field,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { Icon } from '../../components/icons';
import { ACTIVITY_STATUS_LABEL, ACTIVITY_TYPE_LABEL, lbl } from '../../constants';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const TYPE_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'academica', label: 'Académicas' },
  { value: 'extracurricular', label: 'Extracurriculares' },
];

const MODALITY_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hibrida', label: 'Híbrida' },
];

export default function ActivitiesScreen({ navigation }: any) {
  // Filtros del RF8: categoría, área, modalidad y fecha. Se aplican en el
  // servidor para que el resultado sea el mismo desde cualquier cliente.
  const [type, setType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [modality, setModality] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [applied, setApplied] = useState(0);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (type) p.type = type;
    if (categoryId) p.categoryId = categoryId;
    if (areaId) p.areaId = areaId;
    if (modality) p.modality = modality;
    if (fromDate) p.fromDate = fromDate;
    if (toDate) p.toDate = toDate;
    return p;
  }, [type, categoryId, areaId, modality, fromDate, toDate, applied]);

  const { data, loading, error, reload } = useAsync(() => activityService.list(params), [params]);
  const [categories, setCategories] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);

  useEffect(() => {
    catalogService.activityCategories().then(setCategories).catch(() => {});
    catalogService.areas().then(setAreas).catch(() => {});
  }, []);

  const hasFilters = !!(type || categoryId || areaId || modality || fromDate || toDate);
  const clearFilters = () => {
    setType('');
    setCategoryId('');
    setAreaId('');
    setModality('');
    setFromDate('');
    setToDate('');
    setApplied((n) => n + 1);
  };
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  // Los filtros del RF8 los aplica el servidor; la busqueda por texto es
  // local, sobre lo que ya vino, para que responda a cada tecla.
  const all = data ?? [];
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return all;
    return all.filter((a: any) =>
      [a.title, a.description ?? '', a.location ?? '', a.category?.name ?? '',
        a.academicArea?.name ?? '']
        .some((f: string) => normalize(f).includes(q)),
    );
  }, [all, query]);

  // Categorías del catálogo que aplican al tipo elegido (RF4).
  const usableCategories = categories.filter(
    (c: any) => c.isActive && (!c.appliesTo || !type || c.appliesTo === type),
  );

  const open = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    setDetail(null);
    setDetailBusy(true);
    try {
      setDetail(await activityService.get(id));
    } catch (e) {
      toast.error(apiError(e, 'No se pudo cargar el detalle.'));
      setExpanded(null);
    } finally {
      setDetailBusy(false);
    }
  };

  const act = async (
    fn: () => Promise<unknown>,
    okMsg: string,
    id: string,
    detailText?: string,
  ) => {
    setBusy(id);
    try {
      await fn();
      toast.success(okMsg, detailText);
      setDetail(await activityService.get(id));
      reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  /** Inscribirse compromete un cupo: se confirma antes de enviarlo. */
  const enrol = async (a: any) => {
    const ok = await confirm({
      title: 'Solicitar inscripción',
      message: `Vas a solicitar un lugar en “${a.title}”. El responsable debe aprobarlo, y tu participación solo cuenta cuando te la confirmen.`,
      confirmLabel: 'Solicitar inscripción',
    });
    if (!ok) return;
    act(
      () => activityService.register(a.id),
      'Inscripción enviada.',
      a.id,
      'Queda pendiente de aprobación del responsable.',
    );
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <PageHeader
        title="Actividades"
        description="Marca interés o inscríbete. Tu participación la confirma el responsable de la actividad y alimenta tu perfil dinámico."
      />

      <Button
        title="Ver mis actividades"
        icon="list"
        variant="secondary"
        onPress={() => navigation.navigate('MisActividades')}
      />

      <View style={{ marginTop: 12 }}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por título, lugar, categoría o área…"
        />
      </View>

      <View style={styles.filterRow}>
        {TYPE_FILTERS.map((f) => (
          <Chip
            key={f.value || 'all'}
            label={f.label}
            on={type === f.value}
            onPress={() => setType(f.value)}
          />
        ))}
      </View>

      {usableCategories.length > 0 && (
        <>
          <Text style={styles.filterLabel}>Categoría</Text>
          <View style={styles.filterRow}>
            <Chip label="Todas" on={categoryId === ''} onPress={() => setCategoryId('')} />
            {usableCategories.map((c: any) => (
              <Chip
                key={c.id}
                label={c.name}
                on={categoryId === c.id}
                onPress={() => setCategoryId(categoryId === c.id ? '' : c.id)}
              />
            ))}
          </View>
        </>
      )}

      {areas.length > 0 && (
        <>
          <Text style={styles.filterLabel}>Área académica</Text>
          <View style={styles.filterRow}>
            <Chip label="Todas" on={areaId === ''} onPress={() => setAreaId('')} />
            {areas.map((a: any) => (
              <Chip
                key={a.id}
                label={a.name}
                on={areaId === a.id}
                onPress={() => setAreaId(areaId === a.id ? '' : a.id)}
              />
            ))}
          </View>
        </>
      )}

      <Text style={styles.filterLabel}>Modalidad</Text>
      <View style={styles.filterRow}>
        {MODALITY_FILTERS.map((m) => (
          <Chip
            key={m.value || 'all'}
            label={m.label}
            on={modality === m.value}
            onPress={() => setModality(m.value)}
          />
        ))}
      </View>

      <Text style={styles.filterLabel}>Fecha (aaaa-mm-dd)</Text>
      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Field label="Desde" value={fromDate} onChangeText={setFromDate} placeholder="2026-09-01" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Hasta" value={toDate} onChangeText={setToDate} placeholder="2026-12-31" />
        </View>
      </View>

      {hasFilters && (
        <Button icon="x" title="Limpiar filtros" variant="secondary" onPress={clearFilters} />
      )}

      {loading && <SkeletonCards count={3} />}
      {error && <ErrorText message={error} />}

      {!loading && !error && all.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <ResultCount shown={filtered.length} total={all.length} noun="actividades" />
        </View>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={query || hasFilters ? 'search' : 'calendar'}
          message={
            query
              ? `Ninguna actividad coincide con “${query}”.`
              : hasFilters
                ? 'Ninguna actividad coincide con los filtros elegidos.'
                : 'Todavía no hay actividades publicadas.'
          }
          action={
            query || hasFilters ? (
              <Button
                title="Quitar filtros"
                icon="x"
                variant="secondary"
                small
                onPress={() => {
                  setQuery('');
                  clearFilters();
                }}
              />
            ) : undefined
          }
        />
      )}

      {filtered.map((a: any, index: number) => {
        const isOpen = expanded === a.id;
        const d = isOpen ? detail : null;
        const blocked = d?.registrationBlockReason ?? a.registrationBlockReason;
        const mine = d?.myRegistration;
        return (
          <FadeIn key={a.id} index={index}>
          <Card>
            <Pressable onPress={() => open(a.id)}>
              <View style={styles.badges}>
                <Badge color={a.type === 'academica' ? colors.bordo : colors.amber}>
                  {lbl(ACTIVITY_TYPE_LABEL, a.type)}
                </Badge>
                <Badge>{a.category?.name ?? '—'}</Badge>
                <Badge color={colors.green}>{lbl(ACTIVITY_STATUS_LABEL, a.status)}</Badge>
              </View>
              <Text style={styles.title}>{a.title}</Text>
              <Muted>
                {a.modality}
                {a.academicArea ? ` · ${a.academicArea.name}` : ''}
                {a.eventDate
                  ? ` · ${new Date(a.eventDate).toLocaleDateString('es-BO', {
                      day: '2-digit',
                      month: 'short',
                    })}`
                  : ''}
              </Muted>
              <View style={styles.toggleRow}>
                <Text style={styles.toggle}>
                  {isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                </Text>
                <Icon
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.bordo}
                />
              </View>
            </Pressable>

            {isOpen && detailBusy && <SkeletonCards count={1} />}

            {isOpen && d && (
              <View style={styles.detail}>
                {d.description ? <Text style={styles.desc}>{d.description}</Text> : null}

                <View style={styles.metaBlock}>
                  {d.eventDate && (
                    <Text style={styles.meta}>
                      Fecha:{' '}
                      {new Date(d.eventDate).toLocaleString('es-BO', {
                        day: '2-digit',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                  {d.location ? <Text style={styles.meta}>Lugar: {d.location}</Text> : null}
                  <Text style={styles.meta}>
                    Confirmados: {d.confirmedCount ?? 0}
                    {d.capacity ? ` de ${d.capacity} (quedan ${d.seatsLeft})` : ' · cupo ilimitado'}
                  </Text>
                  {d.creator && (
                    <Text style={styles.meta}>
                      Responsable: {d.creator.firstName} {d.creator.lastName}
                    </Text>
                  )}
                  {d.tags?.length ? (
                    <Text style={styles.meta}>Etiquetas: {d.tags.join(', ')}</Text>
                  ) : null}
                </View>

                {d.externalUrl ? (
                  <Button
                    title="Abrir enlace externo"
                    icon="external-link"
                    variant="secondary"
                    onPress={() => Linking.openURL(d.externalUrl)}
                  />
                ) : null}

                {mine && (
                  <View style={styles.myState}>
                    <Text style={styles.myStateText}>
                      Tu estado:{' '}
                      {mine.status === 'confirmed'
                        ? 'participación confirmada'
                        : mine.status === 'registered'
                          ? 'inscrito, pendiente de registro por el responsable'
                          : mine.status === 'absent'
                            ? 'registrado como ausente'
                            : 'interesado'}
                    </Text>
                  </View>
                )}

                {blocked ? (
                  <View style={styles.blocked}>
                    <Text style={styles.blockedText}>{blocked}</Text>
                  </View>
                ) : mine?.status === 'confirmed' || mine?.status === 'absent' ? (
                  <Muted>
                    Tu participación ya fue registrada por el responsable y no puede modificarse.
                  </Muted>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Me interesa"
                        icon="heart"
                        variant="secondary"
                        loading={busy === a.id}
                        disabled={mine?.status === 'interested'}
                        onPress={() =>
                          act(
                            () => activityService.registerInterest(a.id),
                            'Interés registrado.',
                            a.id,
                            `“${a.title}” quedó marcada como de tu interés.`,
                          )
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Inscribirme"
                        icon="user-plus"
                        loading={busy === a.id}
                        disabled={mine?.status === 'registered'}
                        onPress={() => enrol(a)}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}
          </Card>
          </FadeIn>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 8 },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray700,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateRow: { flexDirection: 'row', gap: 10 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  title: { fontSize: 15.5, fontWeight: '700', color: colors.gray900, marginBottom: 3 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  toggle: { color: colors.bordo, fontSize: 12.5, fontWeight: '600' },
  detail: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 12 },
  desc: { fontSize: 13.5, color: colors.gray700, marginBottom: 10 },
  metaBlock: { marginBottom: 10, gap: 3 },
  meta: { fontSize: 12.5, color: colors.gray500 },
  myState: {
    backgroundColor: colors.bordoBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  myStateText: { fontSize: 12.5, color: colors.bordo, fontWeight: '600' },
  blocked: {
    backgroundColor: colors.gray100,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  blockedText: { fontSize: 12.5, color: colors.gray700 },
});
