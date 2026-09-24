/**
 * A choice question that looks exactly like a text field: label above, a
 * box showing the answer (or "Tap to choose"). Tapping opens a sheet of
 * options. One field shape for every question keeps a sign-up flow
 * reading as one flow, instead of chips on one screen and cards on the
 * next. Options only, never free text.
 */
import { Feather } from '@expo/vector-icons';
import { ComponentProps, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import { colors, fonts, radius, sizes } from '@/shared/theme/tokens';

type IconName = ComponentProps<typeof Feather>['name'];

export type SelectOption<T extends string> = { value: T; label: string; subtitle?: string; icon?: IconName };

type Common<T extends string> = {
  label: string;
  /** Title of the sheet; defaults to the label. */
  sheetTitle?: string;
  placeholder?: string;
  options: SelectOption<T>[];
  optional?: boolean;
  error?: string;
};

type Single<T extends string> = Common<T> & { multiple?: false; value: T | null; onChange: (v: T) => void };
type Multiple<T extends string> = Common<T> & { multiple: true; value: T[]; onChange: (v: T[]) => void };

export function SelectField<T extends string>(props: Single<T> | Multiple<T>) {
  const { label, sheetTitle, placeholder = 'Tap to choose', options, optional, error } = props;
  const [open, setOpen] = useState(false);
  // Multi-select edits a draft and commits on Done, so closing the sheet
  // by tapping outside doesn't half-apply a change.
  const [draft, setDraft] = useState<T[]>([]);

  const selected: T[] = props.multiple ? props.value : props.value ? [props.value] : [];
  const picked = options.filter((o) => selected.includes(o.value));
  const summary =
    picked.length === 0
      ? null
      : props.multiple
        ? picked.length <= 2
          ? picked.map((p) => p.label).join(', ')
          : `${picked.length} chosen · ${picked[0].label}, ${picked[1].label}…`
        : picked[0].label;

  function openSheet() {
    setDraft(selected);
    setOpen(true);
  }

  function choose(v: T) {
    if (props.multiple) {
      setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));
    } else {
      props.onChange(v);
      setOpen(false);
    }
  }

  const current = props.multiple ? draft : selected;
  const leadIcon = !props.multiple && picked[0]?.icon;

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${summary ? `: ${summary}` : ''}`}
        onPress={openSheet}
        style={[styles.box, !!error && { borderColor: colors.garnet }]}>
        {leadIcon ? <Feather name={leadIcon} size={17} color={colors.ink} /> : null}
        <Text style={[styles.value, !summary && styles.placeholder]} numberOfLines={1}>
          {summary ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{sheetTitle ?? label}</Text>
            {props.multiple ? <Text style={styles.sheetHint}>Choose all that apply</Text> : null}
            <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingBottom: 6 }}>
              {options.map((o, i) => {
                const on = current.includes(o.value);
                return (
                  <Pressable
                    key={o.value}
                    accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
                    accessibilityState={props.multiple ? { checked: on } : { selected: on }}
                    onPress={() => choose(o.value)}
                    style={[styles.option, i < options.length - 1 && styles.optionRule]}>
                    {o.icon ? (
                      <View style={[styles.optIcon, on && { backgroundColor: colors.accentTint }]}>
                        <Feather name={o.icon} size={17} color={on ? colors.accentDeep : colors.ink} />
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optLabel}>{o.label}</Text>
                      {o.subtitle ? <Text style={styles.optSub}>{o.subtitle}</Text> : null}
                    </View>
                    {props.multiple ? (
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on ? <Feather name="check" size={14} color={colors.white} /> : null}
                      </View>
                    ) : (
                      <View style={[styles.radio, on && { borderColor: colors.accent }]}>{on ? <View style={styles.dot} /> : null}</View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            {props.multiple ? (
              <Button
                title={draft.length ? `Done · ${draft.length} chosen` : 'Done'}
                onPress={() => {
                  (props as Multiple<T>).onChange(draft);
                  setOpen(false);
                }}
              />
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  optional: { fontFamily: fonts.medium, color: colors.textMuted },
  box: {
    height: sizes.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  value: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  placeholder: { color: colors.textFaint },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.garnet },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 10, marginBottom: 4 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.3, color: colors.ink },
  sheetHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: -4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  optionRule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  optIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.iconTile, alignItems: 'center', justifyContent: 'center' },
  optLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  optSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
