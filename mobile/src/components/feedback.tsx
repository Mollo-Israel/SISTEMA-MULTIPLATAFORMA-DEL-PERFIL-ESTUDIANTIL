import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

/**
 * Avisos flotantes y confirmaciones de la aplicacion movil.
 *
 * Es el equivalente de lo que el panel web ya tenia: en lugar de dejar un
 * texto de exito colgado dentro de la pantalla, el aviso aparece encima y se
 * va solo; y en lugar del dialogo del sistema, una ventana centrada que se ve
 * igual en Android y en iOS. Se usa solo la API de React Native.
 */

// ===========================================================================
//  Avisos flotantes
// ===========================================================================

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  description?: string;
}

interface ToastApi {
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

const MARK: Record<ToastKind, string> = { success: '✓', error: '✕', info: 'i' };
const TONE: Record<ToastKind, string> = {
  success: colors.green,
  error: colors.red,
  info: colors.bordo,
};
/** El error se lee mas despacio que una confirmacion. */
const LIFE: Record<ToastKind, number> = { success: 3200, info: 3800, error: 6000 };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, description?: string) => {
      const id = nextId.current++;
      // Tres a la vez es el limite razonable en una pantalla de telefono.
      setItems((prev) => [...prev.slice(-2), { id, kind, message, description }]);
      setTimeout(() => dismiss(id), LIFE[kind]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, description) => push('success', message, description),
      error: (message, description) => push('error', message, description),
      info: (message, description) => push('info', message, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastStack({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const insets = useSafeAreaInsets();
  if (items.length === 0) return null;
  return (
    <View style={[toastStyles.stack, { top: insets.top + 8 }]} pointerEvents="box-none">
      {items.map((item) => (
        <ToastRow key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </View>
  );
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        toastStyles.toast,
        { borderLeftColor: TONE[item.kind] },
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
          ],
        },
      ]}
    >
      <Pressable style={toastStyles.press} onPress={onDismiss}>
        <View style={[toastStyles.mark, { backgroundColor: TONE[item.kind] }]}>
          <Text style={toastStyles.markText}>{MARK[item.kind]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={toastStyles.message}>{item.message}</Text>
          {item.description ? (
            <Text style={toastStyles.description}>{item.description}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Fuera del proveedor no falla: simplemente no muestra nada. */
export function useToast(): ToastApi {
  return (
    useContext(ToastContext) ?? { success: () => {}, error: () => {}, info: () => {} }
  );
}

// ===========================================================================
//  Confirmacion
// ===========================================================================

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" para lo que da de baja, retira o elimina. */
  tone?: 'danger' | 'default';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );

  useEffect(() => {
    if (!pending) {
      anim.setValue(0);
      return;
    }
    Animated.spring(anim, {
      toValue: 1,
      damping: 18,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
  }, [pending, anim]);

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const danger = pending?.options.tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        onRequestClose={() => close(false)}
      >
        <Pressable style={confirmStyles.backdrop} onPress={() => close(false)}>
          <Animated.View
            style={[
              confirmStyles.card,
              {
                opacity: anim,
                transform: [
                  { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                ],
              },
            ]}
          >
            {/* El toque dentro de la ventana no debe cerrarla. */}
            <Pressable onPress={() => {}}>
              <View style={confirmStyles.head}>
                <View
                  style={[
                    confirmStyles.icon,
                    { backgroundColor: danger ? colors.red + '1a' : colors.bordoBg },
                  ]}
                >
                  <Text style={[confirmStyles.iconText, { color: danger ? colors.red : colors.bordo }]}>
                    !
                  </Text>
                </View>
                <Text style={confirmStyles.title}>{pending?.options.title}</Text>
              </View>

              {pending?.options.message ? (
                <Text style={confirmStyles.message}>{pending.options.message}</Text>
              ) : null}

              <View style={confirmStyles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    confirmStyles.btn,
                    confirmStyles.btnGhost,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => close(false)}
                >
                  <Text style={confirmStyles.btnGhostText}>
                    {pending?.options.cancelLabel ?? 'Cancelar'}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    confirmStyles.btn,
                    { backgroundColor: danger ? colors.red : colors.bordo },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => close(true)}
                >
                  <Text style={confirmStyles.btnSolidText}>
                    {pending?.options.confirmLabel ?? 'Continuar'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** Fuera del proveedor se resuelve en true: no bloquea la accion. */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? (async () => true);
}

const toastStyles = StyleSheet.create({
  stack: { position: 'absolute', left: 12, right: 12, zIndex: 900 },
  toast: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  press: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  markText: { color: colors.white, fontSize: 12, fontWeight: '800', lineHeight: 16 },
  message: { color: colors.gray900, fontWeight: '700', fontSize: 14 },
  description: { color: colors.gray500, fontSize: 12.5, marginTop: 2 },
});

const confirmStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 17, 21, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18, fontWeight: '800' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.gray900 },
  message: { color: colors.gray700, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btn: { borderRadius: 9, paddingVertical: 11, paddingHorizontal: 16, minWidth: 96, alignItems: 'center' },
  btnGhost: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
  btnGhostText: { color: colors.gray700, fontWeight: '600' },
  btnSolidText: { color: colors.white, fontWeight: '700' },
});
