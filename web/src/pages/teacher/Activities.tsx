import { useCallback, useEffect, useState } from 'react';
import { FiSearch, FiStar } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { activityService, catalogService } from '../../services';
import { ActivityCard, ActivityDetail } from '../../components/ActivityCard';
import {
  Button, Card, EmptyState, PageHeader, Paginacion, ResultCount, SearchInput, SkeletonCards, Stagger,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import type { Activity, ActivityCategoryItem } from '../../services/types';

/** V5 §16: las vistas de exploración muestran 6 tarjetas por página. */
const POR_PAGINA = 6;

type Responsable = { id: string; name: string; role: string };

/**
 * Actividades de la carrera, vista del docente (V5-01, V5-02).
 *
 * Las mismas tarjetas y el mismo detalle que ve el estudiante, para orientar
 * a sus estudiantes y colaborar: con filtros por tipo, categoría y
 * responsable, y favoritos para volver rápido. Sin «Me interesa» ni
 * inscripción: el docente no es un participante. Lo que gestiona vive en
 * «Mis actividades». Las páginas las arma el servidor: con miles de
 * actividades, descargar la lista completa era lento.
 */
export default function TeacherActivitiesPage() {
  const toast = useToast();
  const [tipo, setTipo] = useState<'todas' | 'academica' | 'extracurricular' | 'externas'>('todas');
  const [categoryId, setCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [buscado, setBuscado] = useState('');
  const [soloFavoritas, setSoloFavoritas] = useState(false);
  const [responsable, setResponsable] = useState<Responsable | null>(null);
  const [buscarResp, setBuscarResp] = useState('');
  const [candidatos, setCandidatos] = useState<Responsable[]>([]);
  const [categories, setCategories] = useState<ActivityCategoryItem[]>([]);
  const [pagina, setPagina] = useState(1);
  const [items, setItems] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Activity | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    catalogService.activityCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const t = buscarResp.trim();
    if (!t) { setCandidatos([]); return; }
    const id = window.setTimeout(() => {
      activityService.responsibles(t).then(setCandidatos).catch(() => setCandidatos([]));
    }, 250);
    return () => window.clearTimeout(id);
  }, [buscarResp]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await activityService.page({
        limit: POR_PAGINA,
        offset: (pagina - 1) * POR_PAGINA,
        q: buscado.trim() || undefined,
        categoryId: categoryId || undefined,
        responsibleId: responsable?.id,
        favorites: soloFavoritas ? 'true' : undefined,
        ...(tipo === 'externas' ? { originType: 'external' as const }
          : tipo === 'todas' ? {} : { type: tipo, originType: 'internal' as const }),
      });
      setItems(r.items);
      setTotal(r.total);
      setError(null);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [pagina, buscado, categoryId, responsable, soloFavoritas, tipo]);
  useEffect(() => { void cargar(); }, [cargar]);
  // Cambiar un filtro vuelve a la primera página.
  useEffect(() => { setPagina(1); }, [buscado, categoryId, responsable, soloFavoritas, tipo]);

  const alternarFavorita = async (a: Activity) => {
    setBusy(a.id);
    try {
      const r = a.isFavorite ? await activityService.unfavorite(a.id) : await activityService.favorite(a.id);
      setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, isFavorite: r.isFavorite } : x)));
      if (detalle?.id === a.id) setDetalle({ ...detalle, isFavorite: r.isFavorite });
      if (soloFavoritas && !r.isFavorite) void cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const limpiar = () => {
    setTipo('todas'); setCategoryId(''); setQuery(''); setBuscado(''); setSoloFavoritas(false);
    setResponsable(null); setBuscarResp('');
  };
  const hayFiltros = tipo !== 'todas' || !!categoryId || !!buscado || soloFavoritas || !!responsable;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = total === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;

  const estrella = (a: Activity) => (
    <Button
      variant={a.isFavorite ? 'primary' : 'secondary'}
      size="sm"
      loading={busy === a.id}
      onClick={() => void alternarFavorita(a)}
      icon={<FiStar size={14} />}
      aria-pressed={!!a.isFavorite}
    >
      {a.isFavorite ? 'En favoritas' : 'Favorita'}
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Actividades de la carrera"
        description="La oferta de la carrera, para orientar a sus estudiantes y colaborar. Lo que usted gestiona está en «Mis actividades»; aquí puede guardar favoritas para volver rápido."
      />

      <Card>
        <div className="filters">
          <SearchInput value={query} onChange={setQuery} onDebouncedChange={setBuscado} placeholder="Buscar por título, descripción o lugar…" />
          <div className="chip-row">
            {([
              { key: 'todas', label: 'Todas' },
              { key: 'academica', label: 'Académicas' },
              { key: 'extracurricular', label: 'Extracurriculares' },
              { key: 'externas', label: 'Externas' },
            ] as const).map((o) => (
              <button key={o.key} type="button" className={`chip ${tipo === o.key ? 'on' : ''}`} aria-pressed={tipo === o.key} onClick={() => setTipo(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="docente-categoria">Categoría</label>
            <select id="docente-categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="docente-responsable">Responsable</label>
            {responsable ? (
              <div className="flex" style={{ gap: '0.4rem', alignItems: 'center' }}>
                <strong>{responsable.name}</strong>
                <Button variant="ghost" size="sm" onClick={() => { setResponsable(null); setBuscarResp(''); }}>Quitar</Button>
              </div>
            ) : (
              <div>
                <input
                  id="docente-responsable"
                  value={buscarResp}
                  onChange={(e) => setBuscarResp(e.target.value)}
                  placeholder="Busca por nombre…"
                  role="combobox"
                  aria-expanded={candidatos.length > 0}
                  aria-controls="docente-responsable-lista"
                  autoComplete="off"
                />
                {candidatos.length > 0 && (
                  <ul id="docente-responsable-lista" className="plain-list" role="listbox">
                    {candidatos.map((c) => (
                      <li key={c.id} role="option" aria-selected={false}>
                        <button type="button" className="link-button" onClick={() => { setResponsable(c); setCandidatos([]); }}>
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <label className="flex" style={{ gap: '0.35rem', alignItems: 'center' }}>
            <input type="checkbox" checked={soloFavoritas} onChange={(e) => setSoloFavoritas(e.target.checked)} />
            Solo favoritas
          </label>
          {hayFiltros && <Button variant="ghost" size="sm" onClick={limpiar}>Limpiar filtros</Button>}
          <ResultCount shown={items.length} total={total} noun="actividades" />
        </div>

        {loading && items.length === 0 ? (
          <SkeletonCards count={3} />
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<FiSearch size={22} />}
            message={hayFiltros ? 'Ninguna actividad coincide con los filtros aplicados.' : 'Todavía no hay actividades publicadas.'}
            action={hayFiltros ? <Button variant="secondary" size="sm" onClick={limpiar}>Quitar filtros</Button> : undefined}
          />
        ) : (
          <>
            <div className="activity-grid">
              {items.map((a, index) => (
                <Stagger key={a.id} index={index}>
                  <ActivityCard a={a} onDetalle={() => setDetalle(a)} acciones={estrella(a)} />
                </Stagger>
              ))}
            </div>
            <Paginacion
              pagina={pagina}
              paginas={paginas}
              total={total}
              desde={desde}
              hasta={Math.min(pagina * POR_PAGINA, total)}
              ir={(n) => setPagina(Math.min(Math.max(1, n), paginas))}
              noun="actividades"
            />
          </>
        )}
      </Card>

      {detalle && <ActivityDetail a={detalle} onClose={() => setDetalle(null)} acciones={estrella(detalle)} />}
    </div>
  );
}
