export const colors = {
  ink: '#173F43',
  deep: '#0D3238',
  green: '#4E9D8D',
  mint: '#7FC8B9',
  pale: '#EEF6F4',
  soft: '#F7FAF9',
  line: '#E3ECEB',
  muted: '#60787B',
  white: '#FFFFFF',
  danger: '#94615B',
  successSurface: '#E7F3EE',
  successText: '#25755D',
  warningSurface: '#FBF3E1',
  warningText: '#97661A',
  unavailableSurface: '#EDF1F1',
  unavailableText: '#60787B',
  focus: '#4E9D8D',
  overlay: 'rgba(13, 50, 56, 0.52)',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  section: 64,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;
export const controlHeight = { compact: 44, regular: 52, large: 56 } as const;
export const border = { thin: 1, focus: 3 } as const;
export const breakpoints = { narrow: 374, mobile: 680, tablet: 900, desktop: 1200, wide: 1440 } as const;
export const layout = { mobileGutter: 16, tabletGutter: 24, desktopGutter: 32, contentMax: 1200 } as const;

export const typography = {
  family: {
    regular: 'Segoe UI',
    medium: 'Segoe UI',
    semibold: 'Segoe UI',
    bold: 'Segoe UI',
  },
  size: { caption: 11, small: 13, body: 15, large: 18, h3: 20, h2: 24, h1: 32 },
  lineHeight: { caption: 17, small: 21, body: 25, large: 29, h3: 32, h2: 38, h1: 50 },
} as const;
