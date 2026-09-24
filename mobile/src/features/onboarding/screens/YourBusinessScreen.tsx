import { router } from 'expo-router';
import { useState } from 'react';

import { BUSINESS_TYPE_ORDER, BUSINESS_TYPES, BusinessType, TradeKey, TRADES } from '@/constants/businessTypes';
import type { YearsTrading } from '@/features/auth/types';
import { useSession } from '@/features/auth/session/SessionProvider';
import { SelectField } from '@/shared/components/SelectField';
import { TextField } from '@/shared/components/TextField';

import { StepScaffold } from '../components/StepScaffold';

const TYPE_OPTIONS = BUSINESS_TYPE_ORDER.map((t) => ({
  value: t,
  label: BUSINESS_TYPES[t].label,
  subtitle: BUSINESS_TYPES[t].subtitle,
  icon: BUSINESS_TYPES[t].icon,
}));
const TRADE_OPTIONS = TRADES.map((t) => ({ value: t.key, label: t.label }));
const YEARS_OPTIONS: { value: YearsTrading; label: string }[] = [
  { value: 'under_1', label: 'Less than a year' },
  { value: '1_3', label: '1 to 3 years' },
  { value: '3_plus', label: 'More than 3 years' },
];

/** Step 1: what the business is and who runs it. */
export default function YourBusinessScreen() {
  const { profile, updateProfile, setBusinessType, setTrade } = useSession();
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [years, setYears] = useState<YearsTrading | null>(profile.yearsTrading);
  const [cellphone, setCellphone] = useState(profile.cellphone);
  const [touched, setTouched] = useState(false);

  const isBuilder = profile.businessType === 'builder';
  const digits = cellphone.replace(/\D/g, '');
  const errors = {
    type: !profile.businessType ? 'Choose the type that fits best' : '',
    trade: isBuilder && !profile.trade ? 'Choose the work you do' : '',
    name: ownerName.trim().length < 2 ? 'Tell us your name' : '',
    years: !years ? 'Choose one' : '',
    cellphone: cellphone && !(digits.length === 10 && digits.startsWith('0')) ? 'A 10-digit number, like 082 123 4567' : '',
  };
  const e = (k: keyof typeof errors) => (touched ? errors[k] : '');

  function next() {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    updateProfile({ ownerName: ownerName.trim(), yearsTrading: years, cellphone: cellphone.trim() });
    router.push('/registration');
  }

  return (
    <StepScaffold
      step="yourBusiness"
      title="Your business"
      why={[
        'Your business type sets up your tools and decides which suppliers we show you first. Builders see hardware suppliers; spaza shops see wholesalers.',
        'How long you have been trading is shown to suppliers as a simple badge. It helps them trust a new customer.',
        'Your cellphone is optional and only used for delivery calls and WhatsApp receipts, never to sign in or for marketing. We never ask for your ID number.',
      ]}
      onPrimary={next}>
      <SelectField<BusinessType>
        label="What type of business do you run?"
        options={TYPE_OPTIONS}
        value={profile.businessType}
        onChange={setBusinessType}
        error={e('type')}
      />
      {isBuilder ? (
        <SelectField<TradeKey> label="What work do you do?" options={TRADE_OPTIONS} value={profile.trade} onChange={setTrade} error={e('trade')} />
      ) : null}
      <TextField label="Your name" value={ownerName} onChangeText={setOwnerName} autoCapitalize="words" error={e('name')} />
      <SelectField<YearsTrading> label="How long have you been trading?" options={YEARS_OPTIONS} value={years} onChange={setYears} error={e('years')} />
      <TextField
        label="Cellphone"
        optional
        value={cellphone}
        onChangeText={setCellphone}
        keyboardType="phone-pad"
        placeholder="082 123 4567"
        error={e('cellphone')}
      />
    </StepScaffold>
  );
}
