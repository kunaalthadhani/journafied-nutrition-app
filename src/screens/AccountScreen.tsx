import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { dataStorage, AccountInfo, ExtendedGoalData } from '../services/dataStorage';
import { referralService } from '../services/referralService';
import { analyticsService } from '../services/analyticsService';
import { usePreferences } from '../contexts/PreferencesContext';

interface AccountScreenProps {
  onBack: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const { convertWeightToDisplay, getWeightUnitLabel } = usePreferences();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [plan, setPlan] = useState<'free' | 'premium'>('free');
  const [totalEarnedEntries, setTotalEarnedEntries] = useState(0);
  const [referralDetails, setReferralDetails] = useState<{
    code: string | null;
    totalReferrals: number;
    entriesFromReferrals: number;
  }>({ code: null, totalReferrals: 0, entriesFromReferrals: 0 });
  const [goals, setGoals] = useState<ExtendedGoalData | null>(null);
  const [weightSummary, setWeightSummary] = useState<{
    starting: number | null;
    current: number | null;
    goal: number | null;
    change: number | null;
  }>({
    starting: null,
    current: null,
    goal: null,
    change: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const FREE_ENTRY_LIMIT = 20;

  useEffect(() => {
    const loadAccountData = async () => {
      setIsLoading(true);
      try {
        const info = await dataStorage.loadAccountInfo();
        setAccountInfo(info);

        const [count, planValue, goalsData, weightEntries] = await Promise.all([
          dataStorage.loadEntryCount(),
          dataStorage.loadUserPlan(),
          dataStorage.loadGoals(),
          dataStorage.loadWeightEntries(),
        ]);

        setEntryCount(count);
        setPlan(planValue);
        setGoals(goalsData);

        if (info?.email) {
          const earnedEntries = await dataStorage.getTotalEarnedEntriesFromReferrals(info.email);
          setTotalEarnedEntries(earnedEntries);

          const codeData = await dataStorage.getReferralCode(info.email);
          setReferralDetails({
            code: codeData?.code || null,
            totalReferrals: codeData?.totalReferrals || 0,
            entriesFromReferrals: codeData?.totalEarnedEntries ?? earnedEntries,
          });
        } else {
          setTotalEarnedEntries(0);
          setReferralDetails({ code: null, totalReferrals: 0, entriesFromReferrals: 0 });
        }

        const sortedEntries = [...weightEntries].sort(
          (a, b) => a.date.getTime() - b.date.getTime()
        );

        const startingWeight = sortedEntries[0]?.weight ?? goalsData?.currentWeightKg ?? null;
        const currentWeight =
          sortedEntries[sortedEntries.length - 1]?.weight ?? goalsData?.currentWeightKg ?? null;
        const goalWeight = goalsData?.targetWeightKg ?? null;
        const change =
          startingWeight !== null && currentWeight !== null ? startingWeight - currentWeight : null;

        setWeightSummary({
          starting: startingWeight,
          current: currentWeight,
          goal: goalWeight,
          change,
        });
      } catch (error) {
        console.error('Error loading account data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccountData();
  }, []);

  const formatWeight = (value: number | null) => {
    if (value === null || value === undefined) {
      return '--';
    }
    return `${convertWeightToDisplay(value).toFixed(1)} ${getWeightUnitLabel()}`;
  };

  const formatWeightChange = (value: number | null) => {
    if (value === null || value === undefined) {
      return '--';
    }
    if (value === 0) {
      return 'No change';
    }
    const magnitude = convertWeightToDisplay(Math.abs(value)).toFixed(1);
    const direction = value > 0 ? 'Lost' : 'Gained';
    return `${direction} ${magnitude} ${getWeightUnitLabel()}`;
  };

  const goalLabelMap: Record<string, string> = {
    lose: 'Lose weight',
    maintain: 'Maintain weight',
    gain: 'Gain weight',
  };

  const remainingEntries =
    plan === 'premium'
      ? null
      : Math.max(0, FREE_ENTRY_LIMIT + totalEarnedEntries - entryCount);

  const handleResetPassword = () => {
    Alert.alert(
      'Reset password',
      'Password reset from the app is coming soon. For now, you can re-register with the same email to update your password.'
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out? This will clear all your data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all user data from storage
              await dataStorage.saveAccountInfo({});
              await dataStorage.saveMeals({});
              await dataStorage.saveGoals({
                calories: 1500,
                proteinPercentage: 30,
                carbsPercentage: 45,
                fatPercentage: 25,
                proteinGrams: 113,
                carbsGrams: 169,
                fatGrams: 42,
                currentWeightKg: null,
                targetWeightKg: null,
              });
              await dataStorage.saveWeightEntries([]);
              await dataStorage.saveEntryCount(0);
              await dataStorage.saveUserPlan('free');
              // Clear entry count from AsyncStorage as well
              await AsyncStorage.setItem('@trackkal:entryCount', '0');
              
              // Reset state to show registration form
              setAccountInfo(null);
              setEntryCount(0);
              setPlan('free');
              setTotalEarnedEntries(0);
              setReferralDetails({ code: null, totalReferrals: 0, entriesFromReferrals: 0 });
              setGoals(null);
              setWeightSummary({ starting: null, current: null, goal: null, change: null });
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'An error occurred during logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please fill in name, email, and password.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
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

  const renderRegistrationForm = () => (
    <View style={styles.content}>
      <View
        style={[
          styles.formCard,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Name</Text>
        <TextInput
          style={[
            styles.input,
            { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input },
          ]}
          placeholder="Your name"
          placeholderTextColor={theme.colors.textTertiary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email</Text>
        <TextInput
          style={[
            styles.input,
            { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input },
          ]}
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
          style={[
            styles.input,
            { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input },
          ]}
          placeholder="Create a password"
          placeholderTextColor={theme.colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="next"
        />

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
            setReferralCodeError(null);
          }}
          autoCapitalize="characters"
          returnKeyType="done"
          editable={!isValidatingCode}
        />
        {referralCodeError && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{referralCodeError}</Text>
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
      </View>
    </View>
  );

  const renderSummary = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.summaryContent}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.profileHeader}>
          <View>
            <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>
              {accountInfo?.name || 'TrackKal user'}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]}>
              {accountInfo?.email}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.resetButton,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.input },
            ]}
            onPress={handleResetPassword}
          >
            <Feather name="refresh-ccw" size={14} color="#14B8A6" />
            <Text style={[styles.resetButtonText, { color: '#14B8A6' }]}>Reset password</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.planRow}>
          <Text style={[styles.planLabel, { color: theme.colors.textSecondary }]}>Plan</Text>
          <View
            style={[
              styles.planBadge,
              { backgroundColor: plan === 'premium' ? '#14B8A6' : theme.colors.input },
            ]}
          >
            <Text
              style={[
                styles.planBadgeText,
                { color: plan === 'premium' ? Colors.white : theme.colors.textSecondary },
              ]}
            >
              {plan === 'premium' ? 'Premium' : 'Free'}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          Entry usage
        </Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Logged</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              {entryCount}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Remaining</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              {plan === 'premium' ? 'Unlimited' : remainingEntries}
            </Text>
            {plan !== 'premium' && (
              <Text style={[styles.statHelper, { color: theme.colors.textSecondary }]}>
                out of {FREE_ENTRY_LIMIT + totalEarnedEntries}
              </Text>
            )}
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              From referrals
            </Text>
            <Text style={[styles.statValue, { color: '#14B8A6' }]}>
              +{referralDetails.entriesFromReferrals}
            </Text>
            <Text style={[styles.statHelper, { color: theme.colors.textSecondary }]}>
              {referralDetails.totalReferrals} friends joined
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          Goals & focus
        </Text>
        <View style={styles.goalRow}>
          <Feather name="target" size={18} color="#14B8A6" />
          <Text style={[styles.goalText, { color: theme.colors.textPrimary }]}>
            {goals?.goal ? goalLabelMap[goals.goal] : 'Goal not set yet'}
          </Text>
        </View>
        <View style={styles.weightGrid}>
          <View style={styles.weightItem}>
            <Text style={[styles.weightLabel, { color: theme.colors.textSecondary }]}>
              Starting weight
            </Text>
            <Text style={[styles.weightValue, { color: theme.colors.textPrimary }]}>
              {formatWeight(weightSummary.starting)}
            </Text>
          </View>
          <View style={styles.weightItem}>
            <Text style={[styles.weightLabel, { color: theme.colors.textSecondary }]}>
              Current weight
            </Text>
            <Text style={[styles.weightValue, { color: theme.colors.textPrimary }]}>
              {formatWeight(weightSummary.current)}
            </Text>
          </View>
          <View style={styles.weightItem}>
            <Text style={[styles.weightLabel, { color: theme.colors.textSecondary }]}>
              Goal weight
            </Text>
            <Text style={[styles.weightValue, { color: theme.colors.textPrimary }]}>
              {formatWeight(weightSummary.goal)}
            </Text>
          </View>
        </View>
        <View style={styles.weightChangeRow}>
          <Feather name="trending-down" size={18} color="#14B8A6" />
          <Text style={[styles.weightChangeText, { color: theme.colors.textPrimary }]}>
            {formatWeightChange(weightSummary.change)}
          </Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={[styles.logoutButton, { borderColor: theme.colors.border }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={18} color={theme.colors.error} />
        <Text style={[styles.logoutButtonText, { color: theme.colors.error }]}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#14B8A6" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Account</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#14B8A6" />
          <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Loading account…</Text>
        </View>
      ) : accountInfo ? (
        renderSummary()
      ) : (
        renderRegistrationForm()
      )}
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
  summaryContent: {
    paddingBottom: 32,
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
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  profileEmail: {
    fontSize: Typography.fontSize.sm,
    marginTop: 4,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  resetButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  planLabel: {
    fontSize: Typography.fontSize.sm,
  },
  planBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  planBadgeText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(20, 184, 166, 0.04)',
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 6,
  },
  statHelper: {
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  goalText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  weightGrid: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  weightItem: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.2)',
  },
  weightLabel: {
    fontSize: Typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  weightValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  weightChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  weightChangeText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 32,
    backgroundColor: 'transparent',
  },
  logoutButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
});
