import { useCallback, useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiFolder, FiSearch, FiUsers, FiX } from 'react-icons/fi';
import { apiError } from '../api/client';
import { catalogService, projectService } from '../services';
import type { CommunityProject, CommunityProjectsPage } from '../services';
import type { AcademicArea, ProjectBackingTier, Skill } from '../services/types';
import { PROJECT_BACKING_LABEL } from '../services/types';
import { ImagenProtegida } from '../components/ArchivoProtegido';
import {
  Badge, Button, Diferido, EmptyState, Modal, PageHeader, Paginacion, SearchInput, SkeletonCards,
} from '../components/ui';
import { resumen } from '../components/ActivityCard';

/**
 * «Proyectos de la carrera» (V5 §13.4, G07).
 *
 * Para la comunidad con sesión: solo proyectos activos que su dueño puso en la
 * comunidad o con enlace público y, para un docente, también los visibles a
 * docentes de su alcance. Nunca un borrador, correos ni evidencias. La API
 * decide qué se ve; esta página solo lo muestra, 6 por página.
 */
export default function CareerProjectsPage() {
  const [query, setQuery] = useState('');
  const [buscado, setBuscado] = useState('');
  const [areaId, setAreaId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<CommunityProjectsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [viendo, setViendo] = useState<CommunityProject | null>(null);
  const [foto, setFoto] = useState(0);

  useEffect(() => {
    catalogService.areas().then(setAreas).catch(() => {});
    catalogService.skills().then(setSkills).catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setData(await projectService.community({ q: buscado || undefined, areaId: areaId || undefined, skillId: skillId || undefined, page: pagina }));
      setError(null);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [buscado, areaId, skillId, pagina]);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscado, areaId, skillId]);

  const limpiar = () => { setQuery(''); setBuscado(''); setAreaId(''); setSkillId(''); };
  const hayFiltros = !!(buscado || areaId || skillId);
  const total = data?.total ?? 0;
  const porPagina = data?.pageSize ?? 6;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const skillsDelArea = skills.filter((s) => s.isActive !== false && (!areaId || s.academicAreaId === areaId));

  return (
    <div>
      <PageHeader
        title="Proyectos de la carrera"
        description="Proyectos activos que sus autores decidieron mostrar a la comunidad Afinia. Los borradores, los correos y las evidencias no aparecen aquí."
      />
      <div className="filters">
        <SearchInput value={query} onChange={setQuery} onDebouncedChange={(v) => setBuscado(v.trim())} placeholder="Buscar por título o descripción…" />
        <select value={areaId} onChange={(e) => { setAreaId(e.target.value); setSkillId(''); }} aria-label="Filtrar por área" style={{ maxWidth: 240 }}>
          <option value="">Todas las áreas</option>
          {areas.filter((a) => a.isActive !== false).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={skillId} onChange={(e) => setSkillId(e.target.value)} aria-label="Filtrar por tecnología" style={{ maxWidth: 240 }}>
          <option value="">Todas las tecnologías</option>
          {skillsDelArea.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button variant="ghost" size="sm" icon={<FiX size={14} />} disabled={!hayFiltros} onClick={limpiar}>Limpiar</Button>
      </div>

      {loading && !data ? (
        <Diferido><SkeletonCards count={6} /></Diferido>
      ) : error && !data ? (
        <div className="alert alert-error">{error}</div>
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState
          icon={hayFiltros ? <FiSearch size={22} /> : <FiFolder size={22} />}
          message={hayFiltros ? 'Ningún proyecto coincide con los filtros.' : 'Todavía no hay proyectos activos compartidos con la comunidad.'}
          action={hayFiltros ? <Button variant="secondary" size="sm" onClick={limpiar}>Quitar filtros</Button> : undefined}
        />
      ) : (
        <>
          <div className="activity-grid" data-testid="proyectos-carrera">
            {(data?.items ?? []).map((p) => (
              <article key={p.id} className="activity-card">
                <div className="activity-card-img" aria-hidden>
                  {p.coverUrl ? <ImagenProtegida src={p.coverUrl} loading="lazy" fallback={<FiFolder size={28} />} /> : <FiFolder size={28} />}
                </div>
                <div className="activity-card-body">
                  <div className="activity-card-head">
                    <h3 title={p.title}>{p.title}</h3>
                    <Badge tone="gray">{PROJECT_BACKING_LABEL[p.backingTier as ProjectBackingTier] ?? p.backingTier}</Badge>
                  </div>
                  {p.owner && <span className="muted small">De {p.owner}{p.confirmedMembers > 0 ? ` y ${p.confirmedMembers} integrante${p.confirmedMembers === 1 ? '' : 's'}` : ''}</span>}
                  {/* V6 §7.5: solo quienes aceptaron mostrarse, con sus roles. */}
                  {(p.members ?? []).length > 0 && (
                    <span className="small" data-testid="integrantes">
                      {(p.members ?? []).map((m) => (m.roles.length ? `${m.name} (${m.roles.join(', ')})` : m.name)).join(' · ')}
                    </span>
                  )}
                  {p.description && <p className="activity-card-desc">{p.description}</p>}
                  <div className="activity-meta">
                    {p.areas.length > 0 && <span title={p.areas.join(', ')}>Áreas: {resumen(p.areas)}</span>}
                    {p.skills.length > 0 && <span title={p.skills.join(', ')}>Tecnologías: {resumen(p.skills)}</span>}
                  </div>
                  <div className="activity-card-actions">
                    <Button size="sm" variant="secondary" onClick={() => { setViendo(p); setFoto(0); }}>Ver más</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Paginacion
            pagina={pagina}
            paginas={paginas}
            total={total}
            desde={desde}
            hasta={Math.min(total, pagina * porPagina)}
            ir={setPagina}
            noun="proyectos"
          />
        </>
      )}

      {viendo && (
        <Modal title={viendo.title} subtitle={viendo.owner ? `De ${viendo.owner}` : undefined} onClose={() => setViendo(null)} width={760}>
          {viendo.images.length > 0 && (
            <div className="career-project-carousel" data-testid="carrusel-proyecto">
              <ImagenProtegida src={viendo.images[foto]} alt={`Imagen ${foto + 1} de ${viendo.images.length}`} fallback={<FiFolder size={32} />} />
              {viendo.images.length > 1 && (
                <>
                  <button type="button" className="icon-button prev" aria-label="Imagen anterior" onClick={() => setFoto((foto + viendo.images.length - 1) % viendo.images.length)}><FiChevronLeft size={16} /></button>
                  <button type="button" className="icon-button next" aria-label="Imagen siguiente" onClick={() => setFoto((foto + 1) % viendo.images.length)}><FiChevronRight size={16} /></button>
                </>
              )}
            </div>
          )}
          {viendo.description && <p>{viendo.description}</p>}
          <div className="activity-meta">
            {viendo.areas.length > 0 && <span>Áreas: {viendo.areas.join(', ')}</span>}
            {viendo.skills.length > 0 && <span>Tecnologías: {viendo.skills.join(', ')}</span>}
            <span><FiUsers size={12} /> {viendo.confirmedMembers + 1} persona{viendo.confirmedMembers === 0 ? '' : 's'} con su contribución confirmada</span>
          </div>
          {(viendo.members ?? []).length > 0 && (
            <div data-testid="integrantes-detalle">
              <strong className="small">Integrantes</strong>
              <ul className="detalle-personas">
                {(viendo.members ?? []).map((m) => (
                  <li key={m.name}>{m.name}{m.roles.length > 0 && <span className="muted small"> · {m.roles.join(', ')}</span>}</li>
                ))}
              </ul>
              <p className="muted small" style={{ margin: 0 }}>Solo figuran quienes aceptaron mostrarse aquí.</p>
            </div>
          )}
          <p className="muted small">
            Respaldo: {PROJECT_BACKING_LABEL[viendo.backingTier as ProjectBackingTier] ?? viendo.backingTier}. Lo que figura es lo que el proyecto declara y su respaldo; no es una evaluación académica.
          </p>
        </Modal>
      )}
    </div>
  );
}
