import { router } from 'expo-router';
import { useState } from 'react';

import type { Place } from '@/features/auth/types';
import { useSession } from '@/features/auth/session/SessionProvider';
import { TextField } from '@/shared/components/TextField';
import { AddressPickerField } from '@/shared/location-picker/components/AddressPickerField';

import { StepScaffold } from '../components/StepScaffold';

/** Step 3: where the business is (a pin the trader confirms). Delivery addresses come later, with orders. */
export default function WhereYouAreScreen() {
  const { profile, updateProfile } = useSession();
  const isBuilder = profile.businessType === 'builder';
  const [place, setPlace] = useState<Place | null>(profile.location);
  const [landmark, setLandmark] = useState(profile.landmark);
  const [touched, setTouched] = useState(false);

  const placeError = !place ? 'Set your business location to continue' : '';

  function next() {
    setTouched(true);
    if (placeError) return;
    updateProfile({ location: place, landmark: landmark.trim() });
    router.push('/what-you-buy');
  }

  return (
    <StepScaffold
      step="whereYouAre"
      title="Where you are"
      why={[
        'Your pin is how we find suppliers who deliver to you, and how drivers find your door. Township addresses are often hard to find, so the pin matters more than the street name.',
        'Suppliers only see your area, and your address when you order from them.',
      ]}
      onPrimary={next}>
      <AddressPickerField
        label={isBuilder ? 'Your base or yard' : 'Your shop'}
        value={place}
        onChange={setPlace}
        mapTitle="Your business location"
        confirmLabel="Confirm location"
        error={touched ? placeError : ''}
      />
      <TextField
        label="Landmark or directions"
        optional
        value={landmark}
        onChangeText={setLandmark}
        placeholder="e.g. Next to the blue container"
      />
    </StepScaffold>
  );
}
