export const primitiveColors = {
  emerald50: '#ECF5F2', emerald100: '#D3E9E2', emerald200: '#A6D2C5', emerald300: '#6FB3A1',
  emerald400: '#3D927D', emerald500: '#1D7562', emerald600: '#136252', emerald700: '#0E5245',
  emerald800: '#0B4137', emerald900: '#082F28',
  saffron50: '#FEF6E7', saffron100: '#FDE9C2', saffron200: '#FBD38A', saffron300: '#F8BE58',
  saffron400: '#F4A62A', saffron500: '#DB8C12', saffron600: '#B26F0C', saffron700: '#87530B',
  neutral0: '#FFFFFF', cream: '#FBF6EC', neutral100: '#EFF2F1', neutral200: '#DDE2E0',
  neutral400: '#9AA3A0', neutral600: '#5B6662', neutral800: '#2B3532', ink: '#14201D',
  mint: '#8FD9C2', info: '#2E6FD8', error: '#C43D2E',
} as const;

export const lightColors = {
  background: primitiveColors.neutral0,
  backgroundSubtle: primitiveColors.cream,
  surface: primitiveColors.neutral0,
  surfaceMuted: '#F7F8F7',
  border: primitiveColors.neutral200,
  text: primitiveColors.ink,
  textMuted: primitiveColors.neutral600,
  textDisabled: primitiveColors.neutral400,
  primary: primitiveColors.emerald700,
  primaryHover: primitiveColors.emerald800,
  primaryPressed: primitiveColors.emerald900,
  onPrimary: primitiveColors.neutral0,
  primarySoft: primitiveColors.emerald50,
  onPrimarySoft: primitiveColors.emerald700,
  accent: primitiveColors.saffron400,
  accentHover: primitiveColors.saffron500,
  onAccent: primitiveColors.ink,
  accentSoft: primitiveColors.saffron100,
  accentText: primitiveColors.saffron700,
  success: primitiveColors.emerald500,
  successSoft: primitiveColors.emerald100,
  successText: primitiveColors.emerald700,
  warning: primitiveColors.saffron500,
  warningSoft: primitiveColors.saffron100,
  warningText: primitiveColors.saffron700,
  error: primitiveColors.error,
  info: primitiveColors.info,
  focusRing: primitiveColors.saffron400,
  imageWell: primitiveColors.cream,
  decorativeMint: primitiveColors.mint,
  overlay: 'rgba(20, 32, 29, 0.56)',
  toast: primitiveColors.ink,
  onToast: primitiveColors.neutral0,
} as const;

export const darkColors = {
  background: primitiveColors.emerald900,
  backgroundSubtle: primitiveColors.emerald900,
  surface: primitiveColors.emerald800,
  surfaceMuted: primitiveColors.emerald700,
  border: primitiveColors.emerald600,
  text: primitiveColors.cream,
  textMuted: primitiveColors.emerald200,
  textDisabled: primitiveColors.emerald300,
  primary: primitiveColors.emerald300,
  primaryHover: primitiveColors.emerald200,
  primaryPressed: primitiveColors.emerald100,
  onPrimary: primitiveColors.ink,
  primarySoft: primitiveColors.emerald700,
  onPrimarySoft: primitiveColors.cream,
  accent: primitiveColors.saffron400,
  accentHover: primitiveColors.saffron300,
  onAccent: primitiveColors.ink,
  accentSoft: primitiveColors.saffron700,
  accentText: primitiveColors.saffron100,
  success: primitiveColors.emerald300,
  successSoft: primitiveColors.emerald700,
  successText: primitiveColors.emerald100,
  warning: primitiveColors.saffron400,
  warningSoft: primitiveColors.saffron700,
  warningText: primitiveColors.saffron100,
  error: primitiveColors.error,
  info: primitiveColors.info,
  focusRing: primitiveColors.saffron400,
  imageWell: primitiveColors.emerald700,
  decorativeMint: primitiveColors.mint,
  overlay: 'rgba(8, 47, 40, 0.72)',
  toast: primitiveColors.ink,
  onToast: primitiveColors.neutral0,
} as const;

/** Semantic light-theme tokens used by the current app. */
export const colors = {
  ...lightColors,
  // Compatibility aliases for the operations app while both apps share this package.
  ink: lightColors.text, deep: lightColors.primaryPressed, green: lightColors.primary,
  mint: lightColors.decorativeMint, pale: lightColors.primarySoft, soft: lightColors.surfaceMuted,
  line: lightColors.border, muted: lightColors.textMuted, white: lightColors.surface,
  danger: lightColors.error, successSurface: lightColors.successSoft, unavailableSurface: lightColors.surfaceMuted,
  unavailableText: lightColors.textMuted, warningSurface: lightColors.warningSoft, focus: lightColors.focusRing,
} as const;

export const spacing = {
  xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48, section: 64,
} as const;

