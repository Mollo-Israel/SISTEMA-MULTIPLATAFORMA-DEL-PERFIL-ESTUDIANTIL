import { useMemo, useState } from 'react';
import { FiSearch, FiUser } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { affinityService, profileService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge, Loading } from '../../components/ui';
import { AFFINITY_BADGE, AFFINITY_LEVEL_LABEL, PROFILE_STATUS_LABEL, lbl } from '../../constants';

export default function TeacherStudentsPage() {
  const { data, loading, error } = useAsync(() => profileService.listStudents(), []);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<any>(null);
  const [affinity, setAffinity] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data ?? [];
    if (!term) return list;
    return list.filter(
      (s: any) =>
        (s.studentName ?? '').toLowerCase().includes(term) || (s.email ?? '').toLowerCase().includes(term),
    );
  }, [data, search]);

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

  return (
    <div>
      <h1>Perfil de estudiante</h1>
      <p className="muted">Busca un estudiante y consulta su vista permitida (sin datos sensibles ni notas).</p>

      <Card>
        <div className="li-input-wrap" style={{ position: 'relative' }}>
          <input
            placeholder="Buscar por nombre o correo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.4rem' }}
          />
          <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-500)' }}><FiSearch /></span>
        </div>

        <div className="mt">
          <AsyncView loading={loading} error={error} data={data} isEmpty={() => filtered.length === 0} emptyMessage="No se encontraron estudiantes.">
            {() => (
              <table>
                <thead><tr><th>Estudiante</th><th>Correo</th><th>Semestre</th><th>Perfil</th><th></th></tr></thead>
                <tbody>
                  {filtered.map((s: any) => (
                    <tr key={s.profileId}>
                      <td>{s.studentName}</td>
                      <td className="muted">{s.email}</td>
                      <td>{s.semester ?? '—'}</td>
                      <td><Badge tone="gray">{s.completionPercentage}%</Badge></td>
                      <td>
                        <button className={`btn btn-sm ${selected === s.profileId ? 'btn-primary' : 'btn-secondary'}`} onClick={() => openProfile(s.profileId)}>
                          Ver perfil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AsyncView>
          <p className="muted" style={{ marginTop: '0.6rem', fontSize: '0.8rem' }}>{filtered.length} estudiante(s)</p>
        </div>
      </Card>

      {detailLoading && <Loading />}
      {detailError && <div className="alert alert-error">{detailError}</div>}

      {view && (
        <Card title={view.studentName ?? 'Estudiante'}>
          <p><strong>Semestre:</strong> {view.semester ?? '—'} · <strong>Estado:</strong> {lbl(PROFILE_STATUS_LABEL, view.status)}</p>
          {view.bio && <p>{view.bio}</p>}
          <p><strong>Intereses:</strong> {view.interests?.map((i: any) => i.area).join(', ') || '—'}</p>
          <p><strong>Habilidades:</strong> {view.skills?.map((s: any) => `${s.skill} (${s.level})`).join(', ') || '—'}</p>
          <p><strong>Proyectos:</strong> {view.projects?.length ?? 0} · <strong>Actividades:</strong> {view.activities?.length ?? 0}</p>
          <div className="mt">
            <strong>Áreas de afinidad</strong>
            {affinity.length === 0 ? (
              <p className="muted">Sin afinidades calculadas.</p>
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

      {!view && !detailLoading && (
        <div className="state"><FiUser size={26} style={{ opacity: 0.4 }} /><p className="muted">Selecciona un estudiante de la lista para ver su perfil.</p></div>
      )}
    </div>
  );
}
