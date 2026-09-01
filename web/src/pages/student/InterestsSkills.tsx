import { useEffect, useState } from 'react';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import type { AcademicArea, Skill } from '../../services/types';
import { Card, Loading } from '../../components/ui';

// Etiquetas legibles para el usuario; el valor interno sigue siendo 1–5.
const PRIORITY_LABELS: Record<number, string> = {
  0: 'Sin interés',
  1: 'Muy bajo',
  2: 'Bajo',
  3: 'Moderado',
  4: 'Alto',
  5: 'Muy alto',
};
const LEVEL_LABELS: Record<number, string> = {
  0: 'Sin experiencia',
  1: 'Principiante',
  2: 'Básico',
  3: 'Intermedio',
  4: 'Avanzado',
  5: 'Experto',
};

export default function InterestsSkillsPage() {
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<Record<string, number>>({});
  const [skillLevels, setSkillLevels] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([catalogService.areas(), catalogService.skills(), profileService.summary().catch(() => null)])
      .then(([a, s, summary]) => {
        setAreas(a);
        setSkills(s);
        if (summary) {
          setInterests(Object.fromEntries(summary.interests.map((i) => [i.academicAreaId, i.priority])));
          setSkillLevels(Object.fromEntries(summary.skills.map((sk) => [sk.skillId, sk.level])));
        }
      })
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const saveInterests = async () => {
    setMsg(null); setError(null);
    try {
      await profileService.setPreferredAreas(
        Object.entries(interests).filter(([, p]) => p > 0).map(([academicAreaId, priority]) => ({ academicAreaId, priority })),
      );
      setMsg('Intereses actualizados.');
    } catch (e) { setError(apiError(e)); }
  };

  const saveSkills = async () => {
    setMsg(null); setError(null);
    try {
      await profileService.setSkills(
        Object.entries(skillLevels).filter(([, l]) => l > 0).map(([skillId, level]) => ({ skillId, level })),
      );
      setMsg('Habilidades actualizadas.');
    } catch (e) { setError(apiError(e)); }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h1>Intereses y habilidades</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <Card title="Intereses por área" actions={<button className="btn btn-primary btn-sm" onClick={saveInterests}>Guardar intereses</button>}>
        <p className="muted" style={{ marginTop: '-0.3rem', marginBottom: '0.8rem' }}>Indica qué tanto te interesa cada área.</p>
        <table>
          <thead><tr><th>Área</th><th style={{ width: 180 }}>Nivel de interés</th></tr></thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>
                  <select value={interests[a.id] ?? 0} onChange={(e) => setInterests({ ...interests, [a.id]: Number(e.target.value) })}>
                    <option value={0}>{PRIORITY_LABELS[0]}</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{PRIORITY_LABELS[n]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Habilidades declaradas" actions={<button className="btn btn-primary btn-sm" onClick={saveSkills}>Guardar habilidades</button>}>
        <p className="muted" style={{ marginTop: '-0.3rem', marginBottom: '0.8rem' }}>Indica tu nivel de dominio en cada habilidad.</p>
        <table>
          <thead><tr><th>Habilidad</th><th>Área</th><th style={{ width: 180 }}>Nivel de dominio</th></tr></thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="muted">{s.academicArea?.name ?? '—'}</td>
                <td>
                  <select value={skillLevels[s.id] ?? 0} onChange={(e) => setSkillLevels({ ...skillLevels, [s.id]: Number(e.target.value) })}>
                    <option value={0}>{LEVEL_LABELS[0]}</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{LEVEL_LABELS[n]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
