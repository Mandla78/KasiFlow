import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { ConsentCheckbox } from '@/shared/components/ConsentCheckbox';
import { GoogleButton, OrDivider } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { AuthError, authApi } from '@/features/auth/api/authApi';
import { consentNow } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { isEmail, isStrongPassword } from '@/shared/lib/validation';
import { colors, fonts } from '@/shared/theme/tokens';

/** Account stage: business name, email, password, and agreeing to the Privacy Policy and Terms. No SMS. */
export default function CreateAccount() {
  const { startEmailSignUp } = useSession();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [passwordServerError, setPasswordServerError] = useState('');
  const [formError, setFormError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const matches = confirm.length > 0 && confirm === password;
  const errors = {
    businessName: businessName.trim().length < 2 ? 'Give your business a name' : '',
    email: !isEmail(email) ? 'Enter a valid email address' : serverError,
    // One message, shown only after they try: no rule list up front.
    password: !isStrongPassword(password)
      ? 'Use 8 to 64 characters with a capital letter, a small letter, a number and a special character.'
      : '',
    confirm: confirm !== password ? "Passwords don't match" : '',
  };
  const valid = !errors.businessName && !errors.email && !errors.password && !errors.confirm;

  async function submit() {
    setTouched(true);
    setConsentError(!agreed);
    if (!valid || !agreed) return;
    setBusy(true);
    try {
      await authApi.createAccount({ businessName: businessName.trim(), email: email.trim(), password, consent: consentNow() });
      startEmailSignUp(businessName.trim(), email.trim().toLowerCase());
      router.push('/verify-email');
    } catch (e) {
      const message = e instanceof AuthError ? e.message : 'Something went wrong. Try again.';
      if (e instanceof AuthError && e.code === 'WEAK_PASSWORD') setPasswordServerError(message);
      else if (e instanceof AuthError && e.code === 'EMAIL_TAKEN') setServerError(message);
      else setFormError(message); // network, too many attempts, outdated app...
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      back
      footer={
        <>
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <ConsentCheckbox
            checked={agreed}
            onChange={(v) => {
              setAgreed(v);
              if (v) setConsentError(false);
            }}
            error={consentError}
          />
          <Button title="Create account" onPress={submit} loading={busy} disabled={!agreed} />
          <Pressable onPress={() => router.replace('/sign-in')} style={styles.alt}>
            <Text style={styles.altText}>
              Already have an account? <Text style={styles.altLink}>Sign in</Text>
            </Text>
          </Pressable>
        </>
      }>
      <View style={{ gap: 6 }}>
        <Title>Create your account</Title>
      </View>
      <GoogleButton
        onPress={() => {
          // Google sign-up needs the same agreement as email sign-up.
          if (!agreed) {
            setConsentError(true);
            return;
          }
          router.push({ pathname: '/google', params: { consent: '1' } });
        }}
      />
      <OrDivider />
      <TextField
        label="Business name"
        placeholder="e.g. Nomsa's Spaza"
        value={businessName}
        onChangeText={setBusinessName}
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        error={touched ? errors.businessName : ''}
      />
      <TextField
        ref={emailRef}
        label="Email address"
        icon="mail"
        placeholder="you@example.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setServerError('');
        }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={touched || serverError ? errors.email : ''}
      />
      <View style={{ gap: 8 }}>
        <TextField
          ref={passwordRef}
          label="Password"
          password
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setPasswordServerError('');
          }}
          autoComplete="new-password"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          error={touched ? errors.password || passwordServerError : passwordServerError}
        />
      </View>
      <TextField
        ref={confirmRef}
        label="Confirm password"
        password
        value={confirm}
        onChangeText={setConfirm}
        returnKeyType="done"
        onSubmitEditing={submit}
        hint={matches ? 'Passwords match' : undefined}
        error={touched ? errors.confirm : ''}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  alt: { alignItems: 'center', paddingVertical: 4 },
  formError: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet, textAlign: 'center' },
  altText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  altLink: { fontFamily: fonts.bold, color: colors.ink },
});
