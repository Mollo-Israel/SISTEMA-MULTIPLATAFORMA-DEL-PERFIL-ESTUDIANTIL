import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Interés en un área, en tres intensidades con nombre (V7.1 §10.1).
 *
 * Igual que la web: «Mucho», «Bastante» y «Un poco». Por dentro siguen siendo
 * las prioridades 1, 3 y 5 de §18, así que el orden de las recomendaciones no
 * cambia. Una prioridad intermedia guardada antes (2 o 4) se muestra en la
 * intensidad más cercana.
 *
 * `0` significa «sin declarar».
 */
const NIVELES = [
  { valor: 0, label: '—' },
  { valor: 1, label: 'Mucho' },
  { valor: 3, label: 'Bastante' },
  { valor: 5, label: 'Un poco' },
];

/** Una prioridad cualquiera (1-5) llevada a la intensidad más cercana. */
export function nivelDeInteres(prioridad: number): number {
  if (!prioridad) return 0;
  if (prioridad <= 2) return 1;
  return prioridad <= 4 ? 3 : 5;
}

export function PriorityPicker({
  value,
  onChange,
}: Readonly<{
  value: number;
  onChange: (v: number) => void;
}>) {
  const actual = nivelDeInteres(value);
  return (
    <View style={styles.row}>
      {NIVELES.map((n) => {
        const activo = actual === n.valor;
        return (
          <Pressable
            key={n.valor}
            onPress={() => onChange(n.valor)}
            accessibilityRole="button"
            accessibilityLabel={n.valor === 0 ? 'Sin interés declarado' : `Interés: ${n.label}`}
            accessibilityState={{ selected: activo }}
            style={[styles.cell, activo && styles.active]}
          >
            <Text style={[styles.text, activo && styles.activeText]}>{n.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cell: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  active: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  text: { color: colors.gray700, fontWeight: '600' },
  activeText: { color: colors.white },
});
