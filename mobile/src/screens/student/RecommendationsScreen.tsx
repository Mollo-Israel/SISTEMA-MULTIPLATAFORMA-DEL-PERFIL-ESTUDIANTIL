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
import { Screen, Card, H1, Muted, Button, Loading, ErrorText, Badge } from '../../components/ui';
import { colors } from '../../theme';

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
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, RecommendationDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const [history, setHistory] = useState<RecommendationItem[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const main = useAsync<RecommendationsResponse>(() => recommendationService.mine(), []);
  const reloadMain = main.reload;

  const loadHistory = useCallback(async (status: 'saved' | 'dismissed') => {
    setLoadingHistory(true);
    setErr(null);
    try {
      setHistory(await recommendationService.history(status));
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const changeTab = (next: Tab) => {
    setTab(next);
    setOpen(null);
    setErr(null);
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
    setErr(null);
    try {
      const detail = await recommendationService.detail(id);
      setDetails((prev) => ({ ...prev, [id]: detail }));
    } catch (e) {
      setErr(apiError(e));
      setOpen(null);
    } finally {
      setLoadingDetail(null);
    }
  };

  const decide = async (id: string, status: 'saved' | 'dismissed' | 'viewed') => {
    setBusy(id);
    setErr(null);
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
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const abrirEnlace = (url: string) => {
    Linking.openURL(url).catch(() => setErr('No se pudo abrir el enlace.'));
  };

  const data = main.data;
  const counts = data?.counts;

  const renderItem = (item: RecommendationItem, fromHistory: boolean) => {
    const isOpen = open === item.id;
    const detail = details[item.id];
    const top = item.reasons[0];

    return (
      <Card key={item.id}>
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

        {isOpen && loadingDetail === item.id && <Loading />}

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
                title={busy === item.id ? 'Guardando…' : 'Devolver a mis recomendaciones'}
                onPress={() => decide(item.id, 'viewed')}
                disabled={busy === item.id}
              />
            ) : (
              <View style={styles.actions}>
                <Button
                  title={item.status === 'saved' ? 'Guardada' : 'Guardar'}
                  onPress={() => decide(item.id, 'saved')}
                  disabled={busy === item.id || item.status === 'saved'}
                />
                <Button
                  title="No me interesa"
                  variant="secondary"
                  onPress={() => decide(item.id, 'dismissed')}
                  disabled={busy === item.id}
                />
              </View>
            )}
          </View>
        )}
      </Card>
    );
  };

  return (
    <Screen refreshing={main.loading && !!data} onRefresh={refresh}>
      <H1>Recomendaciones</H1>
      <Muted>
        Sugerencias orientativas según tu perfil y tus afinidades. No son obligatorias: tú
        decides si te sirven.
      </Muted>

      <View style={styles.tabs}>
        {([
          { key: 'foryou', label: 'Para ti' },
          { key: 'saved', label: `Guardadas${counts?.saved ? ` (${counts.saved})` : ''}` },
          { key: 'dismissed', label: `Descartadas${counts?.dismissed ? ` (${counts.dismissed})` : ''}` },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => changeTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabOn]}
          >
            <Text style={tab === t.key ? styles.tabOnText : styles.tabText}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {err && <ErrorText message={err} />}
      {main.error && <ErrorText message={main.error} />}

      {/* ------------------------- Para ti ------------------------- */}
      {tab === 'foryou' && (
        <>
          {main.loading && !data && <Loading />}

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

          {data?.outcome === 'available' &&
            data.groups.map((group) => (
              <View key={group.type}>
                <Text style={styles.group}>
                  {group.label} ({group.items.length})
                </Text>
                {group.items.map((item) => renderItem(item, false))}
              </View>
            ))}
        </>
      )}

      {/* --------------------- Guardadas / Descartadas --------------------- */}
      {tab !== 'foryou' && (
        <>
          {loadingHistory && <Loading />}
          {!loadingHistory && history && history.length === 0 && (
            <Card>
              <Text style={styles.body}>
                {tab === 'saved'
                  ? 'Todavía no guardaste ninguna recomendación.'
                  : 'No descartaste ninguna recomendación.'}
              </Text>
            </Card>
          )}
          {!loadingHistory && history?.map((item) => renderItem(item, true))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 12, flexWrap: 'wrap' },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.gray100,
  },
  tabOn: { backgroundColor: colors.bordo },
  tabText: { color: colors.gray700, fontWeight: '600' },
  tabOnText: { color: colors.white, fontWeight: '600' },

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
