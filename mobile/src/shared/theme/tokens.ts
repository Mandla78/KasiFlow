/**
 * Design tokens, taken from the Akayza logo (assets/akayza-images):
 * navy for text and main actions, emerald for progress and "done", amber
 * only for things that need attention. Clean light background.
 *
 * Key names are kept stable so screens don't churn when values change.
 */
export const colors = {
  ink: '#0F172A', // brand navy: text, primary buttons, headers
  inkSoft: '#1E293B',
  accent: '#10B981', // brand emerald: progress, selected, success
  accentDeep: '#059669',
  accentTint: '#D1FAE5',
  marigold: '#F59E0B', // brand amber: attention only (due today, pending)
  marigoldDeep: '#B45309',
  marigoldTint: '#FEF3C7',
  jade: '#059669',
  jadeTint: '#D1FAE5',
  garnet: '#DC2626',
  garnetTint: '#FEE2E2',
  porcelain: '#F8FAFC', // app background
  line: '#E2E8F0',
  white: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  iconTile: '#F1F5F9',
  infoTint: '#F1F5F9',
  overlay: 'rgba(15, 23, 42, 0.5)',
} as const;

export const fonts = {
  // Titles and money: the wordmark's heavy sans, so text matches the logo.
  display: 'PlusJakartaSans_800ExtraBold',
  body: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Logo colours for the mark, wordmark, icon and splash. */
export const brand = {
  navy: '#0F172A',
  slate: '#1E293B',
  emerald: '#10B981',
  emeraldLight: '#34D399',
  emeraldDeep: '#059669',
  amber: '#F59E0B',
  amberLight: '#FBBF24',
  white: '#F8FAFC',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 18, pill: 999 } as const;

// Big targets: buttons 52 px high, inputs 50.
export const sizes = { button: 52, input: 50, iconButton: 36, tile: 40 } as const;
