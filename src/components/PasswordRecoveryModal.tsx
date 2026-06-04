import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../constants/theme';
import { authService } from '../services/authService';

// Shown when Supabase fires PASSWORD_RECOVERY (the user opened a reset link).
// On web, detectSessionInUrl consumes the recovery token from the URL and emits
// this event, so this is the surface that actually lets a PWA user finish a
// password reset. On native the same event fires once the deep link is wired.
export const PasswordRecoveryModal: React.FC = () => {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | undefined;
    try {
      const res = authService.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') setVisible(true);
      });
      sub = res?.data?.subscription;
    } catch {
      /* supabase not configured */
    }
    return () => { try { sub?.unsubscribe(); } catch { /* noop */ } };
  }, []);

  const handleSave = async () => {
    if (password.trim().length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    try {
      setSaving(true);
      const { error } = await authService.updatePassword(password.trim());
      if (error) throw error;
      setVisible(false);
      setPassword('');
      Alert.alert('Password updated', 'Your new password is set. You are signed in.');
    } catch (e: any) {
      Alert.alert('Could not update password', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Set a new password</Text>
          <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
            Enter a new password for your account.
          </Text>
          <TextInput
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
            placeholder="New password"
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={[styles.buttonText, { color: theme.colors.primaryForeground }]}>
              {saving ? 'Saving...' : 'Save password'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
