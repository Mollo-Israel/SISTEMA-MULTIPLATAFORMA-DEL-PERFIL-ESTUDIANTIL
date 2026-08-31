import { useMemo, useState } from 'react';
import { FiSearch, FiUser, FiInfo } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { affinityService, profileService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge, Loading } from '../../components/ui';
import { AFFINITY_BADGE, AFFINITY_LEVEL_LABEL, PROFILE_STATUS_LABEL, lbl } from '../../constants';
import type { StudentDirectory } from '../../services/types';

export default function TeacherStudentsPage() {
  const { data, loading, error } = useAsync<StudentDirectory>(() => profileService.listStudents(), []);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<any>(null);
  const [affinity, setAffinity] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const students = data?.students ?? [];
  const scope = data?.scope;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) =>
        (s.studentName ?? '').toLowerCase().includes(term) ||
        (s.email ?? '').toLowerCase().includes(term),
    );
  }, [students, search]);

  const openProfile = async (profileId: string) => {
    setSelected(profileId);
    setDetailLoading(true);
    setDetailError(null);
    setView(null);
    setAffinity([]);
    try {
      const [v, a] = await Promise.all([
        profileService.allowedView(profileId),
        affinityService.student(profileId).catch(() => []),
      ]);
      setView(v);
      setAffinity(a as any[]);
    } catch (e) {
      setDetailError(apiError(e, 'No se pudo cargar el perfil.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const noScope = scope?.restricted && scope.semesters.length === 0;

  return (
    <div>
      <h1>Perfil de estudiante</h1>
      <p className="muted">
        Consulta la vista permitida del estudiante: intereses, habilidades, proyectos, actividades
        y afinidades. No incluye notas, datos sensibles ni las constancias internas.
      </p>

      {scope?.restricted && !noScope && (
        <div className="scope-note">
          <FiInfo />
          <span>
            Está viendo únicamente los semestres que tiene habilitados:{' '}
            <strong>{scope.semesters.map((s) => `${s}º`).join(', ')}</strong>. El administrador
            gestiona esta asignación.
          </span>
        </div>
      )}

      {noScope ? (
        <Card>
          <div className="state">
            <FiUser size={26} style={{ opacity: 0.4 }} />
            <p style={{ marginTop: '0.6rem' }}>
              <strong>Todavía no tiene semestres habilitados.</strong>
            </p>
            <p className="muted">
              Solicite al administrador que le asigne los semestres que debe acompañar. Hasta
              entonces no podrá consultar perfiles de estudiantes.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ position: 'relative' }}>
            <input
              placeholder="Buscar por nombre o correo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.4rem' }}
            />
            <span
              style={{
                position: 'absolute',
                left: '0.8rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--gray-500)',
              }}
            >
              <FiSearch />
            </span>
          </div>

          <div className="mt">
            <AsyncView
              loading={loading}
              error={error}
              data={data}
              isEmpty={() => filtered.length === 0}
              emptyMessage={
                search
                  ? `Ningún estudiante coincide con “${search}”.`
                  : 'No hay estudiantes en los semestres habilitados.'
              }
            >
              {() => (
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Correo</th>
                      <th>Semestre</th>
                      <th>Perfil</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.profileId}>
                        <td>{s.studentName}</td>
                        <td className="muted">{s.email}</td>
                        <td>{s.semester ? `${s.semester}º` : '—'}</td>
                        <td>
                          <Badge tone={s.completionPercentage === 100 ? 'green' : 'gray'}>
                            {s.completionPercentage}%
                          </Badge>
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm ${selected === s.profileId ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => openProfile(s.profileId)}
                          >
                            Ver perfil
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </AsyncView>
            {filtered.length > 0 && (
              <p className="muted" style={{ marginTop: '0.6rem', fontSize: '0.8rem' }}>
                {filtered.length} estudiante{filtered.length === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </Card>
      )}

      {detailLoading && <Loading label="Cargando perfil…" />}
      {detailError && <div className="alert alert-error">{detailError}</div>}

      {view && (
        <Card title={view.studentName ?? 'Estudiante'}>
          <p>
            <strong>Semestre:</strong> {view.semester ? `${view.semester}º` : '—'} ·{' '}
            <strong>Estado del perfil:</strong> {lbl(PROFILE_STATUS_LABEL, view.status)}
          </p>
          {view.bio && <p>{view.bio}</p>}

          <div className="grid cols-2 mt">
            <div>
              <strong>Áreas de interés</strong>
              {view.interests?.length ? (
                <div className="tag-list mt">
                  {view.interests.map((i: any) => (
                    <Badge key={i.academicAreaId} tone="bordo">
                      {i.area} · prioridad {i.priority}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="muted">Sin áreas de interés declaradas.</p>
              )}
            </div>
            <div>
              <strong>Habilidades</strong>
              {view.skills?.length ? (
                <div className="tag-list mt">
                  {view.skills.map((s: any) => (
                    <Badge key={s.skillId} tone="gray">
                      {s.skill} · nivel {s.level}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="muted">Sin habilidades declaradas.</p>
              )}
            </div>
          </div>

          <div className="grid cols-2 mt">
            <div>
              <strong>Proyectos ({view.projects?.length ?? 0})</strong>
              {view.projects?.length ? (
                <ul className="plain-list">
                  {view.projects.map((p: any, i: number) => (
                    <li key={i}>
                      {p.title} <span className="muted">· {p.technologies?.join(', ') || 'sin tecnologías'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Todavía no registra proyectos.</p>
              )}
            </div>
            <div>
              <strong>Actividades ({view.activities?.length ?? 0})</strong>
              {view.activities?.length ? (
                <ul className="plain-list">
                  {view.activities.map((a: any, i: number) => (
                    <li key={i}>
                      {a.title} <span className="muted">· {a.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Todavía no participa en actividades.</p>
              )}
            </div>
          </div>

          <div className="mt">
            <strong>Certificados externos ({view.externalCertificates?.length ?? 0})</strong>
            {view.externalCertificates?.length ? (
              <ul className="plain-list">
                {view.externalCertificates.map((c: any, i: number) => (
                  <li key={i}>
                    {c.certificateName} <span className="muted">· {c.issuer}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Sin certificados externos registrados.</p>
            )}
          </div>

          <div className="mt">
            <strong>Áreas de afinidad</strong>
            {affinity.length === 0 ? (
              <p className="muted">Todavía no hay afinidades calculadas para este estudiante.</p>
            ) : (
              <div className="tag-list mt">
                {affinity.map((a) => (
                  <Badge key={a.id} tone={(AFFINITY_BADGE[a.level] ?? 'badge-gray').replace('badge-', '')}>
                    {a.academicArea?.name}: {a.score} · {lbl(AFFINITY_LEVEL_LABEL, a.level)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {!view && !detailLoading && !noScope && (
        <div className="state">
          <FiUser size={26} style={{ opacity: 0.4 }} />
          <p className="muted">Selecciona un estudiante de la lista para ver su perfil.</p>
        </div>
      )}
    </div>
  );
}
