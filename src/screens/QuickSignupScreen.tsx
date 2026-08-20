import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { authService, MIN_PASSWORD_LENGTH } from '../services/authService';
import { dataStorage, AccountInfo } from '../services/dataStorage';
import { AccountReceipt, readReceipt } from '../components/AccountReceipt';
import { PasswordRecoveryModal } from '../components/PasswordRecoveryModal';
import { TRIAL_DAYS } from '../utils/trial';

interface QuickSignupScreenProps {
  prefilledName?: string;
  onComplete: () => void; // both success and skip resolve here
}

type Receipt = Awaited<ReturnType<typeof readReceipt>>;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const QuickSignupScreen: React.FC<QuickSignupScreenProps> = ({
  prefilledName,
  onComplete,
}) => {
  const [name, setName] = useState(prefilledName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerRecovery, setOfferRecovery] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const canSubmit =
    name.trim().length > 0 &&
    isValidEmail(email) &&
    password.length >= MIN_PASSWORD_LENGTH &&
    !submitting;

  const finish = async (session: Session, kind: 'new' | 'returning') => {
    const accountInfo: AccountInfo = {
      name: name.trim(),
      email: (session.user.email || email.trim()).toLowerCase(),
      phoneNumber: phone.trim() || undefined,
      supabaseUserId: session.user.id,
    };
    await dataStorage.saveAccountInfo(accountInfo);

    setReceipt(await readReceipt(kind));
    setSubmitting(false);
  };

  const handleContinue = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setOfferRecovery(false);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error: signUpError } = await authService.signUp(cleanEmail, password);

      if (signUpError) {
        const msg = signUpError.message || '';
        // One door. The email is already hers, so try the password she just
        // typed against the account that exists rather than bouncing her out of
        // onboarding to find a sign in screen somewhere else.
        if (/already|registered/i.test(msg)) {
          const { data: signInData, error: signInError } = await authService.signIn(cleanEmail, password);
          if (signInData?.session && !signInError) {
            await finish(signInData.session, 'returning');
            return;
          }
          setError('That email already has a Track account and this password does not open it.');
          setOfferRecovery(true);
          setSubmitting(false);
          return;
        }
        setError(msg || 'Could not create your account. Try again.');
        setSubmitting(false);
        return;
      }

      if (!data?.session) {
        // No session means Supabase has "Confirm email" ON. Do NOT persist email
        // as a signed-in identity: that marks the user signed in and premium
        // before the account is usable. We agreed verification is OFF for
        // launch, so this is a safety net. Keep just the name so onboarding
        // survives, tell them to confirm, continue as a guest.
        if (__DEV__) console.warn('[QuickSignup] no session returned — check Supabase Auth > Providers > Email > Confirm email = OFF');
        await dataStorage.saveAccountInfo({ name: name.trim() });
        setSubmitting(false);
        Alert.alert(
          'Confirm your email',
          `We sent a confirmation link to ${cleanEmail}. Tap it, then sign in from Settings with the password you just picked.`
        );
        onComplete();
        return;
      }

      await finish(data.session, 'new');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip for now?',
      "Your data will stay on this device only. If you clear your browser or reinstall, you'll lose your plan.",
      [
        { text: 'Go back', style: 'cancel' },
        { text: 'Skip anyway', style: 'destructive', onPress: onComplete },
      ],
    );
  };

  if (receipt) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: Acid.moss }]} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.iconWrap, { backgroundColor: Acid.mossDeep }]}>
            <Feather name="check" size={36} color={Acid.lime} />
          </View>

          <AccountReceipt kind={receipt.kind} trial={receipt.trial} premium={receipt.premium} />

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: Acid.lime }]}
            onPress={onComplete}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryBtnText, { color: Acid.moss }]}>Start tracking</Text>
            <Feather name="arrow-right" size={18} color={Acid.moss} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Acid.moss }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.iconWrap, { backgroundColor: Acid.mossDeep }]}>
            <Feather name="unlock" size={36} color={Acid.lime} />
          </View>

          <Text style={[styles.title, { color: Acid.tx }]}>Start your three weeks</Text>
          <Text style={[styles.subtitle, { color: Acid.tx2 }]}>
            No card. This email and password are your Track account, in both apps.
          </Text>

          {/* The offer, said before the fields rather than discovered after
              them. The gym line is the reason this beats "save your plan" */}
          <View style={styles.offer}>
            {[
              { icon: 'zap', text: `Everything in TrackKcal, on for ${TRIAL_DAYS} days` },
              { icon: 'activity', text: 'TrackLifts unlocked at the same time, same account' },
              { icon: 'cloud', text: 'Your goals and meals kept across devices' },
            ].map(row => (
              <View key={row.text} style={styles.offerRow}>
                <Feather name={row.icon as any} size={14} color={Acid.lime} />
                <Text style={styles.offerText}>{row.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.fields}>
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
            />
            <Field
              label="Email"
              value={email}
              onChangeText={(v) => { setEmail(v); setOfferRecovery(false); }}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoCorrect={false}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={(v) => { setPassword(v); setOfferRecovery(false); }}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              secureTextEntry
            />
            <Field
              label="Mobile (optional)"
              value={phone}
              onChangeText={setPhone}
              placeholder="+971 50 123 4567"
              keyboardType="phone-pad"
              autoCorrect={false}
            />
          </View>

          {error && (
            <Text style={[styles.error, { color: Acid.error }]}>{error}</Text>
          )}

          {offerRecovery && (
            <TouchableOpacity onPress={() => setRecoveryOpen(true)} style={styles.recoveryBtn}>
              <Text style={styles.recoveryText}>EMAIL ME A CODE AND SET A NEW ONE</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              {
                backgroundColor: canSubmit ? Acid.lime : Acid.mossDeep,
              },
            ]}
            onPress={handleContinue}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={Acid.moss} />
            ) : (
              <>
                <Text style={[styles.primaryBtnText, { color: canSubmit ? Acid.moss : Acid.tx3 }]}>
                  Start my three weeks
                </Text>
                <Feather name="arrow-right" size={18} color={canSubmit ? Acid.moss : Acid.tx3} style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
            <Text style={[styles.skipText, { color: Acid.tx3 }]}>Skip, I will stay on the free plan</Text>
          </TouchableOpacity>

          <Text style={[styles.footerNote, { color: Acid.tx3 }]}>
            We use your email to hold your account and your trial. No spam.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <PasswordRecoveryModal
        visible={recoveryOpen}
        initialEmail={email.trim().toLowerCase()}
        onClose={() => setRecoveryOpen(false)}
        onDone={async (session) => {
          setRecoveryOpen(false);
          setError(null);
          setOfferRecovery(false);
          await finish(session, 'returning');
        }}
      />
    </SafeAreaView>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoComplete?: 'email' | 'tel' | 'name' | 'new-password' | 'off';
  autoCorrect?: boolean;
  maxLength?: number;
  secureTextEntry?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, value, onChangeText, placeholder, autoCapitalize, keyboardType, autoComplete, autoCorrect, maxLength, secureTextEntry }) => (
  <View style={styles.fieldWrap}>
    <Text style={[styles.fieldLabel, { color: Acid.tx2 }]}>{label}</Text>
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor: Acid.mossDeep,
          color: Acid.tx,
          borderColor: Acid.hair,
        },
      ]}
      placeholder={placeholder}
      placeholderTextColor={Acid.tx3}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
      maxLength={maxLength}
      secureTextEntry={secureTextEntry}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40, alignItems: 'center' },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 21, marginBottom: 28, paddingHorizontal: 12 },
  offer: {
    width: '100%',
    borderWidth: 1,
    borderColor: Acid.hair2,
    backgroundColor: Acid.limeSoft,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 4,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offerText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    lineHeight: Typography.fontSize.xs * 1.5,
    color: Acid.tx,
  },
  fields: { width: '100%', gap: 14, marginBottom: 8 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: { fontSize: 13, marginTop: 12, textAlign: 'center', alignSelf: 'stretch' },
  recoveryBtn: { marginTop: 10, paddingVertical: 6 },
  recoveryText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Acid.lime,
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryBtnText: { fontSize: Typography.fontSize.md, fontWeight: 'bold' },
  skipBtn: { marginTop: 16, padding: 10 },
  skipText: { fontSize: 14, textDecorationLine: 'underline' },
  footerNote: { fontSize: 12, textAlign: 'center', marginTop: 20, paddingHorizontal: 12 },
});
