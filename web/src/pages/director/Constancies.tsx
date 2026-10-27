import { useEffect, useMemo, useState } from 'react';
import { FiAward, FiCalendar, FiCheck, FiSearch, FiUsers } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { enMemoria, useCachedState } from '../../hooks/viewCache';
import { activityService, constancyService } from '../../services';
import {
  Badge, Button, Card, Diferido, EmptyState, PageHeader, ResultCount, SearchInput, SkeletonCards,
  SkeletonTable,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import type { Activity, EligibleParticipant, InternalConstancy } from '../../services/types';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Participaciones confirmadas (V5 §7.2).
 *
 * La primera función es consultar quién asistió a cada actividad interna: un
 * registro que hizo su responsable en Afinia, no un certificado. Afinia ya no
 * emite constancias (V5 §1.2, ND-01). Los documentos emitidos antes, y los
 * que la institución entrega con su emisor real, se muestran aparte y se
 * conservan con su historia.
 */
export default function DirectorConstanciesPage() {
  const [activities, setActivities] = useCachedState<Activity[]>('actividades', []);
  const [loading, setLoading] = useState(() => !enMemoria('actividades'));
  const [selected, setSelected] = useState<string>('');
  const [eligible, setEligible] = useState<EligibleParticipant[]>([]);
  const [issued, setIssued] = useState<InternalConstancy[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [query, setQuery] = useState('');
  const toast = useToast();

  useEffect(() => {
    activityService
      .managed()
      .then(setActivities)
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // V5 §7.2: una oportunidad externa no es una actividad interna de la carrera.
  const internas = useMemo(() => activities.filter((a) => (a.originType ?? 'internal') === 'internal'), [activities]);

  const loadActivity = async (activityId: string) => {
    setSelected(activityId);
    setQuery('');
    setEligible([]);
    setIssued([]);
    if (!activityId) return;
    setListBusy(true);
    try {
      const [e, i] = await Promise.all([
        constancyService.eligible(activityId),
        constancyService.byActivity(activityId),
      ]);
      setEligible(e);
      setIssued(i);
    } catch (e2) {
      toast.error(apiError(e2));
    } finally {
      setListBusy(false);
    }
  };

  const needle = normalize(query.trim());
  const shown = eligible.filter((e) => !needle || normalize(e.studentName ?? '').includes(needle));
  const nombreDe = (c: InternalConstancy) => (c.studentProfile?.user
    ? `${c.studentProfile.user.firstName} ${c.studentProfile.user.lastName}`
    : eligible.find((e) => e.studentProfileId === c.studentProfileId)?.studentName || 'Estudiante');

  if (loading) return <Diferido><SkeletonCards count={2} /></Diferido>;

  return (
    <div>
      <PageHeader
        title="Participaciones confirmadas"
        description={
          <>
            Quién asistió a cada actividad interna, según lo registró su responsable en Afinia.
            Es un registro de participación, <strong>no un certificado</strong>: Afinia no emite
            documentos oficiales. Si la institución entrega un documento, se registra desde la
            actividad con su emisor real.
          </>
        }
      />

      <Card title="Elegir actividad">
        {internas.length === 0 ? (
          <EmptyState
            icon={<FiCalendar size={22} />}
            message="Todavía no gestiona ninguna actividad interna. Publique una desde “Actividades académicas”."
          />
        ) : (
          <div className="field">
            <label htmlFor="constancies-actividad">Actividad</label>
            <select id="constancies-actividad" value={selected} onChange={(e) => loadActivity(e.target.value)}>
              <option value="">Seleccione una actividad…</option>
              {internas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} · {a.confirmedCount ?? 0} con lugar o asistencia
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {listBusy && <SkeletonTable rows={4} columns={3} />}

      {selected && !listBusy && (
        <>
          <Card
            title={`Asistencia confirmada (${eligible.length})`}
            actions={
              eligible.length > 0 ? (
                <div className="flex" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
                  <SearchInput value={query} onChange={setQuery} placeholder="Buscar estudiante…" />
                  <ResultCount shown={shown.length} total={eligible.length} noun="estudiantes" />
                </div>
              ) : undefined
            }
          >
            {eligible.length === 0 ? (
              <EmptyState
                icon={<FiUsers size={22} />}
                message="Esta actividad todavía no tiene asistencia registrada. La registra su responsable cuando el evento ya empezó."
              />
            ) : shown.length === 0 ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message={`Ningún estudiante coincide con “${query}”.`}
                action={<Button variant="secondary" size="sm" onClick={() => setQuery('')}>Limpiar búsqueda</Button>}
              />
            ) : (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Semestre</th>
                      <th>Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => (
                      <tr key={p.studentProfileId}>
                        <td>{p.studentName ?? 'Estudiante'}</td>
                        <td className="muted">{p.semester ? `${p.semester}º` : '—'}</td>
                        <td>
                          <Badge tone="green"><FiCheck /> Asistencia registrada por el responsable</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={`Documentos registrados (${issued.length})`}>
            <p className="muted small" style={{ marginTop: 0 }}>
              Documentos emitidos antes de este cambio y certificados que entregó la institución con su
              emisor real. Se conservan como historia; Afinia no los vuelve a emitir.
            </p>
            {issued.length === 0 ? (
              <EmptyState icon={<FiAward size={22} />} message="Esta actividad no tiene documentos registrados." />
            ) : (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Documento</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issued.map((c) => (
                      <tr key={c.id}>
                        <td>{nombreDe(c)}</td>
                        <td className="muted">
                          {c.kind === 'institution_certificate'
                            ? `Certificado emitido por ${c.issuerName ?? 'la institución'}`
                            : 'Constancia del sistema (histórica)'}
                          <div className="small">{c.description}</div>
                        </td>
                        <td>
                          {c.status === 'authorized'
                            ? <Badge tone="green"><FiCheck /> Vigente</Badge>
                            : c.status === 'pending'
                              ? <Badge tone="amber">Pendiente</Badge>
                              : <Badge tone="gray">Revocada</Badge>}
                        </td>
                        <td className="muted">{fecha(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
