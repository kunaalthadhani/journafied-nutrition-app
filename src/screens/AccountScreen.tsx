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
  Switch,

  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { dataStorage, AccountInfo, ExtendedGoalData, StreakFreezeData } from '../services/dataStorage';
import { referralService } from '../services/referralService';
import { analyticsService } from '../services/analyticsService';
import { usePreferences } from '../contexts/PreferencesContext';
import { authService } from '../services/authService';
import { COUNTRIES, Country } from '../constants/countries';
import { FlatList } from 'react-native';

/**
 * Parse a stored full phone number (e.g. "+971501234567") into
 * its matching Country and local body (e.g. "501234567").
 * Falls back to COUNTRIES[0] (UAE) and empty string if no match.
 */
function parseStoredPhone(full?: string | null): { country: Country; local: string } {
  if (!full) return { country: COUNTRIES[0], local: '' };

  // Sort by longest dial_code first so "+353" matches before "+3"
  const sorted = [...COUNTRIES].sort((a, b) => b.dial_code.length - a.dial_code.length);
  for (const c of sorted) {
    if (full.startsWith(c.dial_code)) {
      return { country: c, local: full.slice(c.dial_code.length) };
    }
  }

  // No match — return raw digits without leading '+'
  return { country: COUNTRIES[0], local: full.replace(/^\+/, '') };
}

interface AccountScreenProps {
  onBack: () => void;
  initialAccountInfo?: AccountInfo | null;
  initialEntryCount?: number;
  initialPlan?: 'free' | 'premium';
  initialGoals?: ExtendedGoalData | null;
  initialReferralCode?: string | null;
  initialTotalEarnedEntries?: number;

  onRequestSync: () => Promise<void>;
  initialStreakFreeze?: StreakFreezeData | null;
  initialFrozenDates?: string[];
  initialMode?: 'signin' | 'signup';
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  onBack,
  initialAccountInfo,
  initialEntryCount,
  initialPlan,
  initialGoals,
  initialReferralCode,
  initialTotalEarnedEntries,

  onRequestSync,
  initialStreakFreeze,
  initialFrozenDates,
  initialMode = 'signin',
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
  const _initialPhone = parseStoredPhone(initialAccountInfo?.phoneNumber);
  const [phoneInput, setPhoneInput] = useState(_initialPhone.local);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const [selectedCountry, setSelectedCountry] = useState<Country>(_initialPhone.country);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');

  // -- Forgot Password State --
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // -- Validation State --
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [referralCodeError, setReferralCodeError] = useState<string | null>(null);

  // -- User Data State --
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(initialAccountInfo || null);
  const [entryCount, setEntryCount] = useState(initialEntryCount || 0);
  const [plan, setPlan] = useState<'free' | 'premium'>(initialPlan || 'free');
  const [totalEarnedEntries, setTotalEarnedEntries] = useState(initialTotalEarnedEntries || 0);

  const [streakFreeze, setStreakFreeze] = useState<StreakFreezeData | null>(initialStreakFreeze || null);
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



