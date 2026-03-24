import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';

interface AccountWallModalProps {
  visible: boolean;
  onContinueWithEmail: () => void;
  onDismiss?: () => void;
  logCount: number;
}

export const AccountWallModal: React.FC<AccountWallModalProps> = ({
  visible,
  onContinueWithEmail,
  onDismiss,
  logCount,
}) => {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[st.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
        {/* Close button */}
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={st.closeBtn}>
            <Feather name="x" size={24} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        )}
        <View style={st.content}>
          {/* Icon */}
          <View style={[st.iconWrap, { backgroundColor: '#3B82F6' + '12' }]}>
            <Feather name="shield" size={40} color="#3B82F6" />
          </View>

          {/* Headline */}
          <Text style={[st.title, { color: theme.colors.textPrimary }]}>
            You've logged {logCount} meals!
          </Text>
          <Text style={[st.sub, { color: theme.colors.textSecondary }]}>
            Create an account to keep your data safe and unlock all features
          </Text>

          {/* Benefits */}
          <View style={st.benefits}>
            {[
              { icon: 'cloud', text: 'Your data backed up securely' },
              { icon: 'smartphone', text: 'Access from any device' },
              { icon: 'zap', text: 'Unlock AI coaching & insights' },
            ].map((b, i) => (
              <View key={i} style={st.benefitRow}>
                <View style={[st.benefitIcon, { backgroundColor: theme.colors.secondaryBg }]}>
                  <Feather name={b.icon as any} size={18} color="#3B82F6" />
                </View>
                <Text style={[st.benefitText, { color: theme.colors.textPrimary }]}>{b.text}</Text>
              </View>
            ))}
          </View>

          {/* CTA buttons */}
          <View style={st.buttons}>
            {/* Google — placeholder */}
            <TouchableOpacity style={[st.oauthBtn, { backgroundColor: theme.colors.secondaryBg, opacity: 0.5 }]} disabled>
              <Text style={[st.oauthTxt, { color: theme.colors.textSecondary }]}>Sign in with Google — coming soon</Text>
            </TouchableOpacity>

            {/* Apple — placeholder */}
            <TouchableOpacity style={[st.oauthBtn, { backgroundColor: theme.colors.secondaryBg, opacity: 0.5 }]} disabled>
              <Text style={[st.oauthTxt, { color: theme.colors.textSecondary }]}>Sign in with Apple — coming soon</Text>
            </TouchableOpacity>

            {/* Email CTA */}
            <TouchableOpacity style={[st.emailBtn, { backgroundColor: theme.colors.primary }]} onPress={onContinueWithEmail}>
              <Feather name="mail" size={18} color={theme.colors.primaryForeground} style={{ marginRight: 8 }} />
              <Text style={[st.emailTxt, { color: theme.colors.primaryForeground }]}>Continue with email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1 },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: Typography.fontSize.md, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  benefits: { width: '100%', gap: 16, marginBottom: 40 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  benefitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  benefitText: { fontSize: Typography.fontSize.md, fontWeight: '500', flex: 1 },
  buttons: { width: '100%', gap: 12 },
  oauthBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14 },
  oauthTxt: { fontSize: Typography.fontSize.sm, fontWeight: '500' },
  emailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14 },
  emailTxt: { fontSize: Typography.fontSize.md, fontWeight: '600' },
});
