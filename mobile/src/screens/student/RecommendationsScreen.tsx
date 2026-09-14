import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiError } from '../../api/client';
import {
  recommendationService,
  RecommendationDetail,
  RecommendationItem,
  RecommendationsResponse,
} from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  Screen, Card, Muted, Button, Badge, Chip, EmptyState, ErrorText, FadeIn, PageHeader,
  ResultCount, SearchInput, SkeletonCards,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { colors } from '../../theme';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Pantalla "Recomendaciones" (RF18).
 *
 * Es el medio que el documento asigna al requerimiento. Cubre el flujo basico
 * de la Tabla 2.27 y sus dos salidas de fallo, que son distintas entre si:
 * todavia no hay informacion suficiente en el perfil, o el perfil existe pero
 * nada disponible se relaciona con el.
 *
 * Cada recomendacion se puede abrir para ver por que se sugiere, y el
 * estudiante decide: guardarla o descartarla. RN-16 dice que no son
 * obligatorias y que el conserva la decision sobre su utilizacion, asi que lo
 * descartado no vuelve y siempre se puede deshacer.
 */

type Tab = 'foryou' | 'saved' | 'dismissed';

const STATUS_LABEL: Record<string, string> = {
  new: 'Nueva',
  viewed: 'Vista',
  saved: 'Guardada',
  dismissed: 'Descartada',
};

