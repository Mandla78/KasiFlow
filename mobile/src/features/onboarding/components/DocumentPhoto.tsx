import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

/**
 * Photo of a business document. Kept on the phone for now; once uploads
 * exist it goes to Cloudinary with a malware scan before anyone sees it.
 */
export function DocumentPhoto({ uri, onChange, label }: { uri: string | null; onChange: (uri: string | null) => void; label: string }) {
  async function take() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return choose();
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) onChange(r.assets[0].uri);
  }

  async function choose() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) onChange(r.assets[0].uri);
  }

  if (uri) {
    return (
      <View style={styles.picked}>
        <Image source={{ uri }} style={styles.thumb} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{label}</Text>
          <Text style={styles.pending}>Pending review</Text>
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel="Remove photo">
          <Feather name="trash-2" size={18} color={colors.garnet} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable onPress={take} style={styles.btn}>
        <Feather name="camera" size={16} color={colors.ink} />
        <Text style={styles.btnText}>Take photo</Text>
      </Pressable>
      <Pressable onPress={choose} style={styles.btn}>
        <Feather name="image" size={16} color={colors.ink} />
        <Text style={styles.btnText}>Choose photo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    backgroundColor: colors.white,
  },
  btnText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.iconTile },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  pending: { fontFamily: fonts.semibold, fontSize: 12, color: colors.marigoldDeep, marginTop: 2 },
});
