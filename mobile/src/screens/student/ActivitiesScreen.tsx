import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { activityService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  Screen,
  Card,
  H1,
  Muted,
  Button,
  Loading,
  ErrorText,
  EmptyState,
  Success,
  Badge,
  Field,
} from '../../components/ui';
import { ACTIVITY_STATUS_LABEL, ACTIVITY_TYPE_LABEL, lbl } from '../../constants';
import { colors } from '../../theme';

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
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = data ?? [];

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
    setErr(null);
    try {
      setDetail(await activityService.get(id));
    } catch (e) {
      setErr(apiError(e, 'No se pudo cargar el detalle.'));
    } finally {
      setDetailBusy(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, okMsg: string, id: string) => {
    setMsg(null);
    setErr(null);
    try {
      await fn();
      setMsg(okMsg);
      setDetail(await activityService.get(id));
      reload();
    } catch (e) {
      setErr(apiError(e));
    }
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <H1>Actividades</H1>
      <Muted>
        Marca interés o inscríbete. Tu participación la confirma el responsable de la actividad y
        alimenta tu perfil dinámico.
      </Muted>

      <Button
        title="Ver mis actividades"
        variant="secondary"
        onPress={() => navigation.navigate('MisActividades')}
      />

      {msg && <Success message={msg} />}
      {err && <ErrorText message={err} />}

      <View style={styles.filterRow}>
        {TYPE_FILTERS.map((f) => (
          <Pressable
            key={f.value || 'all'}
            onPress={() => setType(f.value)}
            style={[styles.filter, type === f.value && styles.filterOn]}
          >
            <Text style={type === f.value ? styles.filterOnText : styles.filterText}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {usableCategories.length > 0 && (
        <>
          <Text style={styles.filterLabel}>Categoría</Text>
          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setCategoryId('')}
              style={[styles.filter, categoryId === '' && styles.filterOn]}
            >
              <Text style={categoryId === '' ? styles.filterOnText : styles.filterText}>Todas</Text>
            </Pressable>
            {usableCategories.map((c: any) => (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(categoryId === c.id ? '' : c.id)}
                style={[styles.filter, categoryId === c.id && styles.filterOn]}
              >
                <Text style={categoryId === c.id ? styles.filterOnText : styles.filterText}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {areas.length > 0 && (
        <>
          <Text style={styles.filterLabel}>Área académica</Text>
          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setAreaId('')}
              style={[styles.filter, areaId === '' && styles.filterOn]}
            >
              <Text style={areaId === '' ? styles.filterOnText : styles.filterText}>Todas</Text>
            </Pressable>
            {areas.map((a: any) => (
              <Pressable
                key={a.id}
                onPress={() => setAreaId(areaId === a.id ? '' : a.id)}
                style={[styles.filter, areaId === a.id && styles.filterOn]}
              >
                <Text style={areaId === a.id ? styles.filterOnText : styles.filterText}>
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.filterLabel}>Modalidad</Text>
      <View style={styles.filterRow}>
        {MODALITY_FILTERS.map((m) => (
          <Pressable
            key={m.value || 'all'}
            onPress={() => setModality(m.value)}
            style={[styles.filter, modality === m.value && styles.filterOn]}
          >
            <Text style={modality === m.value ? styles.filterOnText : styles.filterText}>
              {m.label}
            </Text>
          </Pressable>
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
        <Button title="Limpiar filtros" variant="secondary" onPress={clearFilters} />
      )}

      {loading && <Loading />}
      {error && <ErrorText message={error} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          message={
            hasFilters
              ? 'Ninguna actividad coincide con los filtros elegidos.'
              : 'Todavía no hay actividades publicadas.'
          }
        />
      )}

      {filtered.map((a: any) => {
        const isOpen = expanded === a.id;
        const d = isOpen ? detail : null;
        const blocked = d?.registrationBlockReason ?? a.registrationBlockReason;
        const mine = d?.myRegistration;
        return (
          <Card key={a.id}>
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
              <Text style={styles.toggle}>{isOpen ? 'Ocultar detalle ▲' : 'Ver detalle ▼'}</Text>
            </Pressable>

            {isOpen && detailBusy && <Loading />}

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
                        variant="secondary"
                        disabled={mine?.status === 'interested'}
                        onPress={() =>
                          act(() => activityService.registerInterest(a.id), 'Interés registrado.', a.id)
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Inscribirme"
                        disabled={mine?.status === 'registered'}
                        onPress={() =>
                          act(() => activityService.register(a.id), 'Inscripción enviada.', a.id)
                        }
                      />
                    </View>
                  </View>
                )}
              </View>
            )}
          </Card>
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
  filter: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  filterOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  filterText: { color: colors.gray700, fontSize: 12.5 },
  filterOnText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  title: { fontSize: 15.5, fontWeight: '700', color: colors.gray900, marginBottom: 3 },
  toggle: { color: colors.bordo, fontSize: 12.5, fontWeight: '600', marginTop: 8 },
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
