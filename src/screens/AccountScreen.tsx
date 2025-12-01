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
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const { convertWeightToDisplay, getWeightUnitLabel } = usePreferences();
  const [name, setName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [pendingOtpCode, setPendingOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authStatus, setAuthStatus] = useState<'idle' | 'sending' | 'verifying'>('idle');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [plan, setPlan] = useState<'free' | 'premium'>('free');
  const [totalEarnedEntries, setTotalEarnedEntries] = useState(0);
  const [taskBonusEntries, setTaskBonusEntries] = useState(0);
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
  const [authSession, setAuthSession] = useState<Session | null>(null);

  const FREE_ENTRY_LIMIT = 20;

  const loadAccountData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const info = await dataStorage.loadAccountInfo();
      setAccountInfo(info);
      if (info?.name) {
        setName(info.name);
      }
      if (info?.email) {
        setEmailInput(info.email);
      }

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

      const sortedEntries = [...weightEntries].sort((a, b) => a.date.getTime() - b.date.getTime());

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

      const tasksStatus = await dataStorage.loadEntryTasks();
      setTaskBonusEntries(dataStorage.getEntryTaskBonus(tasksStatus));
    } catch (error) {
      console.error('Error loading account data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const { data } = await authService.getSession();
        if (!isMounted) return;
        setAuthSession(data.session ?? null);
        if (data.session?.user?.email) {
          setEmailInput(data.session.user.email);
          await syncAccountInfoFromSession(data.session, true);
        }
      } catch (error) {
        console.warn('Auth session bootstrap failed:', error);
      }
    };

    bootstrap();

    const { data: authListener } = authService.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setAuthSession(session);
      if (session?.user?.email) {
        setEmailInput(session.user.email);
        await syncAccountInfoFromSession(session);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const syncAccountInfoFromSession = async (session: Session, silent = false) => {
    const email = session.user.email;
    if (!email) return;

    const existing = await dataStorage.loadAccountInfo();
    const merged: AccountInfo = {
      ...(existing || {}),
      email,
      name: existing?.name ?? (name.trim().length ? name.trim() : undefined),
      phoneNumber: existing?.phoneNumber,
      supabaseUserId: session.user.id,
      hasUsedReferralCode: existing?.hasUsedReferralCode,
    };

    await dataStorage.saveAccountInfo(merged);
    setAccountInfo(merged);
    if (!silent && merged.name) {
      setName(merged.name);
    }
  };

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
      : Math.max(0, FREE_ENTRY_LIMIT + totalEarnedEntries + taskBonusEntries - entryCount);

  const handleClearLocalData = () => {
    Alert.alert(
      'Clear local data',
      'This removes every saved entry from this device. Remote backups stay untouched.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear data',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.signOut().catch(() => {});
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
              setAuthSession(null);
              setEmailInput('');
              setAuthMessage(null);
              setOtpSent(false);
              setPendingOtpCode('');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Something went wrong while clearing your data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReferralAfterLogin = async (userEmail: string, userName?: string | null) => {
    if (!referralCode.trim()) {
      setReferralCodeError(null);
      return;
    }
    try {
      setIsValidatingCode(true);
      const validation = await referralService.validateReferralCodeForRedemption(
        referralCode.trim(),
        userEmail
      );

      if (!validation.valid) {
        setReferralCodeError(validation.error || 'Invalid referral code');
        return;
      }

      await referralService.createReferralRedemption(
        validation.referralCode!,
        userEmail,
        userName && userName.trim().length ? userName : 'TrackKcal user'
      );
      setReferralCode('');
      setReferralCodeError(null);
    } catch (error) {
      console.error('Referral redemption failed:', error);
      setReferralCodeError('Unable to apply referral code right now.');
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleSendOtp = async () => {
    const email = emailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthMessage('Enter a valid email address.');
      return;
    }

    try {
      setAuthStatus('sending');
      setAuthMessage(null);
      await authService.sendOtp(email);
      setOtpSent(true);
      setAuthMessage('Check your inbox for a verification code.');
    } catch (error: any) {
      console.error('OTP send failed:', error);
      setAuthMessage(error?.message ?? 'Failed to send code. Please try again.');
    } finally {
      setAuthStatus('idle');
    }
  };

  const handleVerifyOtp = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!otpSent) {
      setAuthMessage('Request a code first.');
      return;
    }
    if (pendingOtpCode.trim().length < 6) {
      setAuthMessage('Enter the verification code from your email.');
      return;
    }

    try {
      setAuthStatus('verifying');
      setAuthMessage(null);
      const { data, error } = await authService.verifyOtp(email, pendingOtpCode.trim());
      if (error) {
        throw error;
      }
      const session = data.session ?? (await authService.getSession()).data.session;
      if (!session) {
        throw new Error('Verification succeeded, but no session was returned.');
      }

      await syncAccountInfoFromSession(session);
      await dataStorage.pushCachedDataToSupabase();
      await referralService.getOrCreateReferralCode(email);
      await handleReferralAfterLogin(email, name.trim() || accountInfo?.name);

      const rewardResult = await dataStorage.completeEntryTask('registration');
      if (rewardResult.awarded) {
        setTaskBonusEntries(dataStorage.getEntryTaskBonus(rewardResult.status));
      }

      setAuthMessage('Success! Your data is now synced to your account.');
      setOtpSent(false);
      setPendingOtpCode('');
      await loadAccountData();
    } catch (error: any) {
      console.error('OTP verification failed:', error);
      setAuthMessage(error?.message ?? 'Verification failed. Double-check the code and try again.');
    } finally {
      setAuthStatus('idle');
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      setAuthSession(null);
      setOtpSent(false);
      setPendingOtpCode('');
      setAuthMessage('Signed out. Continue in guest mode or log in again anytime.');
      const guestInfo: AccountInfo = {
        name: name.trim() || undefined,
        phoneNumber: accountInfo?.phoneNumber,
      };
      await dataStorage.saveAccountInfo(guestInfo);
      setAccountInfo(guestInfo);
      await loadAccountData();
    } catch (error) {
      console.error('Sign out failed:', error);
      Alert.alert('Sign out failed', 'Please try again.');
    }
  };

  const renderSummary = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.summaryContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
    >
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          Account status
        </Text>
        <Text style={[styles.helperText, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
          {authSession?.user?.email
            ? `Synced to ${authSession.user.email}. Your data is backed up and available on other devices.`
            : 'Guest mode — data lives on this device. Log in to back it up and sync across devices.'}
        </Text>
        {authSession?.user ? (
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Feather name="log-out" size={16} color={Colors.white} />
            <Text style={styles.signOutButtonText}>Sign out</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input },
              ]}
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textTertiary}
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              textContentType="emailAddress"
              importantForAutofill="yes"
              editable={authStatus === 'idle'}
            />
            {otpSent && (
              <>
                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                  Verification code
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.colors.textPrimary, borderColor: theme.colors.border, backgroundColor: theme.colors.input },
                  ]}
                  placeholder="Enter verification code"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={pendingOtpCode}
                  onChangeText={setPendingOtpCode}
                  keyboardType="number-pad"
                  maxLength={10}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  importantForAutofill="yes"
                />
              </>
            )}
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Referral code (optional)
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
              placeholder="FRIEND10"
              placeholderTextColor={theme.colors.textTertiary}
              value={referralCode}
              onChangeText={(text) => {
                setReferralCode(text.trim().toUpperCase());
                setReferralCodeError(null);
              }}
              autoCapitalize="characters"
              editable={!isValidatingCode && authStatus === 'idle'}
            />
            {referralCodeError && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{referralCodeError}</Text>
            )}
            {authMessage && (
              <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>{authMessage}</Text>
            )}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (authStatus !== 'idle' || isValidatingCode) && styles.primaryButtonDisabled,
              ]}
              onPress={otpSent ? handleVerifyOtp : handleSendOtp}
              disabled={authStatus !== 'idle' || isValidatingCode}
            >
              {authStatus !== 'idle' ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{otpSent ? 'Verify code' : 'Send code'}</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Your Referral Code Card - Only show when logged in */}
      {authSession?.user && referralDetails.code && (
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Your Referral Code
          </Text>
          <Text style={[styles.helperText, { color: theme.colors.textSecondary, marginBottom: 12 }]}>
            Share your code with friends to earn free entries!
          </Text>
          <View style={styles.referralCodeContainer}>
            <Text style={[styles.referralCodeText, { color: theme.colors.textPrimary }]}>
              {referralDetails.code}
            </Text>
            <TouchableOpacity
              style={[styles.copyCodeButton, { backgroundColor: theme.colors.input }]}
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(referralDetails.code!);
                  Alert.alert('Copied!', 'Referral code copied to clipboard.');
                } catch (error) {
                  console.error('Error copying code:', error);
                  Alert.alert('Error', 'Failed to copy code.');
                }
              }}
            >
              <Feather name="copy" size={16} color="#10B981" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.whatsappButton, { backgroundColor: '#25D366' }]}
            onPress={async () => {
              try {
                const message = `Join me on TrackKcal! Use my referral code ${referralDetails.code} to get +10 free entries after logging 5 meals. Download the app and enter the code when you sign up!`;
                const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
                const canOpen = await Linking.canOpenURL(whatsappUrl);
                if (canOpen) {
                  await Linking.openURL(whatsappUrl);
                  if (accountInfo?.email) {
                    await analyticsService.trackReferralCodeShared(accountInfo.email, 'share');
                  }
                } else {
                  Alert.alert('WhatsApp not installed', 'Please install WhatsApp to share your referral code.');
                }
              } catch (error) {
                console.error('Error opening WhatsApp:', error);
                Alert.alert('Error', 'Could not open WhatsApp. Please try again.');
              }
            }}
          >
            <Feather name="message-circle" size={18} color={Colors.white} />
            <Text style={styles.whatsappButtonText}>Share via WhatsApp</Text>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        ]}
      >
        <View style={styles.profileHeader}>
          <View>
            <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>
              {accountInfo?.name || 'TrackKcal user'}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]}>
              {accountInfo?.email || 'guest mode'}
            </Text>
          </View>
        </View>
        <View style={styles.planRow}>
          <Text style={[styles.planLabel, { color: theme.colors.textSecondary }]}>Plan</Text>
          <View
            style={[
              styles.planBadge,
              { backgroundColor: plan === 'premium' ? '#10B981' : theme.colors.input },
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
                out of {FREE_ENTRY_LIMIT + totalEarnedEntries + taskBonusEntries}
              </Text>
            )}
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              From referrals
            </Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>
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
          <Feather name="target" size={18} color="#10B981" />
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
          <Feather name="trending-down" size={18} color="#10B981" />
          <Text style={[styles.weightChangeText, { color: theme.colors.textPrimary }]}>
            {formatWeightChange(weightSummary.change)}
          </Text>
        </View>
      </View>

      {/* Clear data button */}
      <TouchableOpacity
        style={[styles.logoutButton, { borderColor: theme.colors.border }]}
        onPress={handleClearLocalData}
      >
        <Feather name="log-out" size={18} color={theme.colors.error} />
        <Text style={[styles.logoutButtonText, { color: theme.colors.error }]}>
          Clear local data
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#10B981" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Account</Text>
        <View style={styles.headerRight} />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Loading account…</Text>
        </View>
      ) : (
        renderSummary()
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
    backgroundColor: '#10B981',
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

