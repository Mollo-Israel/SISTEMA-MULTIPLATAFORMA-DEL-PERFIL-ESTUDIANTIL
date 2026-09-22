import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiError } from '../../api/client';
import {
  affinityService,
  AffinityBreakdown,
  AffinityEngineRules,
  AffinitySnapshot,
  AffinitySummary,
  AffinityWeight,
} from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  Screen,
  Card,
  Muted,
  Button,
  Chip,
  EmptyState,
  ErrorText,
  FadeIn,
  Badge,
  PageHeader,
  SkeletonCards,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
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

/** Familias de prueba de §53 y §54, en las palabras del estudiante. */
const FAMILY_LABEL: Record<string, string> = {
  preference: 'Lo que declaras',
  activity: 'Actividades',
  project: 'Proyectos',
  external_certificate: 'Certificados externos',
  academic_review: 'Revision academica',
  other: 'Otras senales',
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
  const toast = useToast();
  const confirm = useConfirm();

  const [openArea, setOpenArea] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Record<string, AffinityBreakdown>>({});
  const [loadingArea, setLoadingArea] = useState<string | null>(null);

  const [showRules, setShowRules] = useState(false);
  const [weights, setWeights] = useState<AffinityEngineRules | null>(null);

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
    const ok = await confirm({
      title: 'Recalcular afinidad',
      message:
        'Se volverán a calcular tus áreas con la información que tienes registrada hoy. '
        + 'El resultado anterior queda guardado en «Evolución».',
      confirmLabel: 'Recalcular',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await affinityService.recalculateMine();
      reloadAll();
      toast.success('Afinidad recalculada.', 'Tus áreas reflejan tu información más reciente.');
    } catch (e) {
      toast.error(apiError(e));
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
      toast.error(apiError(e));
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
        toast.error(apiError(e));
      }
    }
  };

  const insufficient = summary?.status === 'insufficient_data';

  return (
    <Screen refreshing={summaryState.loading && !!summary} onRefresh={reloadAll}>
      <PageHeader
        title="Mis afinidades"
        description="Orientación calculada con reglas y puntuación sobre la información de tu perfil. No es una nota ni una evaluación académica."
      />

      <View style={styles.tabs}>
        {([
          { key: 'areas', label: 'Áreas' },
          { key: 'history', label: 'Evolución' },
        ] as const).map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            on={tab === t.key}
            onPress={() => setTab(t.key)}
          />
        ))}
      </View>

      {summaryState.error && <ErrorText message={summaryState.error} />}
      {summaryState.loading && !summary && <SkeletonCards count={3} />}

      {/* ---------------- Areas ---------------- */}
      {tab === 'areas' && summary && (
        <>
          <Button
            title="Recalcular mis afinidades"
            icon="refresh-cw"
            onPress={recalc}
            loading={busy}
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

              {summary.areas.map((a, index) => {
                const open = openArea === a.academicAreaId;
                const detail = breakdown[a.academicAreaId];
                return (
                  <FadeIn key={a.academicAreaId} index={index}>
                  <Card>
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
                          Afinidad {a.score}/100
                        </Badge>
                      </View>

                      {/* §52: la barra es el puntaje sobre el maximo teorico,
                          no el peso relativo dentro del perfil. Con lo
                          anterior, el area mas fuerte de cualquiera llenaba la
                          barra entera aunque su puntaje fuera minimo. */}
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.max(2, a.score)}%`,
                              backgroundColor: affinityColor(a.level),
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.respaldoLinea}>
                        <Badge color={affinityColor(a.supportLevel)}>
                          Respaldo {LEVEL_LABEL[a.supportLevel] ?? a.supportLevel}
                        </Badge>
                        <Text style={styles.shareText}>
                          {a.rawPoints} de {summary.maxRawPoints} puntos · respaldo{' '}
                          {a.supportScore}/100
                        </Text>
                      </View>

                      <Text style={styles.shareText}>
                        <Text style={styles.link}>{open ? 'ocultar detalle' : 'ver por que'}</Text>
                      </Text>
                    </TouchableOpacity>

                    {open && loadingArea === a.academicAreaId && <SkeletonCards count={1} />}

                    {open && detail && (
                      <View style={styles.breakdown}>
                        <Text style={styles.subtitulo}>Por que</Text>
                        {detail.contributing.length === 0 && (
                          <Text style={styles.contribMeta}>
                            Todavia no hay ninguna senal que sume en esta area.
                          </Text>
                        )}
                        {detail.contributing.map((c, i) => (
                          <View key={`${c.sourceId ?? 'x'}-${i}`} style={styles.contribRow}>
                            <View style={styles.contribMain}>
                              <Text style={styles.contribSource}>{c.reason ?? c.sourceLabel}</Text>
                              <Text style={styles.contribMeta}>
                                {FAMILY_LABEL[c.signalFamily] ?? c.signalFamily}
                                {' · '}
                                {MATCH_LABEL[c.matchType] ?? c.matchType}
                                {c.multiplier < 1 ? ` · ${c.rawPoints} x ${c.multiplier}` : ''}
                                {c.supportPoints > 0 ? ` · respaldo +${c.supportPoints}` : ''}
                              </Text>
                            </View>
                            <Text style={styles.contribPoints}>
                              {c.points > 0 ? `+${c.points}` : '—'}
                            </Text>
                          </View>
                        ))}
                        <View style={styles.totalRow}>
                          <Text style={styles.totalLabel}>Total del area</Text>
                          <Text style={styles.totalValue}>
                            {detail.rawPoints} / {detail.maxRawPoints}
                          </Text>
                        </View>

                        {/* §91: la segunda lista es la que de verdad orienta.
                            La pregunta del estudiante casi nunca es «por que
                            tengo 60», sino «por que no tengo mas». */}
                        {detail.notContributing.length > 0 && (
                          <>
                            <Text style={styles.subtitulo}>No contribuye</Text>
                            {detail.notContributing.map((c, i) => (
                              <Text key={`${c.sourceId ?? 'n'}-${i}`} style={styles.contribMeta}>
                                • {c.reason ?? c.sourceLabel}
                              </Text>
                            ))}
                          </>
                        )}
                      </View>
                    )}
                  </Card>
                  </FadeIn>
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
                {/* §51: la estructura limita tanto como los pesos. Mostrar
                    solo los segundos daria una explicacion incompleta. */}
                <Text style={styles.contribMeta}>
                  Motor v{weights.engineVersion}. Cada area suma como mucho{' '}
                  {weights.maxRawPoints} puntos, que equivalen a 100 de afinidad. Para que el
                  respaldo llegue a alto hacen falta senales de al menos dos familias
                  independientes.
                </Text>
                {weights.weights.map((w: AffinityWeight) => (
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

          {historyState.loading && <SkeletonCards count={2} />}
          {historyState.error && <ErrorText message={historyState.error} />}

          {historyState.data && historyState.data.length === 0 && (
            <EmptyState
              icon="trending-up"
              message="Todavía no hay cálculos registrados. Se guarda uno cada vez que tu perfil cambia."
            />
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
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 12, flexWrap: 'wrap' },

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
  respaldoLinea: { flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, flexWrap: 'wrap' },
  subtitulo: { fontWeight: '700', color: colors.gray700, fontSize: 13,
    marginTop: 10, marginBottom: 4 },

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
