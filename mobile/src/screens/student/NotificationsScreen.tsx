import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiError } from '../../api/client';
import { notificationService, type NotificationItem } from '../../services';
import { Screen, Button, Chip, EmptyState, ErrorText, PageHeader, SkeletonCards } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { colors } from '../../theme';

/** A qué pantalla de la app lleva el enlace web de cada aviso. */
function destino(link: string | null): [string, Record<string, unknown>?] | null {
  if (!link) return null;
  if (link.startsWith('/student/activities')) return ['Actividades'];
  if (link.startsWith('/student/projects')) return ['Proyectos'];
  if (link.startsWith('/student/collaboration')) return ['Perfil', { screen: 'Colaboracion' }];
  if (link.startsWith('/student/evidences')) return ['Perfil', { screen: 'Evidencias' }];
  if (link.startsWith('/student/progress')) return ['Perfil', { screen: 'Trayectoria' }];
  return null;
}

function cuando(fecha: string) {
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return new Date(fecha).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
}

/**
 * Centro de notificaciones (V3 §33), el mismo de la web: qué pasó y adónde
 * ir. Tocar un aviso lo marca como leído.
 */
export default function NotificationsScreen({ navigation }: any) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const toast = useToast();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await notificationService.mine(soloNoLeidas));
      setError(null);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setCargando(false);
    }
  }, [soloNoLeidas]);

  // Al volver a la pestaña se actualiza: es donde llegan las novedades.
  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  const abrir = async (n: NotificationItem) => {
    if (!n.readAt) {
      await notificationService.markRead(n.id).catch(() => undefined);
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? null);
    }
    const d = destino(n.link);
    if (d) navigation.navigate(...d);
  };

  const todas = async () => {
    try {
      await notificationService.markAllRead();
      toast.success('Todo marcado como leído.');
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const hayNoLeidas = (items ?? []).some((n) => !n.readAt);

  return (
    <Screen refreshing={cargando} onRefresh={cargar}>
      <PageHeader title="Avisos" description="Tus actividades, equipos, proyectos y credenciales." />
      <View style={styles.filtros}>
        <Chip label="Todos" on={!soloNoLeidas} onPress={() => setSoloNoLeidas(false)} />
        <Chip label="Sin leer" on={soloNoLeidas} onPress={() => setSoloNoLeidas(true)} />
      </View>
      {hayNoLeidas && <Button small variant="secondary" icon="check" title="Marcar todo como leído" onPress={todas} />}
      {error && <ErrorText message={error} />}
      {items === null && !error && <SkeletonCards count={3} />}
      {items && items.length === 0 && (
        <EmptyState icon="bell" message={soloNoLeidas ? 'No tienes avisos sin leer.' : 'Todavía no tienes avisos.'} />
      )}
      {(items ?? []).map((n) => (
        <Pressable
          key={n.id}
          onPress={() => abrir(n)}
          accessibilityRole="button"
          accessibilityLabel={`${n.readAt ? '' : 'Sin leer. '}${n.title}. ${n.body}`}
          style={({ pressed }) => [styles.item, !n.readAt && styles.noLeida, pressed && { opacity: 0.8 }]}
        >
          {!n.readAt && <View style={styles.punto} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>{n.title}</Text>
            <Text style={styles.cuerpo}>{n.body}</Text>
            <Text style={styles.fecha}>{cuando(n.createdAt)}</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filtros: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  item: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.white, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.gray200, marginTop: 10,
  },
  noLeida: { backgroundColor: colors.bordoBg, borderColor: colors.bordoBg },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bordo, marginTop: 6 },
  titulo: { fontWeight: '700', color: colors.gray900, fontSize: 15 },
  cuerpo: { color: colors.gray700, marginTop: 2, lineHeight: 20 },
  fecha: { color: colors.gray500, fontSize: 12, marginTop: 6 },
});
