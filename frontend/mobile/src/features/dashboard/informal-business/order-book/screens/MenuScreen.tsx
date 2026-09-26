import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmountField } from '@/features/dashboard/informal-business/credit-book/components/AmountField';
import { centsToInput, parseRand } from '@/features/dashboard/informal-business/credit-book/lib/amounts';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { ConfirmSheet, Sheet } from '@/shared/components/Sheet';
import { Overline, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { LETTERS, open, saveMenu, setLetter, useCounter } from '../lib/counterStore';
import { INGREDIENTS, ingredientLabel, MAX_ITEMS, MAX_PRICE_CENTS, menuProblem, NAME_MAX, STARTERS } from '../lib/menus';
import type { Ingredient, MenuItemInput } from '../types';

type Draft = MenuItemInput & { key: string };
const keyed = (items: MenuItemInput[]): Draft[] => items.map((it, i) => ({ ...it, key: it.id ?? `new-${i}-${Date.now()}` }));

/**
 * The menu: items with a price, set up once and changed any time. A
 * starter menu makes setup 30 seconds. Each item can list its main
 * ingredients (quarter loaf, chips, polony...): that's what helps us
 * suggest suppliers for what you'll need. A price change never changes
 * orders already taken.
 */
export default function MenuScreen() {
  const { menu, letter } = useCounter();
  const [items, setItems] = useState<Draft[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [starter, setStarter] = useState<(typeof STARTERS)[number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!menu) void open();
  }, [menu]);

  const list = items ?? (menu ? keyed(menu) : null);
  const changed = items !== null;

  async function save() {
    if (!list || saving) return;
    const problem = menuProblem(list);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveMenu(list.map(({ key: _key, ...it }) => it));
      router.back();
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiError ? err.message : "Couldn't save the menu. It needs a signal: try again in a moment.");
    }
  }

  return (
    <Screen back footer={changed ? <Button title="Save the menu" loading={saving} onPress={save} /> : undefined}>
      <Title>Menu</Title>

      {list && list.length === 0 ? <Text style={styles.body}>Start from a menu like yours, then change the names and prices.</Text> : null}

      <View style={styles.section}>
        <Overline>Start from a menu</Overline>
        <View style={{ gap: 8 }}>
          {STARTERS.map((s) => (
            <Pressable key={s.key} accessibilityRole="button" onPress={() => (list && list.length ? setStarter(s) : setItems(keyed(s.items)))} style={styles.starter}>
              <View style={{ flex: 1 }}>
                <Text style={styles.starterTitle}>{s.label}</Text>
                <Text style={styles.small}>{s.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>
      </View>

      {list && list.length ? (
        <View style={styles.section}>
          <Overline>Your items ({list.length})</Overline>
          <Card style={{ paddingVertical: 0 }}>
            {list.map((it, i) => (
              <Pressable key={it.key} accessibilityRole="button" accessibilityLabel={`Change ${it.name}`} onPress={() => setEditing(it)} style={[styles.item, i < list.length - 1 && styles.rule]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  {it.ingredients.length ? (
                    <Text style={styles.small} numberOfLines={1}>
                      {it.ingredients.map(ingredientLabel).join(', ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.price}>{formatRand(it.priceCents)}</Text>
                <Feather name="edit-2" size={16} color={colors.textFaint} />
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}

      {list && list.length < MAX_ITEMS ? (
        <Button title="Add an item" icon="plus" variant="secondary" onPress={() => setEditing({ key: `new-${Date.now()}`, name: '', priceCents: 0, ingredients: [] })} />
      ) : null}

      {error ? <InfoNote icon="alert-circle">{error}</InfoNote> : null}

      <View style={styles.section}>
        <Overline>This phone&apos;s letter</Overline>
        <Text style={styles.small}>
          Two phones in one shop? Give each a letter. Orders taken with no signal are called A1, A2 on this phone (B1, B2 on the other) until they get their number.
        </Text>
        <View style={styles.chips}>
          {LETTERS.map((l) => (
            <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: letter === l }} onPress={() => void setLetter(l)} style={[styles.chip, letter === l && styles.chipOn]}>
              <Text style={[styles.chipText, letter === l && styles.chipTextOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {editing ? (
        <ItemSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(it) => {
            const base = list ?? [];
            setItems(base.some((x) => x.key === it.key) ? base.map((x) => (x.key === it.key ? it : x)) : [...base, it]);
            setEditing(null);
          }}
          onRemove={
            list?.some((x) => x.key === editing.key)
              ? () => {
                  setItems((list ?? []).filter((x) => x.key !== editing.key));
                  setEditing(null);
                }
              : undefined
          }
        />
      ) : null}

      {starter ? (
        <ConfirmSheet
          visible
          title={`Start again from "${starter.label}"?`}
          message="Your items are replaced (nothing is saved until you tap Save). Orders already taken keep their prices."
          confirmLabel="Use this menu"
          onCancel={() => setStarter(null)}
          onConfirm={() => {
            setItems(keyed(starter.items));
            setStarter(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function ItemSheet({ item, onClose, onSave, onRemove }: { item: Draft; onClose: () => void; onSave: (d: Draft) => void; onRemove?: () => void }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.priceCents ? centsToInput(item.priceCents) : '');
  const [ingredients, setIngredients] = useState<Ingredient[]>(item.ingredients);
  const cents = parseRand(price);
  const nameOk = /\p{L}/u.test(name.trim());
  const priceOk = cents !== null && cents > 0 && cents <= MAX_PRICE_CENTS;

  return (
    <Sheet visible onClose={onClose}>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.sheetTitle}>{item.name ? `Change ${item.name}` : 'New item'}</Text>
      <TextField label="Name" value={name} onChangeText={setName} maxLength={NAME_MAX} placeholder="Russian kota" />
      <AmountField label="Price" value={price} onChangeText={setPrice} error={price.trim() && !priceOk ? 'A price up to R2,000' : undefined} />
      <Text style={styles.label}>
        Main ingredients <Text style={styles.small}>(optional: helps suggest suppliers)</Text>
      </Text>
      <View style={styles.chips}>
        {INGREDIENTS.map((g) => {
          const on = ingredients.includes(g.key);
          return (
            <Pressable
              key={g.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => setIngredients((cur) => (on ? cur.filter((x) => x !== g.key) : [...cur, g.key]))}
              style={[styles.smallChip, on && styles.chipOn]}>
              <Text style={[styles.smallChipText, on && styles.chipTextOn]}>{g.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button title="Done" disabled={!nameOk || !priceOk} onPress={() => onSave({ ...item, name: name.trim(), priceCents: cents ?? 0, ingredients })} />
      {onRemove ? <Button title="Take it off the menu" variant="secondary" onPress={onRemove} /> : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text },
  section: { gap: 8 },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  starter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  starterTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minHeight: 56 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  itemName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  price: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 52, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  chipTextOn: { color: colors.white },
  smallChip: { minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  smallChipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  sheetTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
});
