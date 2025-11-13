import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { dataStorage } from '../services/dataStorage';
import { referralService } from '../services/referralService';
import { analyticsService } from '../services/analyticsService';

interface AccountScreenProps {
  onBack: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please fill in name, email, and password.');
      return;
    }

    // Validate referral code if provided
    let referralRedemption = null;
    let hasUsedReferralCode = false;
    
    if (referralCode.trim()) {
      setIsValidatingCode(true);
      const validation = await referralService.validateReferralCodeForRedemption(
        referralCode.trim(),
        email.trim()
      );

      if (!validation.valid) {
        setReferralCodeError(validation.error || 'Invalid referral code');
        setIsValidatingCode(false);
        return;
      }

      // Create redemption record
      referralRedemption = await referralService.createReferralRedemption(
        validation.referralCode!,
        email.trim(),
        name.trim()
      );
      hasUsedReferralCode = true;
      setIsValidatingCode(false);
      
      // Track analytics (already tracked in createReferralRedemption, but we can track here too if needed)
    }

    // Save account info (in production, password should be hashed)
    await dataStorage.saveAccountInfo({
      name: name.trim(),
      email: email.trim(),
      passwordHash: password.trim(), // In production, hash this properly
      hasUsedReferralCode,
    });

    // Generate referral code for the new user
    await referralService.getOrCreateReferralCode(email.trim());

    if (referralRedemption) {
      Alert.alert(
        'Referral Code Applied!',
        'Your referral code has been applied. Log 5 meals to unlock +10 free entries for you and your friend!'
      );
    } else {
      Alert.alert('Registered', 'Your account has been created.');
    }

    // Call onBack or navigate back
    onBack();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#14B8A6" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Account</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        <View style={[styles.formCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Name</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
            placeholder="Your name"
            placeholderTextColor={theme.colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Password</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
            placeholder="Create a password"
            placeholderTextColor={theme.colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="next"
          />

          {/* Referral Code Input */}
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Referral Code (Optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                borderColor: referralCodeError ? theme.colors.error : theme.colors.border,
                backgroundColor: theme.colors.input,
              },
            ]}
            placeholder="Enter friend's referral code"
            placeholderTextColor={theme.colors.textTertiary}
            value={referralCode}
            onChangeText={(text) => {
              setReferralCode(text.toUpperCase().trim());
              setReferralCodeError(null); // Clear error on input
            }}
            autoCapitalize="characters"
            returnKeyType="done"
            editable={!isValidatingCode}
          />
          {referralCodeError && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {referralCodeError}
            </Text>
          )}
          {referralCode && !referralCodeError && (
            <Text style={[styles.helperText, { color: theme.colors.textTertiary }]}>
              Enter a friend's code to get +10 free entries after logging 5 meals
            </Text>
          )}

          <TouchableOpacity 
            style={[styles.primaryButton, isValidatingCode && styles.primaryButtonDisabled]} 
            onPress={handleSignUp}
            disabled={isValidatingCode}
          >
            <Text style={styles.primaryButtonText}>
              {isValidatingCode ? 'Validating...' : 'Sign up'}
            </Text>
          </TouchableOpacity>

          {/* OAuth options removed for now */}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semiBold,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: Typography.fontSize.md,
  },
  primaryButton: {
    backgroundColor: '#14B8A6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    marginTop: 4,
    marginBottom: 4,
  },
  helperText: {
    fontSize: Typography.fontSize.sm,
    marginTop: 4,
    marginBottom: 4,
  },
});
