import { router } from 'expo-router';
import { useState } from 'react';

import type { Registration } from '@/features/auth/types';
import { useSession } from '@/features/auth/session/SessionProvider';
import { SelectField } from '@/shared/components/SelectField';
import { TextField } from '@/shared/components/TextField';

import { onboardingApi } from '../api/onboardingApi';
import { StepScaffold } from '../components/StepScaffold';

type Setup = 'cipc' | 'sole' | 'unsure';

const SETUP_OPTIONS: { value: Setup; label: string; subtitle: string }[] = [
  { value: 'cipc', label: 'Company, CC or co-op', subtitle: 'Registered with CIPC' },
  { value: 'sole', label: 'Sole trader', subtitle: 'Just me, not registered with CIPC' },
  { value: 'unsure', label: 'Not sure', subtitle: 'You can add this later' },
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
 * Step 2, OPTIONAL. We only ask for what we can verify against an official
 * source: the CIPC register. Permits, certificates and VAT numbers have no
 * official API, so we don't collect them. The screen says nothing about
 * how or when the number is checked; that happens on the backend.
 */
export default function RegistrationScreen() {
  const { profile, updateProfile, setCipcResult } = useSession();
  const reg = profile.registration;

  const [setup, setSetup] = useState<Setup | null>(reg.cipc ? 'cipc' : reg.soleTrader ? 'sole' : null);
  const [cipcNumber, setCipcNumber] = useState(reg.cipc?.number ?? '');
  const [touched, setTouched] = useState(false);

  const cipcError = setup === 'cipc' && cipcNumber ? cipcFormatError(cipcNumber) : '';

  function save() {
    setTouched(true);
    if (cipcError) return;
    const wantsCheck = setup === 'cipc' && !!cipcNumber;
    // Same number as before: keep its existing result instead of re-checking.
    const unchanged = reg.cipc?.number === cipcNumber;
    const next: Registration = {
      soleTrader: setup === 'sole',
      cipc: wantsCheck ? (unchanged && reg.cipc ? reg.cipc : { number: cipcNumber, status: 'pending' }) : null,
    };
    updateProfile({ registration: next });
    if (wantsCheck && !unchanged) {
      // Stands in for the backend job that checks CIPC after this step is saved.
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
        'This is optional, and you can add it later in More.',
        'A registered company can earn a verified badge that suppliers trust. Most traders are sole traders, and that is normal.',
        'We only ask about the business, never for ID numbers or documents about you.',
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
          error={touched ? cipcError : ''}
        />
      ) : null}
    </StepScaffold>
  );
}
