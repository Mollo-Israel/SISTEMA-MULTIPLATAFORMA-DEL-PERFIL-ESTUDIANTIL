import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/** Autoevaluacion en tres niveles (§21.1). La cadena vacia es "sin declarar". */
export type SkillLevel = 'basic' | 'intermediate' | 'advanced';
export type NivelElegido = SkillLevel | '';

const OPCIONES: { value: NivelElegido; label: string }[] = [
  { value: '', label: '—' },
  { value: 'basic', label: 'Básico' },
  { value: 'intermediate', label: 'Intermedio' },
  { value: 'advanced', label: 'Avanzado' },
];

/**
 * Selector de nivel autodeclarado.
 *
 * Era una escala de 1 a 5. Con tres niveles cabe la etiqueta completa en
 * pantalla, de modo que ya no hay que adivinar qué significa un «4».
 */
export function LevelPicker({
  value,
  onChange,
}: {
  value: NivelElegido;
  onChange: (v: NivelElegido) => void;
}) {
  return (
    <View style={styles.row}>
      {OPCIONES.map((o) => {
        const activo = value === o.value;
        return (
          <Pressable
            key={o.value || 'ninguno'}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            style={[styles.cell, o.value === '' && styles.cellCorta, activo && styles.active]}
          >
            <Text style={[styles.text, activo && styles.activeText]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  cellCorta: { paddingHorizontal: 0, width: 34 },
  active: { backgroundColor: colors.bordo, borderColor: colors.bordo },
  text: { color: colors.gray700, fontWeight: '600', fontSize: 12 },
  activeText: { color: colors.white },
});
