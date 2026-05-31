export const colors = {
  bordo: '#6b1220',
  bordoLight: '#8f1d2f',
  bordoBg: '#f3e3e6',
  gray50: '#f7f7f8',
  gray100: '#eef0f2',
  gray200: '#e2e5e9',
  gray500: '#7b828c',
  gray700: '#3f444c',
  gray900: '#1d2127',
  white: '#ffffff',
  green: '#1f7a4d',
  amber: '#b6791f',
  red: '#b3261e',
};

export const affinityColor = (level: string) =>
  level === 'high' ? colors.green : level === 'medium' ? colors.amber : colors.gray500;

export const registrationColor = (status: string) =>
  status === 'confirmed'
    ? colors.green
    : status === 'registered'
      ? colors.amber
      : status === 'absent'
        ? colors.red
        : colors.gray500;
