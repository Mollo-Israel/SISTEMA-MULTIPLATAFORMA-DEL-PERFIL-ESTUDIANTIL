import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function LevelPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.row}>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          style={[styles.cell, value === n && styles.active]}
        >
          <Text style={[styles.text, value === n && styles.activeText]}>{n === 0 ? '—' : n}</Text>
        </Pressable>
      ))}
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
