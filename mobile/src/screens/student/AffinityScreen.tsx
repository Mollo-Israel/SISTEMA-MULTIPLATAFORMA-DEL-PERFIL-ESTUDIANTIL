import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiError } from '../../api/client';
import {
  affinityService,
  AffinityBreakdown,
  AffinitySnapshot,
  AffinitySummary,
  AffinityWeight,
} from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  Screen,
  Card,
  H1,
  Muted,
  Button,
  Loading,
  ErrorText,
  Badge,
} from '../../components/ui';
import { affinityColor, colors } from '../../theme';

/**
 * Pantalla "Mis afinidades" (RF17).
 *
 * Es el medio que el documento asigna al requerimiento, y cubre sus dos
 * salidas: mostrar las areas con su nivel, o informar de forma explicita que
 * todavia no hay informacion suficiente para orientar.
 *
 * Cada area se puede abrir para ver POR QUE tiene ese puntaje. Esa es la parte
 * que convierte un numero en orientacion: RN-15 dice que la afinidad es
 * complementaria y orientativa, y una orientacion que no se explica no sirve
 * para orientar a nadie.
 */

const LEVEL_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const SIGNAL_LABEL: Record<string, string> = {
  interest: 'Interes declarado',
  skill: 'Habilidad',
  improvement_area: 'Area de mejora',
  activity: 'Actividad',
  project: 'Proyecto',
  evidence: 'Evidencia',
  certificate: 'Certificado externo',
  constancy: 'Constancia interna',
};

const MATCH_LABEL: Record<string, string> = {
  declared: 'declarada por ti',
  tag: 'deducida por tecnologias',
  text: 'deducida por coincidencia de texto',
  inherited: 'heredada de la actividad o proyecto',
};

const formatDate = (value: string | null) => {
  if (!value) return 'sin calcular';
  const d = new Date(value);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
};

