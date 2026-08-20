import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { authService, MIN_PASSWORD_LENGTH } from '../services/authService';

interface PasswordRecoveryModalProps {
  visible: boolean;
  /** Prefilled when we already know who is trying to get in. */
  initialEmail?: string;
  onClose: () => void;
  /** Password set and signed in. The caller persists the account. */
  onDone: (session: Session) => void | Promise<void>;
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// Supabase answers the reset endpoint with a 429 and its own wording when the
// same address asks twice inside a minute. The user does not need the wording.
const isRateLimited = (e: any) =>
  e?.status === 429 || /rate limit|security purposes|too many/i.test(e?.message || '');

/**
 * Recovery by code. Supabase's recovery email carries a six digit token that
 * verifyOtp accepts with type 'recovery', which means the whole thing happens
 * on the screen she is already on. No link, no scheme, no bounce out of the app.
 */
export const PasswordRecoveryModal: React.FC<PasswordRecoveryModalProps> = ({
  visible,
  initialEmail,
  onClose,
  onDone,
}) => {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState(initialEmail || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep('request');
    setEmail(initialEmail || '');
    setCode('');
    setPassword('');
    setError(null);
    setNotice(null);
  }, [visible, initialEmail]);

  const sendCode = async () => {
    const clean = email.trim().toLowerCase();
    if (!isValidEmail(clean)) {
      setError('That does not look like an email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: sendError } = await authService.resetPasswordForEmail(clean);
      if (sendError) throw sendError;
      setStep('verify');
      setNotice(`We sent a six digit code to ${clean}. Check spam if it is not there.`);
    } catch (e: any) {
      setError(isRateLimited(e) ? 'Too many tries. Give it a minute.' : e?.message || 'Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (code.trim().length < 6) {
      setError('Enter the six digit code from the email.');
      return;
    }
    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: verifyError } = await authService.verifyRecoveryCode(email, code);
      if (verifyError || !data?.session) {
        setError('That code is wrong or it has expired. Send a new one.');
        return;
      }
      const { error: updateError } = await authService.updatePassword(password.trim());
      if (updateError) throw updateError;
      await onDone(data.session);
    } catch (e: any) {
      setError(e?.message || 'Could not set your password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.title}>Set a new password</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={22} color={Acid.tx2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sub}>
              {step === 'request'
                ? 'We will email you a six digit code. Type it here and pick a new password.'
                : 'Type the code from the email and the password you want.'}
            </Text>

            {step === 'request' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Acid.tx3}
                  value={email}
                  onChangeText={t => { setEmail(t); setError(null); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Code</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="123456"
                    placeholderTextColor={Acid.tx3}
                    value={code}
                    onChangeText={t => { setCode(t.replace(/[^0-9]/g, '')); setError(null); }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>New password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    placeholderTextColor={Acid.tx3}
                    value={password}
                    onChangeText={t => { setPassword(t); setError(null); }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                  />
                </View>
              </>
            )}

            {notice && <Text style={styles.notice}>{notice}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primary, busy && styles.primaryBusy]}
              onPress={step === 'request' ? sendCode : finish}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={Acid.moss} />
              ) : (
                <Text style={styles.primaryText}>{step === 'request' ? 'Send the code' : 'Save and sign in'}</Text>
              )}
            </TouchableOpacity>

            {step === 'verify' && (
              <TouchableOpacity onPress={sendCode} disabled={busy} style={styles.again}>
                <Text style={styles.againText}>SEND A NEW CODE</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: Acid.mossDeep,
    borderRadius: 16,
    padding: 24,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: Acid.serifItalic,
    fontSize: 19,
    color: Acid.tx,
  },
  sub: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
    color: Acid.tx2,
    marginTop: 8,
    marginBottom: 18,
  },
  field: { marginBottom: 18 },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    color: Acid.tx3,
    textTransform: 'uppercase',
  },
  input: {
    color: Acid.tx,
    fontSize: 16,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: Acid.hair2,
  },
  codeInput: { letterSpacing: 6, fontSize: 20 },
  notice: {
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
    color: Acid.tx2,
    marginBottom: 12,
  },
  error: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 19,
    color: Acid.error,
    marginBottom: 12,
  },
  primary: {
    backgroundColor: Acid.lime,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBusy: { opacity: 0.7 },
  primaryText: {
    color: Acid.moss,
    fontSize: 15,
    fontWeight: '800',
  },
  again: { alignSelf: 'center', marginTop: 16, paddingVertical: 6 },
  againText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Acid.lime,
    textDecorationLine: 'underline',
  },
});
