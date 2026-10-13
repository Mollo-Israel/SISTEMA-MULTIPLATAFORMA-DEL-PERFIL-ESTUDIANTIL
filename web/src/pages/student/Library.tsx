import { useCallback, useEffect, useState } from 'react';
import { FiBookOpen, FiExternalLink, FiHeart, FiSearch, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { libraryService } from '../../services';
import type { LibraryPage, LibraryResource } from '../../services/types';
import {
  Badge, Button, Diferido, EmptyState, PageHeader, Paginacion, SearchInput, SkeletonCards, Tabs,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import { resumen } from '../../components/ActivityCard';

const POR_PAGINA = 12;

/**
 * Biblioteca (V3.2 §35).
 *
 * Material permanente que la carrera recomienda: libros, documentación, guías,
 * videos, herramientas. No tiene fechas, inscripción ni certificado, y
 * consultarlo no suma afinidad: leer un libro no demuestra experiencia. Se
 * busca, se filtra por área o habilidad, se abre y se guarda como favorito.
 */
export default function StudentLibraryPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'todos' | 'favoritos'>('todos');
  const [query, setQuery] = useState('');
  const [buscado, setBuscado] = useState('');
  const [areaId, setAreaId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<LibraryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setData(await libraryService.list({
        q: buscado || undefined,
        areaId: areaId || undefined,
        skillId: skillId || undefined,
        favorites: tab === 'favoritos' || undefined,
        limit: POR_PAGINA,
        offset: (pagina - 1) * POR_PAGINA,
      }));
      setError(null);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [buscado, areaId, skillId, tab, pagina]);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => setPagina(1), [buscado, areaId, skillId, tab]);

  const alternarFavorito = async (r: LibraryResource) => {
    setOcupado(r.id);
    try {
      if (r.isFavorite) await libraryService.unfavorite(r.id);
      else await libraryService.favorite(r.id);
      toast.success(r.isFavorite ? 'Quitado de favoritos.' : 'Guardado en favoritos.');
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  const limpiar = () => { setQuery(''); setBuscado(''); setAreaId(''); setSkillId(''); };
  const hayFiltros = !!(buscado || areaId || skillId);
  const total = data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;

  return (
    <div>
      <PageHeader
        title="Biblioteca"
        description="Libros, documentación, guías, videos y herramientas que recomienda la carrera. Guarda los que te sirvan: consultarlos no cambia tu perfil ni tu afinidad."
      />
      <Tabs
        items={[{ key: 'todos', label: 'Todos los recursos' }, { key: 'favoritos', label: 'Mis favoritos' }]}
        value={tab}
        onChange={(k) => setTab(k as 'todos' | 'favoritos')}
      />
      <div className="filters">
        <SearchInput value={query} onChange={setQuery} onDebouncedChange={(v) => setBuscado(v.trim())} placeholder="Buscar por título, descripción o fuente…" />
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Filtrar por área" style={{ maxWidth: 240 }}>
          <option value="">Todas las áreas</option>
          {(data?.facets.areas ?? []).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.total})</option>)}
        </select>
        <select value={skillId} onChange={(e) => setSkillId(e.target.value)} aria-label="Filtrar por habilidad" style={{ maxWidth: 240 }}>
          <option value="">Todas las habilidades</option>
          {(data?.facets.skills ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.total})</option>)}
        </select>
        <Button variant="ghost" size="sm" icon={<FiX size={14} />} disabled={!hayFiltros} onClick={limpiar}>Limpiar</Button>
      </div>

      {loading && !data ? (
        <Diferido><SkeletonCards count={4} /></Diferido>
      ) : error && !data ? (
        <div className="alert alert-error">{error}</div>
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState
          icon={hayFiltros ? <FiSearch size={22} /> : <FiBookOpen size={22} />}
          message={tab === 'favoritos' && !hayFiltros
            ? 'Todavía no guardaste ningún recurso. Usa el corazón para tenerlos a mano.'
            : hayFiltros ? 'Ningún recurso coincide con los filtros.' : 'Todavía no hay recursos en la biblioteca.'}
          action={hayFiltros ? <Button variant="secondary" size="sm" onClick={limpiar}>Quitar filtros</Button> : undefined}
        />
      ) : (
        <>
          <div className="activity-grid">
            {(data?.items ?? []).map((r) => (
              <article key={r.id} className="activity-card resource-card">
                <div className="activity-card-img" aria-hidden>
                  {r.imageUrl ? <img src={r.imageUrl} alt="" loading="lazy" /> : <FiBookOpen size={28} />}
                </div>
                <div className="activity-card-body">
                  <div className="activity-card-head">
                    <h3 title={r.title}>{r.title}</h3>
                    <Badge tone="bordo">{r.resourceTypeLabel}</Badge>
                  </div>
                  {r.provider && <span className="muted small">Fuente: {r.provider}</span>}
                  {r.description && <p className="activity-card-desc">{r.description}</p>}
                  <div className="activity-meta">
                    {r.areas.length > 0 && <span title={r.areas.map((a) => a.name).join(', ')}>Áreas: {resumen(r.areas.map((a) => a.name))}</span>}
                    {r.skills.length > 0 && <span title={r.skills.map((s) => s.name).join(', ')}>Habilidades: {resumen(r.skills.map((s) => s.name))}</span>}
                  </div>
                  <div className="activity-card-actions">
                    <a className="btn btn-primary btn-sm" href={r.url} target="_blank" rel="noreferrer">
                      <FiExternalLink size={14} /> Abrir
                    </a>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={ocupado === r.id}
                      icon={<FiHeart size={14} />}
                      aria-pressed={r.isFavorite}
                      onClick={() => void alternarFavorito(r)}
                    >
                      {r.isFavorite ? 'En favoritos' : 'Guardar'}
                    </Button>
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
            hasta={Math.min(pagina * POR_PAGINA, total)}
            ir={(n) => setPagina(Math.min(Math.max(1, n), paginas))}
            noun="recursos"
          />
        </>
      )}
    </div>
  );
}
