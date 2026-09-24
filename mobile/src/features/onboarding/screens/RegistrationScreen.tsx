import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { Registration } from '@/features/auth/types';
import { useSession } from '@/features/auth/session/SessionProvider';
import { SelectField } from '@/shared/components/SelectField';
import { TextField } from '@/shared/components/TextField';

import { onboardingApi } from '../api/onboardingApi';
import { DocumentPhoto } from '../components/DocumentPhoto';
import { StepScaffold } from '../components/StepScaffold';

type Setup = 'cipc' | 'sole' | 'unsure';
type YesNo = 'yes' | 'no';

const SETUP_OPTIONS: { value: Setup; label: string; subtitle: string }[] = [
  { value: 'cipc', label: 'Company, CC or co-op', subtitle: 'Registered with CIPC' },
  { value: 'sole', label: 'Sole trader', subtitle: 'Just me, not registered with CIPC' },
  { value: 'unsure', label: 'Not sure', subtitle: 'You can add this later' },
];
const YES_NO: { value: YesNo; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/** Digits only -> YYYY/NNNNNN/NN as the trader types. */
function formatCipc(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 12);
  if (d.length <= 4) return d;
  if (d.length <= 10) return `${d.slice(0, 4)}/${d.slice(4)}`;
  return `${d.slice(0, 4)}/${d.slice(4, 10)}/${d.slice(10)}`;
}

function cipcFormatError(n: string): string {
  if (!/^\d{4}\/\d{6}\/\d{2}$/.test(n)) return 'Format: YYYY/NNNNNN/NN, e.g. 2020/123456/07';
  const year = Number(n.slice(0, 4));
  if (year < 1900 || year > new Date().getFullYear()) return 'The first four digits are the year it was registered';
  return '';
}

/**
 * Step 2, OPTIONAL: nothing here blocks sign-up. Only CIPC can be checked
 * automatically; permits and certificates stay "pending review" until a
 * person looks, because no API exists for them. We never ask for ID
 * numbers, passports or permits about the person.
 */
export default function RegistrationScreen() {
  const { profile, updateProfile, setCipcResult } = useSession();
  const reg = profile.registration;
  const sellsFood = profile.businessType !== 'builder';

  const [setup, setSetup] = useState<Setup | null>(reg.cipc ? 'cipc' : reg.soleTrader ? 'sole' : null);
  const [cipcNumber, setCipcNumber] = useState(reg.cipc?.number ?? '');

  const [hasPermit, setHasPermit] = useState<YesNo | null>(reg.permit ? 'yes' : null);
  const [permitNumber, setPermitNumber] = useState(reg.permit?.number ?? '');
  const [permitPhoto, setPermitPhoto] = useState<string | null>(reg.permit?.photoUri ?? null);
  const [hasCoa, setHasCoa] = useState<YesNo | null>(reg.coa ? 'yes' : null);
  const [coaPhoto, setCoaPhoto] = useState<string | null>(reg.coa?.photoUri ?? null);
  const [vat, setVat] = useState<YesNo | null>(reg.vatNumber ? 'yes' : null);
  const [vatNumber, setVatNumber] = useState(reg.vatNumber);
  const [touched, setTouched] = useState(false);

  const formatError = cipcFormatError(cipcNumber);
  const vatError = vat === 'yes' && !/^4\d{9}$/.test(vatNumber) ? 'A VAT number is 10 digits and starts with 4' : '';

  const cipcError = setup === 'cipc' && cipcNumber ? formatError : '';

  function save() {
    setTouched(true);
    if (vatError || cipcError) return;
    const wantsCheck = setup === 'cipc' && !!cipcNumber;
    // Same number as before: keep its existing result instead of re-checking.
    const unchanged = reg.cipc?.number === cipcNumber;
    const next: Registration = {
      soleTrader: setup === 'sole',
      cipc: wantsCheck ? (unchanged && reg.cipc ? reg.cipc : { number: cipcNumber, status: 'pending' }) : null,
      permit: hasPermit === 'yes' && permitNumber.trim() ? { number: permitNumber.trim(), photoUri: permitPhoto, status: 'pending_review' } : null,
      coa: sellsFood && hasCoa === 'yes' && coaPhoto ? { photoUri: coaPhoto, status: 'pending_review' } : null,
      vatNumber: vat === 'yes' ? vatNumber : '',
    };
    updateProfile({ registration: next });
    if (wantsCheck && !unchanged) {
      // Stands in for the backend job that checks CIPC after this step is
      // saved. The trader carries on; the answer shows up in More.
      onboardingApi
        .verifyCipc(cipcNumber, profile.ownerName)
        .then((r) => setCipcResult(cipcNumber, r))
        .catch(() => setCipcResult(cipcNumber, { status: 'unavailable', checkedAt: new Date().toISOString() }));
    }
    router.push('/where-you-are');
  }

  return (
    <StepScaffold
      step="registration"
      title="Registration"
      why={[
        'All of this is optional and you can add it later in More. It earns your business a badge suppliers trust.',
        'We check a CIPC number against the official register in the background, and give a Verified badge only when the company is active and you are one of its directors. Most traders are sole traders, who don’t register with CIPC, and that’s normal.',
        profile.businessType === 'spaza'
          ? 'Municipalities require spaza shops to register. A permit photo is reviewed by a person, because there’s no official system to check it automatically.'
          : 'Permit and certificate photos are reviewed by a person, because there’s no official system to check them automatically.',
        'We only ask about the business. We never ask for ID numbers, passports or permits about you.',
      ]}
      onPrimary={save}
      onSkip={() => router.push('/where-you-are')}>
      <SelectField<Setup> label="How is your business set up?" options={SETUP_OPTIONS} value={setup} onChange={setSetup} />

      {setup === 'cipc' ? (
        <TextField
          label="CIPC registration number"
          value={cipcNumber}
          onChangeText={(t) => setCipcNumber(formatCipc(t))}
          keyboardType="number-pad"
          placeholder="2020/123456/07"
          hint="We check this with CIPC in the background. You can carry on."
          error={touched ? cipcError : ''}
        />
      ) : null}

      <SelectField<YesNo>
        label="Municipal trading permit or business licence?"
        sheetTitle="Do you have a trading permit or business licence?"
        optional
        options={YES_NO}
        value={hasPermit}
        onChange={setHasPermit}
      />
      {hasPermit === 'yes' ? (
        <View style={{ gap: 12 }}>
          <TextField label="Permit or licence number" value={permitNumber} onChangeText={setPermitNumber} autoCapitalize="characters" />
          <DocumentPhoto label="Trading permit" uri={permitPhoto} onChange={setPermitPhoto} />
        </View>
      ) : null}

      {sellsFood ? (
        <>
          <SelectField<YesNo>
            label="Certificate of Acceptability?"
            sheetTitle="Do you have a Certificate of Acceptability (food)?"
            optional
            options={YES_NO}
            value={hasCoa}
            onChange={setHasCoa}
          />
          {hasCoa === 'yes' ? <DocumentPhoto label="Certificate of Acceptability" uri={coaPhoto} onChange={setCoaPhoto} /> : null}
        </>
      ) : null}

      <SelectField<YesNo> label="Registered for VAT?" optional options={YES_NO} value={vat} onChange={setVat} />
      {vat === 'yes' ? (
        <TextField
          label="VAT number"
          value={vatNumber}
          onChangeText={(t) => setVatNumber(t.replace(/\D/g, '').slice(0, 10))}
          keyboardType="number-pad"
          placeholder="4123456789"
          error={touched ? vatError : ''}
        />
      ) : null}
    </StepScaffold>
  );
}
