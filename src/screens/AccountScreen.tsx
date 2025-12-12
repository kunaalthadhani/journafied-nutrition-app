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
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { dataStorage, AccountInfo, ExtendedGoalData } from '../services/dataStorage';
import { referralService } from '../services/referralService';
import { analyticsService } from '../services/analyticsService';
import { usePreferences } from '../contexts/PreferencesContext';
import { authService } from '../services/authService';

interface AccountScreenProps {
  onBack: () => void;
  initialAccountInfo?: AccountInfo | null;
  initialEntryCount?: number;
  initialPlan?: 'free' | 'premium';
  initialGoals?: ExtendedGoalData | null;
  initialReferralCode?: string | null;
  initialTotalEarnedEntries?: number;
  initialTaskBonusEntries?: number;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  onBack,
  initialAccountInfo,
  initialEntryCount,
  initialPlan,
  initialGoals,
  initialReferralCode,
  initialTotalEarnedEntries,
  initialTaskBonusEntries,
}) => {
  const theme = useTheme();
  const { convertWeightToDisplay, getWeightUnitLabel } = usePreferences();

  // -- Auth State --
  const [authSession, setAuthSession] = useState<Session | null>(null);
  // Only show loading if we don't have basic account info AND we suspect we might need to load it
  // If we have accountInfo (logged in) or if we explicitly have null (guest), we can skip full blocker
  const [isLoading, setIsLoading] = useState(!initialAccountInfo && initialAccountInfo !== null);
  const [authStatus, setAuthStatus] = useState<'idle' | 'sending' | 'verifying'>('idle');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  // -- Form State --
  const [name, setName] = useState(initialAccountInfo?.name || '');
  const [emailInput, setEmailInput] = useState(initialAccountInfo?.email || '');
  const [phoneInput, setPhoneInput] = useState(initialAccountInfo?.phoneNumber || '');
  const [pendingOtpCode, setPendingOtpCode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  // -- Validation State --
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);

  // -- User Data State --
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(initialAccountInfo || null);
  const [entryCount, setEntryCount] = useState(initialEntryCount || 0);
  const [plan, setPlan] = useState<'free' | 'premium'>(initialPlan || 'free');
  const [totalEarnedEntries, setTotalEarnedEntries] = useState(initialTotalEarnedEntries || 0);
  const [taskBonusEntries, setTaskBonusEntries] = useState(initialTaskBonusEntries || 0);
  const [goals, setGoals] = useState<ExtendedGoalData | null>(initialGoals || null);
  const [weightSummary, setWeightSummary] = useState<{
    starting: number | null;
    current: number | null;
    goal: number | null;
    change: number | null;
  }>({ starting: null, current: null, goal: null, change: null });

  const [referralDetails, setReferralDetails] = useState<{
    code: string | null;
    totalReferrals: number;
    entriesFromReferrals: number;
  }>({
    code: initialReferralCode || null,
    totalReferrals: 0,
    entriesFromReferrals: initialTotalEarnedEntries || 0
  });

  const FREE_ENTRY_LIMIT = 20;

  // -- Effects --

  // 1. Initial Load & Auth Listener
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!initialAccountInfo && initialAccountInfo !== null) {
        setIsLoading(true);
      }
      try {
        // Check current session
        const { data } = await authService.getSession();
        if (isMounted) {
          setAuthSession(data.session);
          if (data.session?.user?.email) {
            setEmailInput(data.session.user.email);
          }
        }

        // Load local data regardless of auth state (guest mode support)
        await loadLocalData();
      } catch (e) {
        console.warn('Init failed:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    init();

    const { data: authListener } = authService.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setAuthSession(session);
      if (session?.user?.email) {
        setEmailInput(session.user.email);
        await syncAccountInfoFromSession(session);
        await loadLocalData(); // Refresh data on auth change
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // -- Helpers --

  const loadLocalData = async () => {
    try {
      const info = await dataStorage.loadAccountInfo();
      const [count, planValue, goalsData, weightEntries] = await Promise.all([
        dataStorage.loadEntryCount(),
        dataStorage.loadUserPlan(),
        dataStorage.loadGoals(),
        dataStorage.loadWeightEntries(),
      ]);

      setAccountInfo(info);
      if (info?.name) setName(info.name);
      if (info?.email) setEmailInput(info.email);
      if (info?.phoneNumber) setPhoneInput(info.phoneNumber);

      setEntryCount(count);
      setPlan(planValue);
      setGoals(goalsData);

      // Weight Summary Logic
      const sortedEntries = [...weightEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
      const startingWeight = sortedEntries[0]?.weight ?? goalsData?.currentWeightKg ?? null;
      const currentWeight = sortedEntries[sortedEntries.length - 1]?.weight ?? goalsData?.currentWeightKg ?? null;
      const goalWeight = goalsData?.targetWeightKg ?? null;
      const change = startingWeight !== null && currentWeight !== null ? startingWeight - currentWeight : null;

      setWeightSummary({ starting: startingWeight, current: currentWeight, goal: goalWeight, change });

      // Referral Data
      if (info?.email) {
        const earned = await dataStorage.getTotalEarnedEntriesFromReferrals(info.email);
        setTotalEarnedEntries(earned);
        const codeData = await dataStorage.getReferralCode(info.email);
        setReferralDetails({
          code: codeData?.code || null,
          totalReferrals: codeData?.totalReferrals || 0,
          entriesFromReferrals: codeData?.totalEarnedEntries ?? earned,
        });
      } else {
        setTotalEarnedEntries(0);
        setReferralDetails({ code: null, totalReferrals: 0, entriesFromReferrals: 0 });
      }

      // Tasks
      const tasksStatus = await dataStorage.loadEntryTasks();
      setTaskBonusEntries(dataStorage.getEntryTaskBonus(tasksStatus));

    } catch (error) {
      console.error('Failed to load local data', error);
    }
  };

  const syncAccountInfoFromSession = async (session: Session, silent = false) => {
    const email = session.user.email;
    if (!email) return;

    const existing = await dataStorage.loadAccountInfo();
    const merged: AccountInfo = {
      ...(existing || {}),
      email,
      name: existing?.name ?? (name.trim() || undefined),
      phoneNumber: existing?.phoneNumber ?? (phoneInput.trim() || undefined),
      supabaseUserId: session.user.id,
    };

    await dataStorage.saveAccountInfo(merged);
    setAccountInfo(merged);
  };

  // -- Actions --

  const handleSendOtp = async () => {
    const email = emailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let hasError = false;

    if (!name.trim()) { setNameError(true); hasError = true; } else setNameError(false);
    if (!emailRegex.test(email)) { setEmailError(true); hasError = true; } else setEmailError(false);
    if (!hasAcceptedTerms) { setTermsError(true); hasError = true; } else setTermsError(false);

    if (hasError) return;

    try {
      setAuthStatus('sending');
      setAuthMessage(null);

      // Provisionally save info
      const provisional: AccountInfo = {
        ...(accountInfo || {}),
        name: name.trim(),
        email,
        phoneNumber: phoneInput.trim() || undefined,
      };
      await dataStorage.saveAccountInfo(provisional);
      setAccountInfo(provisional);

      await authService.sendOtp(email);
      setOtpSent(true);
      setAuthMessage('Verification code sent to your email.');
    } catch (error: any) {
      setAuthMessage(error.message || 'Failed to send code.');
    } finally {
      setAuthStatus('idle');
    }
  };

  const handleVerifyOtp = async () => {
    if (pendingOtpCode.length < 6) {
      setAuthMessage('Please enter the full 6-digit code.');
      return;
    }

    try {
      setAuthStatus('verifying');
      setAuthMessage(null);

      const { data, error } = await authService.verifyOtp(emailInput.trim(), pendingOtpCode.trim());
      if (error) throw error;
      if (!data.session) throw new Error('No session returned.');

      // Success sequence
      await syncAccountInfoFromSession(data.session);
      await dataStorage.pushCachedDataToSupabase();

      // Handle Referrals
      if (referralCode.trim()) {
        const validation = await referralService.validateReferralCodeForRedemption(referralCode.trim(), emailInput);
        if (validation.valid) {
          await referralService.createReferralRedemption(validation.referralCode!, emailInput, name.trim());
        }
      }

      // Get own referral code
      const myCode = await referralService.getOrCreateReferralCode(emailInput);
      setReferralDetails(prev => ({ ...prev, code: myCode }));

      // Registration task bonus
      const taskResult = await dataStorage.completeEntryTask('registration');
      if (taskResult.awarded) {
        Alert.alert('Bonus Unlocked!', 'Account verified. +5 free entries.');
      }

      await loadLocalData(); // Refresh UI
      setOtpSent(false); // Reset form state
      setPendingOtpCode('');
      setReferralCode('');

    } catch (e: any) {
      setAuthMessage('Invalid code or expired. Please try again.');
    } finally {
      setAuthStatus('idle');
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await authService.signOut();
          setAuthSession(null);
          // Revert to guest info if needed, or clear PII
          setAccountInfo(prev => ({ ...prev, email: undefined, supabaseUserId: undefined }));
          setOtpSent(false);
          setPendingOtpCode('');
          setAuthMessage(null);
        }
      }
    ]);
  };

  const handleClearData = () => {
    Alert.alert('Clear Everything?', 'This will permanently delete all local data and log you out. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All Data',
        style: 'destructive',
        onPress: async () => {
          await authService.signOut();
          // Clear data manually since clearAllData doesn't exist
          await dataStorage.saveAccountInfo({});
          await dataStorage.saveMeals({});
          await dataStorage.saveGoals({
            calories: 1500, proteinPercentage: 30, carbsPercentage: 45, fatPercentage: 25,
            proteinGrams: 113, carbsGrams: 169, fatGrams: 42,
            currentWeightKg: null, targetWeightKg: null
          });
          await dataStorage.saveWeightEntries([]);
          await dataStorage.saveEntryCount(0);
          await dataStorage.saveUserPlan('free');

          await AsyncStorage.clear();
          // Reset state
          setAuthSession(null);
          setAccountInfo(null);
          setEntryCount(0);
          setGoals(null);
          setWeightSummary({ starting: null, current: null, goal: null, change: null });
          onBack(); // Go back to home to force refresh or mounting triggers
        }
      }
    ]);
  };

  // -- Renderers --

  const renderNotLoggedIn = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.summaryContent} keyboardShouldPersistTaps="handled">
      <View style={[styles.formCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Create Account / Sign In</Text>
        <Text style={[styles.helperText, { color: theme.colors.textSecondary, marginBottom: 20 }]}>
          Enter your details to sync your progress and get free entry bonuses.
        </Text>

        {/* Name Input */}
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Name</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.colors.input,
            color: theme.colors.textPrimary,
            borderColor: nameError ? theme.colors.error : theme.colors.border
          }]}
          placeholder="John Doe"
          placeholderTextColor={theme.colors.textTertiary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        {/* Email Input */}
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.colors.input,
            color: theme.colors.textPrimary,
            borderColor: emailError ? theme.colors.error : theme.colors.border
          }]}
          placeholder="john@example.com"
          placeholderTextColor={theme.colors.textTertiary}
          value={emailInput}
          onChangeText={setEmailInput}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Phone Input */}
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Phone (Optional)</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.colors.input,
            color: theme.colors.textPrimary,
            borderColor: theme.colors.border
          }]}
          placeholder="+1 234 567 8900"
          placeholderTextColor={theme.colors.textTertiary}
          value={phoneInput}
          onChangeText={setPhoneInput}
          keyboardType="phone-pad"
        />

        {/* Referral Code */}
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Referral Code (Optional)</Text>
        <TextInput
          style={[styles.input, {
            backgroundColor: theme.colors.input,
            color: theme.colors.textPrimary,
            borderColor: referralCodeError ? theme.colors.error : theme.colors.border
          }]}
          placeholder="FRIEND123"
          placeholderTextColor={theme.colors.textTertiary}
          value={referralCode}
          onChangeText={setReferralCode}
          autoCapitalize="characters"
        />
        {referralCodeError && <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: 4 }}>{referralCodeError}</Text>}

        {/* OTP Input - Conditionally Rendered */}
        {otpSent && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.label, { color: theme.colors.primary, fontWeight: 'bold' }]}>Enter Verification Code</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.colors.input,
                color: theme.colors.textPrimary,
                borderColor: theme.colors.primary,
                textAlign: 'center',
                fontSize: 20,
                letterSpacing: 4
              }]}
              placeholder="123456"
              placeholderTextColor={theme.colors.textTertiary}
              value={pendingOtpCode}
              onChangeText={setPendingOtpCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
        )}

        {/* Terms Checkbox */}
        <TouchableOpacity style={styles.termsRow} onPress={() => setHasAcceptedTerms(!hasAcceptedTerms)}>
          <View style={[styles.checkbox, { borderColor: termsError ? theme.colors.error : theme.colors.border }]}>
            {hasAcceptedTerms && <View style={styles.checkboxInner} />}
          </View>
          <Text style={[styles.helperText, { flex: 1, color: theme.colors.textSecondary }]}>
            I agree to the Terms & Conditions
          </Text>
        </TouchableOpacity>

        {/* Action Button */}
        {authMessage && <Text style={{ color: theme.colors.textPrimary, textAlign: 'center', marginVertical: 8 }}>{authMessage}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, (!hasAcceptedTerms || authStatus !== 'idle') && styles.primaryButtonDisabled]}
          disabled={!hasAcceptedTerms || authStatus !== 'idle'}
          onPress={otpSent ? handleVerifyOtp : handleSendOtp}
        >
          {authStatus !== 'idle' ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>{otpSent ? 'Verify & Sign In' : 'Send Verification Code'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderLoggedIn = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
      {/* Profile Card */}
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: 'white', fontWeight: 'bold' }}>{accountInfo?.name?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
          <View>
            <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>{accountInfo?.name || 'User'}</Text>
            <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]}>{accountInfo?.email}</Text>
          </View>
        </View>
        <View style={[styles.planBadge, { alignSelf: 'flex-start', marginTop: 12, backgroundColor: plan === 'premium' ? theme.colors.primary : theme.colors.input }]}>
          <Text style={[styles.planBadgeText, { color: plan === 'premium' ? 'white' : theme.colors.textSecondary }]}>
            {plan === 'premium' ? 'Premium Plan' : 'Free Plan'}
          </Text>
        </View>
      </View>

      {/* Stats Card */}
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Account Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Log Streak</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{entryCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Referrals</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{referralDetails.totalReferrals}</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={[styles.logoutButton, { borderColor: theme.colors.border }]} onPress={handleSignOut}>
        <Feather name="log-out" size={18} color={theme.colors.error} />
        <Text style={[styles.logoutButtonText, { color: theme.colors.error }]}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ alignSelf: 'center', padding: 10 }} onPress={handleClearData}>
        <Text style={{ color: theme.colors.textTertiary, fontSize: 12 }}>Danger Zone: Clear All Local Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          {authSession ? 'My Account' : 'Login'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        (authSession || accountInfo?.email) ? renderLoggedIn() : renderNotLoggedIn()
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
    fontSize: Typography.fontSize.md,
    marginTop: 8,
    marginBottom: 6,
  },
  labelBold: {
    fontWeight: Typography.fontWeight.semiBold,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: Typography.fontSize.md,
  },
  primaryButton: {
    backgroundColor: '#171717', // Neutral-900 or theme.colors.textPrimary equivalent
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 8,
  },
  checkboxInner: {
    flex: 1,
    margin: 2,
    borderRadius: 3,
    backgroundColor: '#10B981',
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
  signOutButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  signOutButtonText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semiBold,
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
    fontSize: Typography.fontSize.lg,
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
  referralCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    borderRadius: 10,
  },
  referralCodeText: {
    fontSize: 24,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 2,
    fontFamily: 'monospace',
    marginRight: 12,
  },
  copyCodeButton: {
    padding: 8,
    borderRadius: 8,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  whatsappButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
});

