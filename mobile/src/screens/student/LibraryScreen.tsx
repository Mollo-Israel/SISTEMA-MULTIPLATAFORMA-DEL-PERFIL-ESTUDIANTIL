import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { apiError } from '../../api/client';
import { libraryService, type LibraryPage, type LibraryResource } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  Badge, Button, Card, Chip, EmptyState, ErrorText, FadeIn, Muted, PageHeader, ResultCount, Screen, SearchInput, SkeletonCards,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import { Icon } from '../../components/icons';
import { ImagenProtegida } from '../../components/ImagenProtegida';
import { colors } from '../../theme';

const PAGINA = 20;

/**
 * Biblioteca de recursos (V3.2 §35), igual que en la web: búsqueda, filtro
 * por área y favoritos. Marcar un favorito es una señal secundaria para las
 * recomendaciones; no suma afinidad.
 */
export default function LibraryScreen() {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [areaId, setAreaId] = useState('');
  const [favoritos, setFavoritos] = useState(false);
  const [mas, setMas] = useState<LibraryResource[]>([]);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [cambios, setCambios] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);

  const params = { q: q || undefined, areaId: areaId || undefined, favorites: favoritos || undefined, limit: PAGINA };
  const pagina = useAsync<LibraryPage>(() => libraryService.list(params), [q, areaId, favoritos]);
  useEffect(() => { setMas([]); setCambios({}); }, [q, areaId, favoritos]);

  const items = pagina.data ? [...pagina.data.items, ...mas] : [];
  const total = pagina.data?.total ?? 0;
  const areas = pagina.data?.facets.areas ?? [];
  const esFavorito = (r: LibraryResource) => cambios[r.id] ?? r.isFavorite;

  const cargarMas = async () => {
    setCargandoMas(true);
    try {
      const r = await libraryService.list({ ...params, offset: items.length });
      setMas((prev) => [...prev, ...r.items]);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setCargandoMas(false);
    }
  };

  const alternar = async (r: LibraryResource) => {
    const nuevo = !esFavorito(r);
    setOcupado(r.id);
    try {
      if (nuevo) await libraryService.favorite(r.id);
      else await libraryService.unfavorite(r.id);
      setCambios((c) => ({ ...c, [r.id]: nuevo }));
      toast.success(nuevo ? 'Guardado en favoritos.' : 'Quitado de favoritos.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Screen refreshing={pagina.loading} onRefresh={pagina.reload}>
      <PageHeader title="Biblioteca" description="Cursos, guías y materiales recomendados por la carrera. Guarda los que te sirvan." />
      <SearchInput value={texto} onChangeText={setTexto} placeholder="Buscar por título, proveedor o tecnología…" />
      <View style={styles.fila}>
        <Chip label="Todos" on={!favoritos} onPress={() => setFavoritos(false)} />
        <Chip label="Mis favoritos" on={favoritos} onPress={() => setFavoritos(true)} />
      </View>
      {areas.length > 0 && (
        <View style={styles.fila}>
          <Chip label="Todas las áreas" on={areaId === ''} onPress={() => setAreaId('')} />
          {areas.map((a) => (
            <Chip key={a.id} label={`${a.name} (${a.total})`} on={areaId === a.id} onPress={() => setAreaId(areaId === a.id ? '' : a.id)} />
          ))}
        </View>
      )}

      {pagina.loading && !pagina.data && <SkeletonCards count={3} />}
      {pagina.error && <ErrorText message={pagina.error} />}
      {pagina.data && total > 0 && <ResultCount shown={items.length} total={total} noun="recursos" />}
      {pagina.data && total === 0 && (
        <EmptyState
          icon={favoritos ? 'bookmark' : 'book-open'}
          message={favoritos ? 'Todavía no guardaste recursos.' : q || areaId ? 'Ningún recurso coincide con la búsqueda.' : 'Todavía no hay recursos publicados.'}
        />
      )}

      {items.map((r, i) => (
        <FadeIn key={r.id} index={i}>
          <Card>
            {r.imageUrl && (
              <ImagenProtegida src={r.imageUrl} style={styles.imagen} />
            )}
            <View style={styles.fila}>
              <Badge color={colors.bordo}>{r.resourceTypeLabel}</Badge>
              {r.provider ? <Badge>{r.provider}</Badge> : null}
            </View>
            <Text style={styles.titulo}>{r.title}</Text>
            {r.description ? <Text style={styles.desc}>{r.description}</Text> : null}
            {r.areas.length > 0 && <Muted>Áreas: {r.areas.map((a) => a.name).join(', ')}</Muted>}
            {r.skills.length > 0 && <Muted>Habilidades: {r.skills.map((s) => s.name).join(', ')}</Muted>}
            <View style={[styles.fila, { marginTop: 10 }]}>
              <Button small icon="external-link" title="Abrir" onPress={() => Linking.openURL(r.url)} />
              <Button
                small
                variant="secondary"
                icon="bookmark"
                title={esFavorito(r) ? 'Quitar de favoritos' : 'Guardar'}
                loading={ocupado === r.id}
                onPress={() => alternar(r)}
              />
            </View>
          </Card>
        </FadeIn>
      ))}

      {pagina.data && items.length < total && (
        <View style={{ marginTop: 12 }}>
          <Button variant="secondary" icon="chevrons-down" title={`Cargar más (${total - items.length} restantes)`} loading={cargandoMas} onPress={cargarMas} />
        </View>
      )}
      {pagina.data && (
        <View style={styles.nota}>
          <Icon name="info" size={13} />
          <Muted>Guardar un recurso orienta tus recomendaciones; tu afinidad sale de lo que haces y queda respaldado.</Muted>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' },
  imagen: { width: '100%', height: 140, borderRadius: 10, marginBottom: 10, backgroundColor: colors.bordoBg },
  titulo: { fontSize: 15.5, fontWeight: '700', color: colors.gray900, marginTop: 8, marginBottom: 3 },
  desc: { fontSize: 13.5, color: colors.gray700, marginBottom: 6 },
  nota: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 14 },
});
