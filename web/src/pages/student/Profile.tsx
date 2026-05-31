import { useEffect, useState } from 'react';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import type { AcademicArea, StudentProfile } from '../../services/types';
import { Card, Loading, ErrorState } from '../../components/ui';

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [form, setForm] = useState({ universityCode: '', semester: '', bio: '', improvementAreaIds: [] as string[] });

  useEffect(() => {
    Promise.all([catalogService.areas(), profileService.getMine().catch(() => null)])
      .then(([a, p]) => {
        setAreas(a);
        if (p) {
          setProfile(p);
          setExists(true);
          setForm({
            universityCode: p.universityCode ?? '',
            semester: p.semester ? String(p.semester) : '',
            bio: p.bio ?? '',
            improvementAreaIds: p.improvementAreaIds ?? [],
          });
        }
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setError(null);
    const payload = {
      semester: form.semester ? Number(form.semester) : undefined,
      bio: form.bio || undefined,
      improvementAreaIds: form.improvementAreaIds,
      ...(exists ? {} : { universityCode: form.universityCode || undefined }),
    };
    try {
      const result = exists ? await profileService.update(payload) : await profileService.create(payload);
      setProfile(result);
      setExists(true);
      setMsg('Perfil guardado correctamente.');
    } catch (err) {
      setError(apiError(err));
    }
  };

  const toggleArea = (id: string) => {
    setForm((f) => ({
      ...f,
      improvementAreaIds: f.improvementAreaIds.includes(id)
        ? f.improvementAreaIds.filter((x) => x !== id)
        : [...f.improvementAreaIds, id],
    }));
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1>Perfil dinámico</h1>
      <p className="muted">Datos declarados que, junto a tu actividad, alimentan tus áreas de afinidad.</p>

      {profile && (
        <Card title={`Completitud: ${profile.completionPercentage}%`}>
          <div className="progress"><div style={{ width: `${profile.completionPercentage}%` }} /></div>
          <p className="muted" style={{ marginTop: '0.5rem' }}>Estado: {profile.status}</p>
        </Card>
      )}

      <Card title={exists ? 'Editar perfil' : 'Crear perfil'}>
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <form onSubmit={save}>
          <div className="row">
            {!exists && (
              <div className="field">
                <label>Código universitario</label>
                <input value={form.universityCode} onChange={(e) => setForm({ ...form, universityCode: e.target.value })} />
              </div>
            )}
            <div className="field">
              <label>Semestre</label>
              <input type="number" min={1} max={12} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Descripción / bio</label>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div className="field">
            <label>Áreas donde deseas mejorar</label>
            <div className="tag-list">
              {areas.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className={`btn btn-sm ${form.improvementAreaIds.includes(a.id) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => toggleArea(a.id)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary">{exists ? 'Guardar cambios' : 'Crear perfil'}</button>
        </form>
      </Card>
    </div>
  );
}