  // -- Dynamic Adjustments State --
  const [dynamicEnabled, setDynamicEnabled] = useState(false);
  const [dynamicThreshold, setDynamicThreshold] = useState<number>(5);
  const [showDynamicHelp, setShowDynamicHelp] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      await loadLocalData();
      const { data } = await authService.getSession();
      if (isMounted && data.session) {
        setAuthSession(data.session);
        if (data.session.user?.email) {
          setEmailInput(data.session.user.email);
        }
      }
      setIsLoading(false);
    };

    init();

    const { data: authListener } = authService.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setAuthSession(session);
      if (session?.user?.email) {
        setEmailInput(session.user.email);
        await syncAccountInfoFromSession(session);
        await loadLocalData();
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // -- Resend countdown timer --
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // -- Helpers --

  const loadLocalData = async () => {
    try {
      const info = await dataStorage.loadAccountInfo();
      const [count, planValue, goalsData, weightEntries, streakData, prefs] = await Promise.all([
        dataStorage.loadEntryCount(),
        dataStorage.loadUserPlan(),
        dataStorage.loadGoals(),
        dataStorage.loadWeightEntries(),
        dataStorage.loadStreakFreeze(),
        dataStorage.loadPreferences(),
      ]);

      if (prefs) {
        setDynamicEnabled(!!prefs.dynamicAdjustmentEnabled);
        setDynamicThreshold(prefs.dynamicAdjustmentThreshold || 5);
      }

      setAccountInfo(info);
      if (info?.name) setName(info.name);
      if (info?.email) setEmailInput(info.email);
      if (info?.phoneNumber) {
        const parsed = parseStoredPhone(info.phoneNumber);
        setPhoneInput(parsed.local);
        setSelectedCountry(parsed.country);
      }

      setEntryCount(count);
      setPlan(planValue);
      setGoals(goalsData);
      setStreakFreeze(streakData);

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
      phoneNumber: existing?.phoneNumber ?? (phoneInput.trim() ? `${selectedCountry.dial_code}${phoneInput.trim()}` : undefined),
      supabaseUserId: session.user.id,
    };

    await dataStorage.saveAccountInfo(merged);
    setAccountInfo(merged);
  };

  const toggleDynamicAdjustment = async (newValue: boolean) => {
    if (plan !== 'premium') return;
    setDynamicEnabled(newValue);

    const currentPrefs = await dataStorage.loadPreferences();
    const updatedPrefs = {
      ...(currentPrefs || {
        weightUnit: 'kg',
        notificationsEnabled: true,
        mealReminders: {
          breakfast: { enabled: false, hour: 8, minute: 0 },
          lunch: { enabled: false, hour: 13, minute: 0 },
          dinner: { enabled: false, hour: 19, minute: 0 }
        }
      }),
      dynamicAdjustmentEnabled: newValue,
      dynamicAdjustmentThreshold: dynamicThreshold,
    };
    // @ts-ignore
    await dataStorage.savePreferences(updatedPrefs);
  };

  const updateDynamicThreshold = async (val: number) => {
    if (plan !== 'premium') return;
    setDynamicThreshold(val);
    const currentPrefs = await dataStorage.loadPreferences();
    const updatedPrefs = {
      ...(currentPrefs || {
        weightUnit: 'kg',
        notificationsEnabled: true,
        mealReminders: {
          breakfast: { enabled: false, hour: 8, minute: 0 },
          lunch: { enabled: false, hour: 13, minute: 0 },
          dinner: { enabled: false, hour: 19, minute: 0 }
        }
      }),
      dynamicAdjustmentEnabled: dynamicEnabled,
      dynamicAdjustmentThreshold: val,
    };
    // @ts-ignore
    await dataStorage.savePreferences(updatedPrefs);
  };


  // -- Computed --
  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
    c.dial_code.includes(countrySearchQuery) ||
    c.code.toLowerCase().includes(countrySearchQuery.toLowerCase())
  );

  // -- Actions --

  // -- Actions --

  const handleSignIn = async () => {
    if (!emailInput.trim() || !password.trim()) {
      setAuthMessage('Please enter email and password.');
      return;
    }
    try {
      setAuthStatus('verifying');
      setAuthMessage(null);
      const { data, error } = await authService.signIn(emailInput.trim(), password);
      if (error) throw error;
      if (data.session) {
        await syncAccountInfoFromSession(data.session);
        await loadLocalData(); // Refresh UI
      }
    } catch (e: any) {
      setAuthMessage(e.message || 'Login failed.');
      // If login fails, suggest reset?
    } finally {
      setAuthStatus('idle');
    }
  };

  const handleForgotPassword = async () => {
    if (!resetInput.trim()) {
      Alert.alert("Missing Info", "Please enter your email.");
      return;
    }

    try {
      setResetLoading(true);
      setAuthMessage(null);

      await authService.resetPasswordForEmail(resetInput.trim());
      setForgotPasswordVisible(false);
      Alert.alert(
        "Reset Link Sent",
        "Check your email (including spam) for password reset instructions. Note: it may take a few minutes to arrive.",
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send reset link. Please try again in a few minutes.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleSignUp = async () => {
    let hasError = false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name.trim()) { setNameError(true); hasError = true; } else setNameError(false);
    if (!emailRegex.test(emailInput.trim())) { setEmailError(true); hasError = true; } else setEmailError(false);

    if (!password.trim() || password.length < 6) {
      setAuthMessage("Password must be at least 6 characters.");
      hasError = true;
    }

    if (hasError) return;

    try {
      setAuthStatus('verifying');
      setAuthMessage(null);

      const { data, error } = await authService.signUp(emailInput.trim().toLowerCase(), password);
      if (error) throw error;

      if (data.session) {
        // Signed in immediately (email confirmation disabled in Supabase)
        const existingInfo = await dataStorage.loadAccountInfo();
        const provisional: AccountInfo = {
          ...(existingInfo || {}),
          name: name.trim(),
          email: emailInput.trim().toLowerCase(),
          supabaseUserId: data.session.user.id,
        };

        await dataStorage.saveAccountInfo(provisional);
        await syncAccountInfoFromSession(data.session);
        await loadLocalData();
      } else if (data.user && !data.session) {
        // Email confirmation is enabled in Supabase — user created but needs to confirm
        Alert.alert(
          'Check your email',
          `We sent a confirmation link to ${emailInput.trim()}. Tap it to activate your account, then sign in.`,
        );
        setAuthMode('signin');
      }
    } catch (e: any) {
      setAuthMessage(e.message || 'Sign up failed.');
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

  // -- Renderers --

  const renderNotLoggedIn = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.summaryContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.formCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>

          {/* Toggle Tabs */}
          <View style={{ flexDirection: 'row', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: authMode === 'signin' ? 2 : 0, borderBottomColor: theme.colors.primary }}
              onPress={() => {
                setAuthMode('signin');
                setAuthMessage(null);
                setPassword('');
                setNameError(false);
                setEmailError(false);
              }}
            >
              <Text style={{ fontWeight: '600', fontSize: 15, color: authMode === 'signin' ? theme.colors.textPrimary : theme.colors.textTertiary }}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: authMode === 'signup' ? 2 : 0, borderBottomColor: theme.colors.primary }}
              onPress={() => {
                setAuthMode('signup');
                setAuthMessage(null);
                setPassword('');
              }}
            >
              <Text style={{ fontWeight: 'bold', color: authMode === 'signup' ? theme.colors.textPrimary : theme.colors.textTertiary }}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 }}>
            {authMode === 'signup'
              ? "Create an account to back up your data and sync across devices."
              : "Welcome back! Sign in to access your data."}
          </Text>

          {/* Name Input (SignUp Only) */}
          {authMode === 'signup' && (
            <>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Name</Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.colors.input,
                  color: theme.colors.textPrimary,
                  borderColor: nameError ? theme.colors.error : theme.colors.border
                }]}
                placeholder="Your name"
                placeholderTextColor={'#A1A1AA'}
                value={name}
                onChangeText={(t) => { setName(t); setNameError(false); }}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
              />
            </>
          )}

          {/* Email Input */}
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, {
              backgroundColor: theme.colors.input,
              color: theme.colors.textPrimary,
              borderColor: emailError ? theme.colors.error : theme.colors.border
            }]}
            placeholder="you@example.com"
            placeholderTextColor={'#A1A1AA'}
            value={emailInput}
            onChangeText={(t) => { setEmailInput(t); setEmailError(false); }}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            autoComplete="email"
          />

          {/* Password Input */}
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Password</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[styles.input, {
                backgroundColor: theme.colors.input,
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
                paddingRight: 44,
              }]}
              placeholder="Min. 6 characters"
              placeholderTextColor={'#A1A1AA'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType={authMode === 'signup' ? 'newPassword' : 'password'}
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name={showPassword ? 'eye' : 'eye-off'} size={18} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {authMode === 'signin' && (
            <TouchableOpacity onPress={() => setForgotPasswordVisible(true)} style={{ alignSelf: 'flex-end', marginTop: 8, marginBottom: 4, paddingVertical: 4 }}>
              <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '500' }}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Auth Message */}
          {authMessage && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.2)',
              borderRadius: 10,
              padding: 12,
              marginTop: 12,
              gap: 8,
            }}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 13, flex: 1 }}>{authMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 16 }]}
            disabled={authStatus !== 'idle'}
            onPress={authMode === 'signup' ? handleSignUp : handleSignIn}
          >
            {authStatus !== 'idle' ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {authMode === 'signup' ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Disabled OAuth placeholders */}
          <View style={{ marginTop: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
              <Text style={{ color: theme.colors.textTertiary, fontSize: 12 }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, opacity: 0.4 }}
              disabled
            >
              <Text style={{ fontSize: 18 }}>G</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '500' }}>Continue with Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, opacity: 0.4 }}
              disabled
            >
              <Feather name="smartphone" size={16} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '500' }}>Continue with Apple</Text>
            </TouchableOpacity>
            <Text style={{ color: theme.colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 2 }}>Google & Apple sign-in coming soon</Text>
          </View>

          {/* Reset All Data */}
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Reset All Data',
                'This will clear all local data (meals, weight, goals, account info) and sign you out. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset Everything',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await authService.signOut();
                      } catch (_) {}
                      await AsyncStorage.clear();
                      setAuthSession(null);
                      setAccountInfo(null);
                      setEmailInput('');
                      setPassword('');
                      setName('');
                      setAuthMessage(null);
                      Alert.alert('Done', 'All data has been cleared.');
                    },
                  },
                ],
              );
            }}
            style={{ alignSelf: 'center', marginTop: 24, paddingVertical: 8 }}
          >
            <Text style={{ color: theme.colors.textTertiary, fontSize: 12 }}>Reset all app data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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

      {/* Account Stats */}
      <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>

        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Account Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Entries</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{entryCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Referrals</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{referralDetails.totalReferrals}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Current Weight</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              {weightSummary.current !== null ? `${Math.round(convertWeightToDisplay(weightSummary.current) * 10) / 10} ${getWeightUnitLabel()}` : '—'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Goal Weight</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              {weightSummary.goal !== null ? `${Math.round(convertWeightToDisplay(weightSummary.goal) * 10) / 10} ${getWeightUnitLabel()}` : '—'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Weight Change</Text>
            <Text style={[styles.statValue, { color: weightSummary.change !== null && weightSummary.change > 0 ? '#22C55E' : theme.colors.textPrimary }]}>
              {weightSummary.change !== null ? `${weightSummary.change > 0 ? '-' : '+'}${Math.abs(Math.round(convertWeightToDisplay(weightSummary.change) * 10) / 10)} ${getWeightUnitLabel()}` : '—'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Daily Calorie Goal</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
              {goals?.calories ? `${goals.calories} kcal` : '—'}
            </Text>
          </View>
        </View>

      </View>


      {/* Actions */}
      <TouchableOpacity style={[styles.logoutButton, { borderColor: theme.colors.border }]} onPress={handleSignOut}>
        <Feather name="log-out" size={18} color={theme.colors.error} />
        <Text style={[styles.logoutButtonText, { color: theme.colors.error }]}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: 'rgba(239, 68, 68, 0.3)',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderRadius: 10,
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginTop: 12,
        }}
        onPress={() => {
          Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all associated data. This action cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete My Account',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await authService.deleteAccount();
                    await AsyncStorage.clear();
                    setAuthSession(null);
                    setAccountInfo(null);
                    setEntryCount(0);
                    setGoals(null);
                    setWeightSummary({ starting: null, current: null, goal: null, change: null });
                    Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
                    onBack();
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Failed to delete account. Please try again.');
                  }
                },
              },
            ]
          );
        }}
      >
        <Feather name="trash-2" size={16} color="#EF4444" />
        <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>Delete Account</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ alignSelf: 'center', padding: 10, marginTop: 4 }} onPress={handleClearData}>
        <Text style={{ color: theme.colors.textTertiary, fontSize: 12 }}>Clear All Local Data</Text>
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
        authSession ? renderLoggedIn() : renderNotLoggedIn()
      )}

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Select Country</Text>
                <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                  <Feather name="x" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.input, borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, height: 40, borderWidth: 1, borderColor: theme.colors.border }}>
                <Feather name="search" size={16} color={theme.colors.textTertiary} style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, color: theme.colors.textPrimary, height: '100%' }}
                  placeholder="Search country..."
                  placeholderTextColor={theme.colors.textTertiary}
                  value={countrySearchQuery}
                  onChangeText={setCountrySearchQuery}
                  autoCorrect={false}
                />
                {countrySearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setCountrySearchQuery('')}>
                    <Feather name="x-circle" size={16} color={theme.colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
                    onPress={() => {
                      setSelectedCountry(item);
                      setShowCountryPicker(false);
                      setCountrySearchQuery(''); // Reset search
                    }}
                  >
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{item.code === 'AE' ? '🇦🇪' : item.code === 'US' ? '🇺🇸' : item.code === 'GB' ? '🇬🇧' : '🏳️'}</Text>
                    <Text style={{ fontSize: 16, color: theme.colors.textPrimary, flex: 1 }}>{item.name}</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textSecondary }}>{item.dial_code}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      {/* Forgot Password Modal */}
      <Modal
        visible={forgotPasswordVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setForgotPasswordVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Reset Password</Text>
                <TouchableOpacity onPress={() => setForgotPasswordVisible(false)}>
                  <Feather name="x" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 8 }}>
                Enter your email to receive a reset link.
              </Text>

              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.colors.input,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border
                }]}
                placeholder="john@example.com"
                placeholderTextColor={theme.colors.textTertiary}
                value={resetInput}
                onChangeText={setResetInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 16 }, resetLoading && styles.primaryButtonDisabled]}
                onPress={handleForgotPassword}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView >
  );
};
// End of AccountScreen

// -- Styles --
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
  cardTitle: {
    fontSize: Typography.fontSize.md,
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
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 12,
  },
  statItem: {
    width: '47%',
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

