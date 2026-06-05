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
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { authService } from '../services/authService';
import { dataStorage, AccountInfo } from '../services/dataStorage';

interface QuickSignupScreenProps {
  prefilledName?: string;
  onComplete: () => void; // both success and skip resolve here
}

// Cryptographically reasonable random password. User never sees this — auth is
// invisible at signup. If they ever need to sign in elsewhere, they go through
// password reset. Acceptable tradeoff for zero-friction launch onboarding.
function randomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let out = '';
  for (let i = 0; i < 24; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const QuickSignupScreen: React.FC<QuickSignupScreenProps> = ({
  prefilledName,
  onComplete,
}) => {
  const theme = useTheme();

  const [name, setName] = useState(prefilledName || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && isValidEmail(email) && !submitting;

  const handleContinue = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const password = randomPassword();

    try {
      const { data, error: signUpError } = await authService.signUp(cleanEmail, password);

      // Email already registered. There is no sign-in path on this onboarding
      // screen, so we point them to Skip and sign in from Settings. We cannot
      // recover their existing account here without their real password.
      if (signUpError) {
        const msg = signUpError.message || '';
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
          setError('That email already has an account. Tap Skip and sign in from Settings.');
        } else {
          setError(msg || 'Could not create account. Try again.');
        }
        setSubmitting(false);
        return;
      }

      if (!data?.session) {
        // No session means Supabase has "Confirm email" ON. Do NOT persist email
        // as a signed-in identity: that marks the user signed in and premium with
        // a random password they never saw and cannot recover (a ghost account).
        // We agreed verification is OFF for launch, so this is a safety net. Keep
        // just the name so onboarding survives, tell them to confirm, continue as
        // a guest.
        if (__DEV__) console.warn('[QuickSignup] no session returned — check Supabase Auth > Providers > Email > Confirm email = OFF');
        await dataStorage.saveAccountInfo({ name: name.trim() });
        setSubmitting(false);
        Alert.alert(
          'Confirm your email',
          `We sent a confirmation link to ${cleanEmail}. Tap it, then sign in from Settings to finish creating your account.`
        );
        onComplete();
        return;
      }

      const accountInfo: AccountInfo = {
        name: name.trim(),
        email: cleanEmail,
        phoneNumber: phone.trim() || undefined,
        supabaseUserId: data.session.user.id,
      };
      await dataStorage.saveAccountInfo(accountInfo);

      onComplete();
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.input }]}>
            <Feather name="bookmark" size={36} color={theme.colors.primary} />
          </View>

          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Save your plan</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Keep your goals and meals across devices. No password needed.
          </Text>

          <View style={styles.fields}>
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoCorrect={false}
              theme={theme}
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoCorrect={false}
              theme={theme}
            />
            <Field
              label="Mobile (optional)"
              value={phone}
              onChangeText={setPhone}
              placeholder="+971 50 123 4567"
              keyboardType="phone-pad"
              autoCorrect={false}
              theme={theme}
            />
          </View>

          {error && (
            <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              {
                backgroundColor: canSubmit ? theme.colors.primary : theme.colors.input,
              },
            ]}
            onPress={handleContinue}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.primaryForeground} />
            ) : (
              <>
                <Text style={[styles.primaryBtnText, { color: canSubmit ? theme.colors.primaryForeground : theme.colors.textTertiary }]}>
                  Continue
                </Text>
                <Feather name="arrow-right" size={18} color={canSubmit ? theme.colors.primaryForeground : theme.colors.textTertiary} style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
            <Text style={[styles.skipText, { color: theme.colors.textTertiary }]}>Skip for now</Text>
          </TouchableOpacity>

          <Text style={[styles.footerNote, { color: theme.colors.textTertiary }]}>
            We use your email only to save your data. No spam.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  autoComplete?: 'email' | 'tel' | 'name' | 'off';
  autoCorrect?: boolean;
  theme: ReturnType<typeof useTheme>;
}

const Field: React.FC<FieldProps> = ({ label, value, onChangeText, placeholder, autoCapitalize, keyboardType, autoComplete, autoCorrect, theme }) => (
  <View style={styles.fieldWrap}>
    <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor: theme.colors.input,
          color: theme.colors.textPrimary,
          borderColor: theme.colors.border,
        },
      ]}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textTertiary}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
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
