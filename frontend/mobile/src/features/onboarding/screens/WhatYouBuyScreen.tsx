import { router } from 'expo-router';
import { useState } from 'react';

import { defaultCategories } from '@/constants/businessTypes';
import { CATEGORIES, CategoryCode } from '@/constants/categories';
import type { Buying } from '@/features/auth/types';
import { useSession } from '@/features/auth/session/SessionProvider';
import { SelectField, SelectOption } from '@/shared/components/SelectField';

import { StepScaffold } from '../components/StepScaffold';

type NN<K extends keyof Buying> = NonNullable<Buying[K]>;

const FULFIL: SelectOption<NN<'fulfilment'>>[] = [
  { value: 'delivery', label: 'Delivered to me', icon: 'truck' },
  { value: 'collect', label: 'I collect it myself', icon: 'map-pin' },
  { value: 'either', label: 'Either', icon: 'repeat' },
];
const RESTOCK: SelectOption<NN<'restock'>>[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'fortnightly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month' },
];

/** Step 4, the last: what the trader buys. It feeds the supplier engine behind the Suppliers tab. */
export default function WhatYouBuyScreen({ editing = false }: { editing?: boolean }) {
  const { profile, updateProfile, finishOnboarding } = useSession();
  const suggested = profile.businessType ? defaultCategories(profile.businessType, profile.trade) : [];
  const [categories, setCategories] = useState<CategoryCode[]>(profile.categories.length ? profile.categories : suggested);
  const [b, setB] = useState<Buying>(profile.buying);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof Buying>(k: K) => (v: NN<K>) => setB((x) => ({ ...x, [k]: v }));

  // Suggested categories first, marked, then the rest.
  const categoryOptions: SelectOption<CategoryCode>[] = [
    ...CATEGORIES.filter((c) => suggested.includes(c.code)).map((c) => ({ value: c.code, label: c.label, icon: c.icon, subtitle: 'Suggested for you' })),
    ...CATEGORIES.filter((c) => !suggested.includes(c.code)).map((c) => ({ value: c.code, label: c.label, icon: c.icon })),
  ];

  const errors = {
    categories: categories.length === 0 ? 'Choose at least one' : '',
    fulfilment: !b.fulfilment ? 'Choose one' : '',
  };
  const e = (k: keyof typeof errors) => (touched ? errors[k] : '');

  function next() {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    updateProfile({ categories, buying: b });
    if (editing) return router.back();
    finishOnboarding();
  }

  return (
    <StepScaffold
      step="whatYouBuy"
      title="What you buy"
      why={[
        'In the Suppliers tab we show you suppliers near you who sell what you need and can reach you. You keep ordering from your own suppliers too.',
        'How often you restock helps us remind you at the right time. Suppliers never see it.',
      ]}
      primaryLabel="Open my business"
      onPrimary={next}
      editing={editing}>
      <SelectField<CategoryCode>
        multiple
        label="What do you buy for your business?"
        sheetTitle="What do you buy?"
        options={categoryOptions}
        value={categories}
        onChange={setCategories}
        error={e('categories')}
      />
      <SelectField label="How do you get your stock?" options={FULFIL} value={b.fulfilment} onChange={set('fulfilment')} error={e('fulfilment')} />
      <SelectField label="How often do you restock?" optional options={RESTOCK} value={b.restock} onChange={set('restock')} />
    </StepScaffold>
  );
}
