export const colors = {
  bordo: '#6b1220',
  bordoDark: '#5a0f1b',
  bordoLight: '#8f1d2f',
  bordoSoft: '#d24b60',
  bordoBg: '#f3e3e6',
  gray50: '#f7f7f8',
  gray100: '#eef0f2',
  gray200: '#e2e5e9',
  gray300: '#c8cdd4',
  gray500: '#7b828c',
  gray700: '#3f444c',
  gray900: '#1d2127',
  white: '#ffffff',
  green: '#1f7a4d',
  amber: '#b6791f',
  red: '#b3261e',
};

/**
 * V7: los mismos tonos de los accesos de la web (rosa, azul, verde, ámbar,
 * bordó y cian), para que el inicio se vea igual en los dos clientes.
 */
export const tints = [
  { fg: '#db2777', bg: '#fdf2f8' },
  { fg: '#2563eb', bg: '#eff6ff' },
  { fg: '#059669', bg: '#ecfdf5' },
  { fg: '#d97706', bg: '#fffbeb' },
  { fg: '#6b1220', bg: '#f3e3e6' },
  { fg: '#0891b2', bg: '#ecfeff' },
];

/** Sombra suave con tinte bordó, como las tarjetas de la web. */
export const shadow = {
  shadowColor: '#6b1220',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

export const affinityColor = (level: string) =>
  level === 'high' ? colors.green : level === 'medium' ? colors.amber : colors.gray500;

export const registrationColor = (status: string) =>
  status === 'confirmed'
    ? colors.green
    : status === 'accepted'
      ? colors.bordo
      : status === 'registered'
        ? colors.amber
        : status === 'absent'
          ? colors.red
          : colors.gray500;
