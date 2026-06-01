import { useEffect, useState } from 'react';
import {
  FiCheck, FiCode, FiSmartphone, FiCpu, FiDatabase, FiWifi, FiShield, FiGitBranch, FiTrello, FiTarget,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import type { AcademicArea, StudentProfile } from '../../services/types';
import { Card, Loading } from '../../components/ui';

const AREA_ICON: Record<string, IconType> = {
  'Desarrollo Web': FiCode,
  'Desarrollo Móvil': FiSmartphone,
  'Inteligencia Artificial': FiCpu,
  'Bases de Datos': FiDatabase,
  Redes: FiWifi,
  Ciberseguridad: FiShield,
  'Ingeniería de Software': FiGitBranch,
  'Gestión de Proyectos': FiTrello,
};

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [form, setForm] = useState({ semester: '', bio: '', improvementAreaIds: [] as string[] });

  useEffect(() => {
    Promise.all([catalogService.areas(), profileService.getMine().catch(() => null)])
      .then(([a, p]) => {
        setAreas(a);
        if (p) {
          setProfile(p);
          setExists(true);
          setForm({
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
            <div className="field">
              <label>Semestre</label>
              <select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="">Selecciona…</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n}º semestre</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 2 }} />
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Cuéntanos brevemente tus intereses y metas académicas…"
              maxLength={1000}
            />
          </div>
          <div className="field">
            <label>Áreas donde deseas mejorar</label>
            <div className="area-grid">
              {areas.map((a) => {
                const Icon = AREA_ICON[a.name] ?? FiTarget;
                const on = form.improvementAreaIds.includes(a.id);
                return (
                  <button type="button" key={a.id} className={`area-opt ${on ? 'on' : ''}`} onClick={() => toggleArea(a.id)}>
                    <span className="ico"><Icon /></span>
                    <span className="nm">{a.name}</span>
                    <span className="chk">{on && <FiCheck size={12} />}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn btn-primary">{exists ? 'Guardar cambios' : 'Crear perfil'}</button>
        </form>
      </Card>
    </div>
  );
}
