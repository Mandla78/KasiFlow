import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { USE_MOCK_AUTH } from '@/constants/config';
import { useSession } from '@/features/auth/session/SessionProvider';
import { businessProfileApi } from '@/features/onboarding/api/businessProfileApi';
import { ApiError } from '@/shared/api/client';
import { colors, fonts, radius } from '@/shared/theme/tokens';

const SIZE = 60;

/**
 * The business's profile photo: tap to add or change it, with a small
 * "Remove" under it once there is one. Square-cropped on the phone, then
 * uploaded straight to Cloudinary (see businessProfileApi).
 */
export function ProfilePhoto() {
  const { profile, updateProfile } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const url = profile.profileImageUrl;

  async function pick() {
    setError('');
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (picked.canceled || !picked.assets[0]) return;
    const uri = picked.assets[0].uri;
    if (USE_MOCK_AUTH) return updateProfile({ profileImageUrl: uri });
    setBusy(true);
    try {
      const saved = await businessProfileApi.uploadProfileImage(uri);
      updateProfile({ profileImageUrl: saved.profile_image_url });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : `Couldn't upload the photo. Try again.${__DEV__ && e instanceof Error ? ` (${e.message})` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError('');
    if (USE_MOCK_AUTH) return updateProfile({ profileImageUrl: null });
    setBusy(true);
    try {
      await businessProfileApi.removeProfileImage();
      updateProfile({ profileImageUrl: null });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't remove the photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={pick} disabled={busy} accessibilityRole="button" accessibilityLabel={url ? 'Change profile photo' : 'Add profile photo'}>
        <View style={styles.avatar}>
          {url ? (
            <Image source={{ uri: url }} style={styles.photo} />
          ) : (
            <Text style={styles.initial}>{(profile.businessName[0] ?? 'A').toUpperCase()}</Text>
          )}
          {busy ? (
            <View style={styles.veil}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : null}
        </View>
        <View style={styles.camera}>
          <Feather name="camera" size={12} color={colors.white} />
        </View>
      </Pressable>
      {url && !busy ? (
        <Pressable onPress={remove} hitSlop={8}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, maxWidth: 110 },
  avatar: { width: SIZE, height: SIZE, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: SIZE, height: SIZE },
  initial: { fontFamily: fonts.display, fontSize: 24, color: colors.white },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center' },
  camera: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.porcelain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, textDecorationLine: 'underline' },
  error: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.garnet, textAlign: 'center' },
});
