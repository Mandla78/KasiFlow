import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { BackButton } from '@/shared/components/Screen';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { jobsApi } from '../api/jobsApi';
import { Job } from '../types';

/**
 * Stage photo (PDF p13). CAMERA ONLY: the phone's camera opens straight
 * away (ImagePicker.launchCameraAsync, already in the dev build) and there
 * is no gallery option anywhere, so an old photo can't stand in for today's
 * work. The time is taken when the photo is, and the server stamps its own
 * on upload (docs/teammate/feedback/FINDING_stage_photos.txt).
 */
export default function StagePhotoScreen() {
  const { id, stageId } = useLocalSearchParams<{ id: string; stageId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [shot, setShot] = useState<{ uri: string; takenAt: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [needsSettings, setNeedsSettings] = useState(false);

  useEffect(() => {
    let live = true;
    jobsApi
      .get(id ?? '')
      .then((j) => live && setJob(j))
      .catch(() => live && setMessage("Couldn't open this job. Go back and try again."));
    return () => {
      live = false;
    };
  }, [id]);

  const stage = job?.stages.find((s) => s.id === stageId);

  async function take() {
    setMessage('');
    const access = await ImagePicker.requestCameraPermissionsAsync();
    if (!access.granted) {
      setNeedsSettings(!access.canAskAgain);
      return setMessage('Allow the camera to take stage photos.');
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setShot({ uri: result.assets[0].uri, takenAt: new Date().toISOString() });
  }

  async function use() {
    if (!shot || !job || !stage || saving) return;
    setSaving(true);
    setMessage('');
    try {
      await jobsApi.addStagePhoto(job.id, stage.id, shot);
      router.back();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Couldn't save the photo. Try again.");
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.head}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{stage ? `${stage.name} stage` : 'Stage photo'}</Text>
          {job ? <Text style={styles.sub}>{`${job.clientName} ${job.title.toLowerCase()}`}</Text> : null}
        </View>
      </View>

      <View style={styles.frame}>
        {shot ? (
          <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="The photo you took" />
        ) : !job ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Feather name="camera" size={40} color="rgba(255,255,255,0.35)" />
        )}
        <View style={styles.chip}>
          <Text style={styles.chipText}>{shot ? 'Your photo' : 'Camera view'}</Text>
        </View>
      </View>

      <View style={styles.notes}>
        <Line icon="lock" text="Camera only. Photos from your gallery can't be used." />
        <Line icon="shield" text="The time is stamped when you take it." />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {needsSettings ? (
          <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()}>
            <Text style={styles.link}>Open settings</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.bottom}>
        {shot ? (
          <View style={{ gap: 10, alignSelf: 'stretch' }}>
            <Button title="Use this photo" icon="check" variant="accent" onPress={use} loading={saving} />
            <Button title="Retake" icon="camera" variant="secondary" onPress={take} disabled={saving} />
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Take the photo" disabled={!stage} onPress={take} style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.8 }]}>
            <View style={styles.shutterInner} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function Line({ icon, text }: { icon: 'lock' | 'shield'; text: string }) {
  return (
    <View style={styles.line}>
      <Feather name={icon} size={14} color="rgba(255,255,255,0.8)" />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  sub: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  frame: {
    flex: 1,
    margin: 20,
    marginBottom: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.inkSoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: { position: 'absolute', left: 12, bottom: 12, backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  notes: { paddingHorizontal: 20, gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: 'rgba(255,255,255,0.85)' },
  message: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.marigold },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.white, textDecorationLine: 'underline', paddingVertical: 8 },
  bottom: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.white },
});
