import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Prioridad de un area de interes, de 1 a 5 (§18).
 *
 * Compartia componente con la autoevaluacion de habilidades hasta que esta
 * paso a tres niveles con nombre (§21.1). Son dos escalas distintas —una mide
 * preferencia, la otra dominio— y ahora cada una tiene el suyo.
 *
 * `0` significa "sin declarar", no prioridad cero.
 */
export function PriorityPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.row}>
      {[0, 1, 2, 3, 4, 5].map((n) => {
        const activo = value === n;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            style={[styles.cell, activo && styles.active]}
          >
            <Text style={[styles.text, activo && styles.activeText]}>{n === 0 ? '—' : n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    width: 34,
    height: 34,
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
