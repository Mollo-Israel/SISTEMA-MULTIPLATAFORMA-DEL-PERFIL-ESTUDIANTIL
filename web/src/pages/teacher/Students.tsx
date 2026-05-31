import { useState } from 'react';
import { apiError } from '../../api/client';
import { affinityService, profileService } from '../../services';
import { Card, Badge } from '../../components/ui';
import { AFFINITY_BADGE } from '../../constants';

export default function TeacherStudentsPage() {
  const [profileId, setProfileId] = useState('');
  const [view, setView] = useState<any>(null);
  const [affinity, setAffinity] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setView(null); setAffinity([]);
    try {
      const [v, a] = await Promise.all([
        profileService.allowedView(profileId),
        affinityService.student(profileId).catch(() => []),
      ]);
      setView(v); setAffinity(a as any[]);
    } catch (err) { setError(apiError(err, 'No se pudo cargar el perfil.')); }
  };

  return (
    <div>
      <h1>Perfil permitido del estudiante</h1>
      <p className="muted">Vista parcial autorizada. No incluye datos personales sensibles ni notas.</p>
      <Card>
        <form className="row" onSubmit={search}>
          <input placeholder="ID de perfil del estudiante (studentProfileId)" value={profileId} onChange={(e) => setProfileId(e.target.value)} required />
          <button className="btn btn-primary" style={{ flex: '0 0 auto' }}>Consultar</button>
        </form>
        {error && <div className="alert alert-error" style={{ marginTop: '0.8rem' }}>{error}</div>}
      </Card>

      {view && (
        <Card title={view.studentName ?? 'Estudiante'}>
          <p><strong>Semestre:</strong> {view.semester ?? '—'} · <strong>Estado:</strong> {view.status}</p>
          {view.bio && <p>{view.bio}</p>}
          <p><strong>Intereses:</strong> {view.interests?.map((i: any) => i.area).join(', ') || '—'}</p>
          <p><strong>Habilidades:</strong> {view.skills?.map((s: any) => `${s.skill} (${s.level})`).join(', ') || '—'}</p>
          <p><strong>Proyectos:</strong> {view.projects?.length ?? 0} · <strong>Actividades:</strong> {view.activities?.length ?? 0}</p>
          <div className="mt">
            <strong>Áreas de afinidad</strong>
            {affinity.length === 0 ? <p className="muted">Sin afinidades calculadas.</p> : (
              <div className="tag-list mt">
                {affinity.map((a) => (
                  <Badge key={a.id} tone={(AFFINITY_BADGE[a.level] ?? 'badge-gray').replace('badge-', '')}>{a.academicArea?.name}: {a.score} ({a.level})</Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
