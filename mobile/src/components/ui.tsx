import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
} from 'react-native';
import { Icon, type IconName } from './icons';
import { colors } from '../theme';

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.bordo]} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

/**
 * Boton de la aplicacion. `loading` evita el doble envio: mientras dura la
 * peticion muestra un indicador y deja de responder.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  icon?: IconName;
}) {
  const blocked = disabled || loading;
  const solid = variant === 'primary' || variant === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!blocked, busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        variant === 'primary' && styles.btnPrimary,
        variant === 'danger' && styles.btnDanger,
        variant === 'secondary' && styles.btnSecondary,
        (pressed || blocked) && { opacity: 0.7 },
      ]}
    >
      <View style={styles.btnInner}>
        {loading ? (
          <ActivityIndicator size="small" color={solid ? colors.white : colors.gray700} />
        ) : icon ? (
          <Icon
            name={icon}
            size={small ? 13 : 15}
            color={solid ? colors.white : colors.gray700}
          />
        ) : null}
        <Text style={solid ? styles.btnPrimaryText : styles.btnSecondaryText}>{title}</Text>
      </View>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray500}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        multiline={multiline}
      />
    </View>
  );
}

export function Badge({ children, color = colors.gray500 }: { children: ReactNode; color?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.bordo} size="large" />
    </View>
  );
}

export function EmptyState({
  message = 'Sin datos.',
  icon,
  action,
}: {
  message?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      {icon ? (
        <Icon name={icon} size={26} color={colors.gray300} style={styles.emptyIcon} />
      ) : null}
      <Text style={[styles.muted, { textAlign: 'center' }]}>{message}</Text>
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

// ===========================================================================
//  Lo que se agrego para igualar al panel web
// ===========================================================================

/** Encabezado de pantalla: titulo, explicacion y, si hace falta, una accion. */
export function PageHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h1}>{title}</Text>
        {description ? <Text style={styles.muted}>{description}</Text> : null}
      </View>
      {right ? <View style={{ marginLeft: 10 }}>{right}</View> : null}
    </View>
  );
}

/** Buscador con boton de limpiar. El icono es texto: no hay libreria de iconos. */
export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Buscar…',
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.search}>
      <Icon name="search" size={16} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray500}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          accessibilityLabel="Limpiar búsqueda"
        >
          <Icon name="x" size={15} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Cuantos resultados quedaron tras filtrar: da certeza de que el filtro corrio. */
export function ResultCount({
  shown,
  total,
  noun = 'resultados',
}: {
  shown: number;
  total: number;
  noun?: string;
}) {
  return (
    <Text style={styles.resultCount}>
      {shown === total ? `${total} ${noun}` : `${shown} de ${total} ${noun}`}
    </Text>
  );
}

/** Bloque gris que late mientras llegan los datos, en lugar de una pantalla vacia. */
export function Skeleton({ height = 14, width }: { height?: number; width?: number | string }) {
  const anim = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { height, width: (width ?? '100%') as never, opacity: anim },
      ]}
    />
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton height={15} width="60%" />
          <View style={{ height: 8 }} />
          <Skeleton height={11} />
          <View style={{ height: 6 }} />
          <Skeleton height={11} width="80%" />
        </View>
      ))}
    </View>
  );
}

/** Barra de progreso con avance animado. */
export function ProgressBar({
  value,
  label,
  tone = colors.bordo,
}: {
  value: number;
  label?: string;
  tone?: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const safe = Math.max(0, Math.min(100, value));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: safe,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, safe]);

  return (
    <View style={{ marginVertical: 6 }}>
      {label ? (
        <View style={styles.progressHead}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={[styles.progressValue, { color: tone }]}>{safe}%</Text>
        </View>
      ) : null}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: tone,
              width: anim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

/** Entrada escalonada de una tarjeta de la lista. */
export function FadeIn({ children, index = 0 }: { children: ReactNode; index?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      // Mas alla de la sexta tarjeta el retraso ya no aporta y se siente lento.
      delay: Math.min(index, 6) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Filtro rapido en forma de pastilla. */
export function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string }) {
  return <Text style={styles.error}>⚠ {message}</Text>;
}

export function Success({ message }: { message: string }) {
  return <Text style={styles.success}>{message}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.gray50 },
  screenContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
  h1: { fontSize: 22, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  muted: { color: colors.gray500, fontSize: 13 },
  label: { fontSize: 13, color: colors.gray700, marginBottom: 4, fontWeight: '500' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.gray900,
  },
  btn: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', marginTop: 4 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnPrimary: { backgroundColor: colors.bordo },
  btnDanger: { backgroundColor: colors.red },
  btnSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
  btnPrimaryText: { color: colors.white, fontWeight: '700' },
  btnSecondaryText: { color: colors.gray700, fontWeight: '600' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyIcon: { marginBottom: 8 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.gray900 },
  resultCount: { color: colors.gray500, fontSize: 12.5, marginBottom: 8 },
  skeleton: { backgroundColor: colors.gray100, borderRadius: 7 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { fontSize: 12.5, color: colors.gray700, fontWeight: '600' },
  progressValue: { fontSize: 12.5, fontWeight: '800' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray100,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  chipText: { fontSize: 12.5, fontWeight: '700', color: colors.gray700 },
  chipTextOn: { color: colors.white },
  error: { color: colors.red, marginVertical: 8 },
  success: { color: colors.green, marginVertical: 8 },
});