export const radius = { sm: 8, md: 12, lg: 14, xl: 18, xxl: 22, pill: 999 } as const;
export const controlHeight = { compact: 44, regular: 48, large: 52 } as const;
export const border = { thin: 1, input: 1.5, outline: 2, focus: 3 } as const;
export const motion = {
  duration: { instant: 90, fast: 150, normal: 220, slow: 320 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0, 0, 0, 1)',
    exit: 'cubic-bezier(0.3, 0, 1, 1)',
  },
  spring: { damping: 22, stiffness: 260, mass: 0.82 },
  springGentle: { damping: 24, stiffness: 190, mass: 0.9 },
  pressScale: 0.97,
  swipe: { distanceRatio: 0.22, velocity: 720, edgeResistance: 0.24 },
} as const;
export const shadows = {
  soft: { shadowColor: primitiveColors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 18, elevation: 2 },
  cssSoft: '0 4px 18px rgba(20,32,29,.05)',
} as const;
export const breakpoints = { narrow: 374, mobile: 680, tablet: 900, desktop: 1200, wide: 1440 } as const;
export const layout = { mobileGutter: 16, tabletGutter: 24, desktopGutter: 32, contentMax: 1200 } as const;

export const typography = {
  family: {
    regular: 'NotoKufiArabic', medium: 'NotoKufiArabic', semibold: 'NotoKufiArabic', bold: 'NotoKufiArabic',
    latin: 'Manrope', web: '"Manrope", "NotoKufiArabic", system-ui, sans-serif',
  },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800' },
  size: { caption: 13, small: 14, body: 16, button: 15, large: 18, h3: 20, h2: 24, h1: 36, display: 56 },
  lineHeight: { caption: 20, small: 22, body: 28, button: 22, large: 30, h3: 30, h2: 36, h1: 48, display: 64 },
} as const;

export const cssVariables = `
:root {
  --emerald-50: ${primitiveColors.emerald50}; --emerald-100: ${primitiveColors.emerald100}; --emerald-200: ${primitiveColors.emerald200};
  --emerald-300: ${primitiveColors.emerald300}; --emerald-400: ${primitiveColors.emerald400}; --emerald-500: ${primitiveColors.emerald500};
  --emerald-600: ${primitiveColors.emerald600}; --emerald-700: ${primitiveColors.emerald700}; --emerald-800: ${primitiveColors.emerald800}; --emerald-900: ${primitiveColors.emerald900};
  --saffron-50: ${primitiveColors.saffron50}; --saffron-100: ${primitiveColors.saffron100}; --saffron-200: ${primitiveColors.saffron200};
  --saffron-300: ${primitiveColors.saffron300}; --saffron-400: ${primitiveColors.saffron400}; --saffron-500: ${primitiveColors.saffron500};
  --saffron-600: ${primitiveColors.saffron600}; --saffron-700: ${primitiveColors.saffron700};
  --neutral-0: ${primitiveColors.neutral0}; --cream: ${primitiveColors.cream}; --neutral-100: ${primitiveColors.neutral100};
  --neutral-200: ${primitiveColors.neutral200}; --neutral-400: ${primitiveColors.neutral400}; --neutral-600: ${primitiveColors.neutral600};
  --neutral-800: ${primitiveColors.neutral800}; --ink: ${primitiveColors.ink}; --mint: ${primitiveColors.mint};
  --color-bg: ${lightColors.background}; --color-bg-subtle: ${lightColors.backgroundSubtle}; --color-surface: ${lightColors.surface};
  --color-surface-muted: ${lightColors.surfaceMuted}; --color-border: ${lightColors.border}; --color-text: ${lightColors.text};
  --color-text-muted: ${lightColors.textMuted}; --color-text-disabled: ${lightColors.textDisabled}; --color-primary: ${lightColors.primary};
  --color-primary-hover: ${lightColors.primaryHover}; --color-primary-pressed: ${lightColors.primaryPressed}; --color-on-primary: ${lightColors.onPrimary};
  --color-primary-soft: ${lightColors.primarySoft}; --color-on-primary-soft: ${lightColors.onPrimarySoft}; --color-accent: ${lightColors.accent};
  --color-accent-hover: ${lightColors.accentHover}; --color-on-accent: ${lightColors.onAccent}; --color-success: ${lightColors.success};
  --color-warning: ${lightColors.warning}; --color-error: ${lightColors.error}; --color-info: ${lightColors.info}; --color-focus-ring: ${lightColors.focusRing};
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 14px; --radius-xl: 18px; --radius-2xl: 22px; --radius-pill: 999px;
  --shadow-soft: ${shadows.cssSoft};
  --motion-fast: ${motion.duration.fast}ms; --motion-normal: ${motion.duration.normal}ms; --motion-slow: ${motion.duration.slow}ms;
  --motion-ease-standard: ${motion.easing.standard}; --motion-ease-enter: ${motion.easing.enter}; --motion-ease-exit: ${motion.easing.exit};
}
`;