export default function AffinityScreen() {
  const [tab, setTab] = useState<'areas' | 'history'>('areas');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openArea, setOpenArea] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Record<string, AffinityBreakdown>>({});
  const [loadingArea, setLoadingArea] = useState<string | null>(null);

  const [showRules, setShowRules] = useState(false);
  const [weights, setWeights] = useState<AffinityWeight[] | null>(null);

  const summaryState = useAsync<AffinitySummary>(() => affinityService.summary(), []);
  const historyState = useAsync<AffinitySnapshot[]>(() => affinityService.history(10), []);

  const summary = summaryState.data;

  // Se depende de las funciones de recarga, que son estables, y no de los
  // objetos de estado, que cambian de identidad en cada render.
  const reloadSummary = summaryState.reload;
  const reloadHistory = historyState.reload;

  const reloadAll = useCallback(() => {
    reloadSummary();
    reloadHistory();
    setBreakdown({});
    setOpenArea(null);
  }, [reloadSummary, reloadHistory]);

  const recalc = async () => {
    setBusy(true);
    setErr(null);
    try {
      await affinityService.recalculateMine();
      reloadAll();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  /** Carga el desglose de un area solo cuando el estudiante la abre. */
  const toggleArea = async (areaId: string) => {
    if (openArea === areaId) {
      setOpenArea(null);
      return;
    }
    setOpenArea(areaId);
    if (breakdown[areaId]) return;
    setLoadingArea(areaId);
    try {
      const data = await affinityService.breakdown(areaId);
      setBreakdown((prev) => ({ ...prev, [areaId]: data }));
    } catch (e) {
      setErr(apiError(e));
      setOpenArea(null);
    } finally {
      setLoadingArea(null);
    }
  };

  const toggleRules = async () => {
    const next = !showRules;
    setShowRules(next);
    if (next && !weights) {
      try {
        setWeights(await affinityService.weights());
      } catch (e) {
        setErr(apiError(e));
      }
    }
  };

  const insufficient = summary?.status === 'insufficient_data';

  return (
    <Screen refreshing={summaryState.loading && !!summary} onRefresh={reloadAll}>
      <H1>Mis afinidades</H1>
      <Muted>
        Orientacion calculada con reglas y puntuacion sobre la informacion de tu perfil.
        No es una nota ni una evaluacion academica.
      </Muted>

      <View style={styles.tabs}>
        {([
          { key: 'areas', label: 'Areas' },
          { key: 'history', label: 'Evolucion' },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabOn]}
          >
            <Text style={tab === t.key ? styles.tabOnText : styles.tabText}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {err && <ErrorText message={err} />}
      {summaryState.error && <ErrorText message={summaryState.error} />}
      {summaryState.loading && !summary && <Loading />}

      {/* ---------------- Areas ---------------- */}
      {tab === 'areas' && summary && (
        <>
          <Button
            title={busy ? 'Recalculando…' : 'Recalcular mis afinidades'}
            onPress={recalc}
            disabled={busy}
          />

          {insufficient ? (
            /* RF17, salida de fallo: no basta con mostrar una lista vacia. */
            <Card title="Todavia no podemos orientarte">
              <Text style={styles.body}>{summary.message}</Text>
              <View style={styles.hintBox}>
                <Text style={styles.hintTitle}>Lo que mas aporta:</Text>
                <Text style={styles.hint}>· Registrar un proyecto en tu portafolio</Text>
                <Text style={styles.hint}>· Adjuntar un certificado externo</Text>
                <Text style={styles.hint}>· Participar en una actividad y que te confirmen</Text>
                <Text style={styles.hint}>· Declarar tus intereses y habilidades</Text>
              </View>
            </Card>
          ) : (
            <>
              <Card>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Areas con afinidad</Text>
                  <Text style={styles.metaValue}>{summary.areas.length}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Senales consideradas</Text>
                  <Text style={styles.metaValue}>{summary.signalsCount}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Ultimo calculo</Text>
                  <Text style={styles.metaValue}>{formatDate(summary.calculatedAt)}</Text>
                </View>
              </Card>

              {summary.areas.map((a) => {
                const open = openArea === a.academicAreaId;
                const detail = breakdown[a.academicAreaId];
                return (
                  <Card key={a.academicAreaId}>
                    <TouchableOpacity
                      onPress={() => toggleArea(a.academicAreaId)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.areaHeader}>
                        <View style={styles.areaTitleBox}>
                          <Text style={styles.rank}>#{a.rank}</Text>
                          <Text style={styles.areaName}>{a.area ?? 'Area'}</Text>
                        </View>
                        <Badge color={affinityColor(a.level)}>
                          {LEVEL_LABEL[a.level] ?? a.level} · {a.score}
                        </Badge>
                      </View>

                      {/* La barra representa el peso relativo, que es como se
                          clasifica el nivel: comparado con tu area mas fuerte. */}
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.max(4, Math.round(a.share * 100))}%`,
                              backgroundColor: affinityColor(a.level),
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.shareText}>
                        {Math.round(a.share * 100)}% respecto a tu area mas fuerte
                        {'   '}
                        <Text style={styles.link}>{open ? 'ocultar detalle' : 'ver por que'}</Text>
                      </Text>
                    </TouchableOpacity>

                    {open && loadingArea === a.academicAreaId && <Loading />}

                    {open && detail && (
                      <View style={styles.breakdown}>
                        {detail.contributions.map((c, i) => (
                          <View key={`${c.sourceId ?? 'x'}-${i}`} style={styles.contribRow}>
                            <View style={styles.contribMain}>
                              <Text style={styles.contribSource}>{c.sourceLabel}</Text>
                              <Text style={styles.contribMeta}>
                                {SIGNAL_LABEL[c.signalType] ?? c.signalType}
                                {' · '}
                                {MATCH_LABEL[c.matchType] ?? c.matchType}
                              </Text>
                            </View>
                            <Text style={styles.contribPoints}>+{c.points}</Text>
                          </View>
                        ))}
                        <View style={styles.totalRow}>
                          <Text style={styles.totalLabel}>Total del area</Text>
                          <Text style={styles.totalValue}>{detail.score}</Text>
                        </View>
                      </View>
                    )}
                  </Card>
                );
              })}
            </>
          )}

          {/* RN-14: las ponderaciones son parte del requerimiento, no un
              detalle interno. Mostrarlas hace verificable el calculo. */}
          <Card>
            <TouchableOpacity onPress={toggleRules} activeOpacity={0.7}>
              <Text style={styles.link}>
                {showRules ? 'Ocultar como se calcula' : 'Como se calcula mi afinidad'}
              </Text>
            </TouchableOpacity>
            {showRules && weights && (
              <View style={styles.rules}>
                {weights.map((w) => (
                  <View key={w.code} style={styles.contribRow}>
                    <View style={styles.contribMain}>
                      <Text style={styles.contribSource}>{w.label}</Text>
                      <Text style={styles.contribMeta}>{w.description}</Text>
                    </View>
                    <Text style={styles.contribPoints}>{w.points}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      )}

      {/* ---------------- Evolucion ---------------- */}
      {tab === 'history' && (
        <>
          <Muted>
            Como fue cambiando tu orientacion. Es historial de lo ya ocurrido, no una
            prediccion de resultados academicos.
          </Muted>

          {historyState.loading && <Loading />}
          {historyState.error && <ErrorText message={historyState.error} />}

          {historyState.data && historyState.data.length === 0 && (
            <Card>
              <Text style={styles.body}>
                Todavia no hay calculos registrados. Se guarda uno cada vez que tu perfil cambia.
              </Text>
            </Card>
          )}

          {historyState.data?.map((snapshot, index) => {
            const previous = historyState.data?.[index + 1];
            const delta = previous ? snapshot.totalScore - previous.totalScore : null;
            const top = snapshot.areas[0];
            return (
              <Card key={snapshot.id}>
                <View style={styles.areaHeader}>
                  <Text style={styles.areaName}>{formatDate(snapshot.calculatedAt)}</Text>
                  {delta !== null && delta !== 0 && (
                    <Badge color={delta > 0 ? colors.green : colors.gray500}>
                      {delta > 0 ? `+${delta}` : `${delta}`}
                    </Badge>
                  )}
                </View>

                {snapshot.status === 'insufficient_data' ? (
                  <Text style={styles.contribMeta}>Sin informacion suficiente en ese momento.</Text>
                ) : (
                  <>
                    <Text style={styles.contribMeta}>
                      {snapshot.areasCount} areas · {snapshot.signalsCount} senales · total{' '}
                      {snapshot.totalScore}
                    </Text>
                    {top && (
                      <Text style={styles.body}>
                        Area mas afin: <Text style={styles.strong}>{top.area}</Text> ({top.score})
                      </Text>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.gray100,
  },
  tabOn: { backgroundColor: colors.bordo },
  tabText: { color: colors.gray700, fontWeight: '600' },
  tabOnText: { color: colors.white, fontWeight: '600' },

  body: { color: colors.gray700, lineHeight: 20 },
  strong: { fontWeight: '700', color: colors.gray900 },
  link: { color: colors.bordo, fontWeight: '600' },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metaLabel: { color: colors.gray500 },
  metaValue: { color: colors.gray900, fontWeight: '600' },

  areaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  areaTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  rank: { color: colors.gray500, fontWeight: '700' },
  areaName: { fontWeight: '700', color: colors.gray900, flexShrink: 1 },

  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.gray100,
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 999 },
  shareText: { color: colors.gray500, fontSize: 12, marginTop: 6 },

  breakdown: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingTop: 8,
  },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  contribMain: { flex: 1 },
  contribSource: { color: colors.gray900 },
  contribMeta: { color: colors.gray500, fontSize: 12, marginTop: 2 },
  contribPoints: { color: colors.bordo, fontWeight: '700' },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    marginTop: 6,
    paddingTop: 8,
  },
  totalLabel: { fontWeight: '700', color: colors.gray900 },
  totalValue: { fontWeight: '700', color: colors.gray900 },

  hintBox: { marginTop: 12 },
  hintTitle: { fontWeight: '700', color: colors.gray900, marginBottom: 6 },
  hint: { color: colors.gray700, lineHeight: 20 },

  rules: { marginTop: 8 },
});