export default function RecommendationsScreen() {
  const [tab, setTab] = useState<Tab>('foryou');
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, RecommendationDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const [history, setHistory] = useState<RecommendationItem[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const main = useAsync<RecommendationsResponse>(() => recommendationService.mine(), []);
  const reloadMain = main.reload;

  const loadHistory = useCallback(async (status: 'saved' | 'dismissed') => {
    setLoadingHistory(true);
    try {
      setHistory(await recommendationService.history(status));
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoadingHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (next: Tab) => {
    setTab(next);
    setOpen(null);
    setHistory(null);
    if (next === 'foryou') reloadMain();
    else loadHistory(next);
  };

  const refresh = () => {
    setDetails({});
    setOpen(null);
    if (tab === 'foryou') reloadMain();
    else loadHistory(tab);
  };

  /** Abrir el detalle la marca como vista: es markAsViewed() del documento. */
  const toggle = async (id: string) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    if (details[id]) return;
    setLoadingDetail(id);
    try {
      const detail = await recommendationService.detail(id);
      setDetails((prev) => ({ ...prev, [id]: detail }));
    } catch (e) {
      toast.error(apiError(e));
      setOpen(null);
    } finally {
      setLoadingDetail(null);
    }
  };

  const DECISION_MESSAGE: Record<string, string> = {
    saved: 'Recomendación guardada.',
    dismissed: 'Recomendación descartada.',
    viewed: 'Recomendación devuelta a «Para ti».',
  };

  const decide = async (id: string, status: 'saved' | 'dismissed' | 'viewed') => {
    setBusy(id);
    try {
      await recommendationService.decide(id, status);
      setDetails((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setOpen(null);
      if (tab === 'foryou') reloadMain();
      else loadHistory(tab);
      toast.success(DECISION_MESSAGE[status]);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  /** Descartar saca la recomendacion de la vista: se confirma antes. */
  const dismiss = async (item: RecommendationItem) => {
    const ok = await confirm({
      title: 'Descartar recomendación',
      message: `Dejaremos de mostrarte “${item.title}” entre tus sugerencias. Podrás recuperarla desde la pestaña «Descartadas».`,
      confirmLabel: 'No me interesa',
    });
    if (ok) decide(item.id, 'dismissed');
  };

  const abrirEnlace = (url: string) => {
    Linking.openURL(url).catch(() => toast.error('No se pudo abrir el enlace.'));
  };

  const data = main.data;
  const counts = data?.counts;

  const needle = normalize(query.trim());
  const matches = (item: RecommendationItem) =>
    !needle
    || [item.title, item.description ?? '', item.area?.name ?? '']
      .some((f) => normalize(f).includes(needle));
  const historyRows = (history ?? []).filter(matches);

  const renderItem = (item: RecommendationItem, fromHistory: boolean, index = 0) => {
    const isOpen = open === item.id;
    const detail = details[item.id];
    const top = item.reasons[0];

    return (
      <FadeIn key={item.id} index={index}>
      <Card>
        <TouchableOpacity onPress={() => toggle(item.id)} activeOpacity={0.7}>
          <View style={styles.row}>
            <Text style={styles.title}>{item.title}</Text>
            {item.status !== 'new' && (
              <Badge color={item.status === 'dismissed' ? colors.gray500 : colors.bordo}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Badge>
            )}
          </View>

          {item.area && <Text style={styles.area}>{item.area.name}</Text>}
          {!!item.description && <Text style={styles.body}>{item.description}</Text>}

          {!item.isCurrent && (
            <Text style={styles.stale}>Ya no está disponible en la plataforma.</Text>
          )}

          {!!top && <Text style={styles.reason}>{top.label}</Text>}
          <Text style={styles.link}>{isOpen ? 'Ocultar detalle' : 'Ver por qué y decidir'}</Text>
        </TouchableOpacity>

        {isOpen && loadingDetail === item.id && <SkeletonCards count={1} />}

        {isOpen && detail && (
          <View style={styles.detail}>
            <Text style={styles.detailTitle}>Por qué te lo recomendamos</Text>
            {detail.reasons.map((r, i) => (
              <View key={`${r.code}-${i}`} style={styles.reasonRow}>
                <Text style={styles.reasonText}>{r.label}</Text>
                <Text style={styles.reasonPoints}>+{r.points}</Text>
              </View>
            ))}

            {detail.type === 'teammate' && (
              <Muted>
                Puedes invitarlo desde tu proyecto, en la sección Integrantes.
              </Muted>
            )}

            {detail.detail?.eventDate && (
              <Text style={styles.meta}>
                Fecha: {new Date(detail.detail.eventDate).toLocaleDateString('es-BO')}
              </Text>
            )}
            {!!detail.detail?.category && (
              <Text style={styles.meta}>Categoría: {detail.detail.category}</Text>
            )}
            {!!detail.detail?.modality && (
              <Text style={styles.meta}>Modalidad: {detail.detail.modality}</Text>
            )}

            {!!item.targetLink && (
              <Button
                title="Abrir enlace"
                variant="secondary"
                onPress={() => abrirEnlace(item.targetLink as string)}
              />
            )}

            {fromHistory || item.status === 'dismissed' ? (
              <Button
                title="Devolver a mis recomendaciones"
                onPress={() => decide(item.id, 'viewed')}
                loading={busy === item.id}
              />
            ) : (
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={item.status === 'saved' ? 'Guardada' : 'Guardar'}
                    onPress={() => decide(item.id, 'saved')}
                    loading={busy === item.id}
                    disabled={item.status === 'saved'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="No me interesa"
                    variant="secondary"
                    onPress={() => dismiss(item)}
                    loading={busy === item.id}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </Card>
      </FadeIn>
    );
  };

  return (
    <Screen refreshing={main.loading && !!data} onRefresh={refresh}>
      <PageHeader
        title="Recomendaciones"
        description="Sugerencias orientativas según tu perfil y tus afinidades. No son obligatorias: tú decides si te sirven."
      />

      <View style={styles.tabs}>
        {([
          { key: 'foryou', label: 'Para ti' },
          { key: 'saved', label: `Guardadas${counts?.saved ? ` (${counts.saved})` : ''}` },
          { key: 'dismissed', label: `Descartadas${counts?.dismissed ? ` (${counts.dismissed})` : ''}` },
        ] as const).map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            on={tab === t.key}
            onPress={() => changeTab(t.key)}
          />
        ))}
      </View>

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar recomendación…"
      />

      {main.error && <ErrorText message={main.error} />}

      {/* ------------------------- Para ti ------------------------- */}
      {tab === 'foryou' && (
        <>
          {main.loading && !data && <SkeletonCards count={3} />}

          {data?.outcome === 'insufficient_profile' && (
            <Card title="Todavía no podemos recomendarte">
              <Text style={styles.body}>{data.message}</Text>
              <View style={styles.hints}>
                <Text style={styles.hint}>· Declara tus áreas de preferencia</Text>
                <Text style={styles.hint}>· Agrega tus intereses y habilidades</Text>
                <Text style={styles.hint}>· Indica en qué áreas quieres mejorar</Text>
                <Text style={styles.hint}>· Participa en una actividad o registra un proyecto</Text>
              </View>
            </Card>
          )}

          {data?.outcome === 'no_matches' && (
            <Card title="Sin recomendaciones por ahora">
              <Text style={styles.body}>{data.message}</Text>
            </Card>
          )}

          {data?.outcome === 'available' && (() => {
            const groups = data.groups
              .map((group) => ({ ...group, items: group.items.filter(matches) }))
              .filter((group) => group.items.length > 0);
            const total = data.groups.reduce((n, g) => n + g.items.length, 0);
            const shown = groups.reduce((n, g) => n + g.items.length, 0);
            if (shown === 0) {
              return (
                <EmptyState
                  icon="⌕"
                  message={`Ninguna recomendación coincide con “${query}”.`}
                  action={
                    <Button
                      title="Limpiar búsqueda"
                      variant="secondary"
                      small
                      onPress={() => setQuery('')}
                    />
                  }
                />
              );
            }
            return (
              <>
                <ResultCount shown={shown} total={total} noun="recomendaciones" />
                {groups.map((group) => (
                  <View key={group.type}>
                    <Text style={styles.group}>
                      {group.label} ({group.items.length})
                    </Text>
                    {group.items.map((item, i) => renderItem(item, false, i))}
                  </View>
                ))}
              </>
            );
          })()}
        </>
      )}

      {/* --------------------- Guardadas / Descartadas --------------------- */}
      {tab !== 'foryou' && (
        <>
          {loadingHistory && <SkeletonCards count={2} />}
          {!loadingHistory && history && history.length === 0 && (
            <EmptyState
              icon="☆"
              message={
                tab === 'saved'
                  ? 'Todavía no guardaste ninguna recomendación.'
                  : 'No descartaste ninguna recomendación.'
              }
            />
          )}
          {!loadingHistory && history && history.length > 0 && (
            <ResultCount
              shown={historyRows.length}
              total={history.length}
              noun="recomendaciones"
            />
          )}
          {!loadingHistory && history && history.length > 0 && historyRows.length === 0 && (
            <EmptyState
              icon="⌕"
              message={`Ninguna recomendación coincide con “${query}”.`}
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
          {!loadingHistory && historyRows.map((item, i) => renderItem(item, true, i))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 12, flexWrap: 'wrap' },

  group: { fontWeight: '700', color: colors.gray900, marginTop: 16, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontWeight: '700', color: colors.gray900, flexShrink: 1 },
  area: { color: colors.gray500, fontSize: 12, marginTop: 2 },
  body: { color: colors.gray700, lineHeight: 20, marginTop: 4 },
  stale: { color: colors.amber, fontSize: 12, marginTop: 4 },
  reason: { color: colors.bordo, fontSize: 12, marginTop: 6 },
  link: { color: colors.bordo, fontWeight: '600', marginTop: 8 },

  detail: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingTop: 8,
    gap: 6,
  },
  detailTitle: { fontWeight: '700', color: colors.gray900 },
  reasonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  reasonText: { color: colors.gray700, flex: 1 },
  reasonPoints: { color: colors.bordo, fontWeight: '700' },
  meta: { color: colors.gray500, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8 },

  hints: { marginTop: 10 },
  hint: { color: colors.gray700, lineHeight: 20 },
});
