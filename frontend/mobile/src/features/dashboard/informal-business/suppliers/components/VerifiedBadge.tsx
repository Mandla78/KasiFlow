import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '@/shared/theme/tokens';

/**
 * The verified seal beside a name. Green, because in Akayza blue is what
 * you can DO (buttons, links) and green is what has been CHECKED. Always
 * beside the name, never on the photo, one look everywhere.
 */
export function VerifiedBadge({ size = 18 }: { size?: number }) {
  return <MaterialCommunityIcons name="check-decagram" size={size} color={colors.jade} accessibilityLabel="Verified" />;
}
