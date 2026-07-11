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
import { Acid } from '../constants/acid';
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
}) => {  const { convertWeightToDisplay, getWeightUnitLabel } = usePreferences();

  // -- Auth State --
  // If we have stored account info with an email, treat as logged in until session check completes
  const [authSession, setAuthSession] = useState<Session | null>(
    initialAccountInfo?.email ? ({ user: { email: initialAccountInfo.email } } as any) : null
  );
  const [isLoading, setIsLoading] = useState(!initialAccountInfo && initialAccountInfo !== null);
  const [authStatus, setAuthStatus] = useState<'idle' | 'sending' | 'verifying'>('idle');
  const [authMessage, setAuthMessage] = useState<string | null>(null);

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

  const [selectedCountry, setSelectedCountry] = useState<Country>(_initialPhone.country);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  // Which underline input has focus — its hairline turns lime.
  const [focusedField, setFocusedField] = useState<'name' | 'email' | 'password' | null>(null);

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
      } else if (isMounted) {
        // No real session: demote the optimistic fake session seeded from the
        // cached email, so we never show a logged-in view that cannot sign out.
        setAuthSession(null);
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

  // Keep the plan badge and the dynamic-adjustment gates in sync with the
  // canonical entitlement passed from HomeScreen (respects sign-in and the
  // launch flag), not the raw stored plan string.
  useEffect(() => {
    setPlan(initialPlan || 'free');
  }, [initialPlan]);

  // -- Helpers --

  const loadLocalData = async () => {
    try {
      const info = await dataStorage.loadAccountInfo();
      const [count, goalsData, weightEntries, streakData, prefs] = await Promise.all([
        dataStorage.loadEntryCount(),
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
    await dataStorage.savePreferences({ dynamicAdjustmentEnabled: newValue });
  };

  const updateDynamicThreshold = async (val: number) => {
    if (plan !== 'premium') return;
    setDynamicThreshold(val);
    await dataStorage.savePreferences({ dynamicAdjustmentThreshold: val });
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
        // Email confirmation is enabled in Supabase — user created but needs to
        // confirm. Persist just the name (not a signed-in identity) so the
        // greeting survives the round trip after they confirm and sign in.
        await dataStorage.saveAccountInfo({ name: name.trim() });
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

  // Acid on Moss underline input — no boxes, a hairline that turns lime on focus.
  const acidField = (opts: { key: 'name' | 'email' | 'password'; error?: boolean }) => ({
    borderBottomWidth: 1.5,
    borderBottomColor: opts.error ? Acid.error : focusedField === opts.key ? Acid.lime : Acid.hair2,
  });

  const renderNotLoggedIn = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 8, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <Text style={{ fontSize: 12, letterSpacing: 4, fontWeight: '700', color: Acid.tx2 }}>
          TRACK<Text style={{ color: Acid.lime }}>KCAL</Text>
        </Text>

        {/* Headline — the serif voice */}
        <Text style={{
          fontFamily: Acid.serifItalic,
          fontSize: 34,
          lineHeight: 41,
          color: Acid.tx,
          marginTop: 22,
        }}>
          {authMode === 'signup' ? (
            <>Every meal, <Text style={{ color: Acid.lime, fontFamily: Acid.serif }}>understood.</Text></>
          ) : (
            <>Welcome <Text style={{ color: Acid.lime, fontFamily: Acid.serif }}>back.</Text></>
          )}
        </Text>

        <Text style={{ color: Acid.tx2, fontSize: 13, lineHeight: 20, marginTop: 12, marginBottom: 30 }}>
          {authMode === 'signup'
            ? 'One account backs up your data and follows you across devices.'
            : 'Sign in and your meals, weights, and plan come with you.'}
        </Text>

        {/* Name (signup only) */}
        {authMode === 'signup' && (
          <View style={{ marginBottom: 22 }}>
            <Text style={{ fontSize: 10, letterSpacing: 2, color: Acid.tx3, textTransform: 'uppercase' }}>Name</Text>
            <TextInput
              style={[{ color: Acid.tx, fontSize: 16, paddingVertical: 10, paddingHorizontal: 0 }, acidField({ key: 'name', error: nameError })]}
              placeholder="Your name"
              placeholderTextColor={Acid.tx3}
              value={name}
              onChangeText={(t) => { setName(t); setNameError(false); }}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
            />
          </View>
        )}

        {/* Email */}
        <View style={{ marginBottom: 22 }}>
          <Text style={{ fontSize: 10, letterSpacing: 2, color: Acid.tx3, textTransform: 'uppercase' }}>Email</Text>
          <TextInput
            style={[{ color: Acid.tx, fontSize: 16, paddingVertical: 10, paddingHorizontal: 0 }, acidField({ key: 'email', error: emailError })]}
            placeholder="you@example.com"
            placeholderTextColor={Acid.tx3}
            value={emailInput}
            onChangeText={(t) => { setEmailInput(t); setEmailError(false); }}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            autoComplete="email"
          />
        </View>

        {/* Password */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 10, letterSpacing: 2, color: Acid.tx3, textTransform: 'uppercase' }}>Password</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[{ color: Acid.tx, fontSize: 16, paddingVertical: 10, paddingHorizontal: 0, paddingRight: 40 }, acidField({ key: 'password' })]}
              placeholder="Min. 6 characters"
              placeholderTextColor={Acid.tx3}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              secureTextEntry={!showPassword}
              textContentType={authMode === 'signup' ? 'newPassword' : 'password'}
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name={showPassword ? 'eye' : 'eye-off'} size={17} color={Acid.tx3} />
            </TouchableOpacity>
          </View>
        </View>

        {authMode === 'signin' && (
          <TouchableOpacity onPress={() => setForgotPasswordVisible(true)} style={{ alignSelf: 'flex-end', marginTop: 6, paddingVertical: 4 }}>
            <Text style={{ color: Acid.lime, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {/* Auth error — plain text, no box */}
        {authMessage && (
          <Text style={{ color: Acid.error, fontSize: 13, lineHeight: 19, marginTop: 14 }}>
            {authMessage}
          </Text>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: Acid.lime,
            borderRadius: 999,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 28,
            shadowColor: Acid.lime,
            shadowOpacity: 0.35,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
            opacity: authStatus !== 'idle' ? 0.7 : 1,
          }}
          disabled={authStatus !== 'idle'}
          onPress={authMode === 'signup' ? handleSignUp : handleSignIn}
        >
          {authStatus !== 'idle' ? (
            <ActivityIndicator color={Acid.moss} />
          ) : (
            <Text style={{ color: Acid.moss, fontSize: 15, fontWeight: '800' }}>
              {authMode === 'signup' ? 'Create account' : 'Sign in'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Mode switch — a sentence, not tabs */}
        <TouchableOpacity
          onPress={() => {
            setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
            setAuthMessage(null);
            setPassword('');
            setNameError(false);
            setEmailError(false);
          }}
          style={{ alignSelf: 'center', marginTop: 22, paddingVertical: 6 }}
        >
          <Text style={{ color: Acid.tx2, fontSize: 13 }}>
            {authMode === 'signin' ? 'New here? ' : 'Already have an account? '}
            <Text style={{ color: Acid.lime, fontWeight: '700' }}>
              {authMode === 'signin' ? 'Create account' : 'Sign in'}
            </Text>
          </Text>
        </TouchableOpacity>

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
            style={{ alignSelf: 'center', marginTop: 26, paddingVertical: 8 }}
          >
            <Text style={{ color: Acid.tx3, fontSize: 11, letterSpacing: 0.5 }}>Reset all app data</Text>
          </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderLoggedIn = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.summaryContent} showsVerticalScrollIndicator={false}>
      {/* Profile Card */}
      <View style={[styles.summaryCard, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: Acid.lime, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: 'white', fontWeight: 'bold' }}>{accountInfo?.name?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
          <View>
            <Text style={[styles.profileName, { color: Acid.tx }]}>{accountInfo?.name || 'User'}</Text>
            <Text style={[styles.profileEmail, { color: Acid.tx2 }]}>{accountInfo?.email}</Text>
          </View>
        </View>
        <View style={[styles.planBadge, { alignSelf: 'flex-start', marginTop: 12, backgroundColor: plan === 'premium' ? Acid.lime : Acid.mossDeep }]}>
          <Text style={[styles.planBadgeText, { color: plan === 'premium' ? 'white' : Acid.tx2 }]}>
            {plan === 'premium' ? 'Premium Plan' : 'Free Plan'}
          </Text>
        </View>
      </View>

      {/* Stats Card */}

      {/* Account Stats */}
      <View style={[styles.summaryCard, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>

        <Text style={[styles.sectionTitle, { color: Acid.tx }]}>Account Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: Acid.tx2 }]}>Total Entries</Text>
            <Text style={[styles.statValue, { color: Acid.tx }]}>{entryCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: Acid.tx2 }]}>Referrals</Text>
            <Text style={[styles.statValue, { color: Acid.tx }]}>{referralDetails.totalReferrals}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: Acid.tx2 }]}>Current Weight</Text>
            <Text style={[styles.statValue, { color: Acid.tx }]}>
              {weightSummary.current !== null ? `${Math.round(convertWeightToDisplay(weightSummary.current) * 10) / 10} ${getWeightUnitLabel()}` : '—'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: Acid.tx2 }]}>Goal Weight</Text>
            <Text style={[styles.statValue, { color: Acid.tx }]}>
              {weightSummary.goal !== null ? `${Math.round(convertWeightToDisplay(weightSummary.goal) * 10) / 10} ${getWeightUnitLabel()}` : '—'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: Acid.tx2 }]}>Weight Change</Text>
            <Text style={[styles.statValue, { color: weightSummary.change !== null && weightSummary.change > 0 ? Acid.good : Acid.tx }]}>
              {weightSummary.change !== null ? `${weightSummary.change > 0 ? '-' : '+'}${Math.abs(Math.round(convertWeightToDisplay(weightSummary.change) * 10) / 10)} ${getWeightUnitLabel()}` : '—'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: Acid.tx2 }]}>Daily Calorie Goal</Text>
            <Text style={[styles.statValue, { color: Acid.tx }]}>
              {goals?.calories ? `${goals.calories} kcal` : '—'}
            </Text>
          </View>
        </View>

      </View>


      {/* Actions */}
      <TouchableOpacity style={[styles.logoutButton, { borderColor: Acid.hair }]} onPress={handleSignOut}>
        <Feather name="log-out" size={18} color={Acid.error} />
        <Text style={[styles.logoutButtonText, { color: Acid.error }]}>Sign Out</Text>
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
        <Text style={{ color: Acid.error, fontSize: 14, fontWeight: '600' }}>Delete Account</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ alignSelf: 'center', padding: 10, marginTop: 4 }} onPress={handleClearData}>
        <Text style={{ color: Acid.tx3, fontSize: 12 }}>Clear All Local Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // The signed-out view is the first screen living fully in the Acid on Moss
  // redesign; the signed-in account view keeps the legacy theme until its turn.
  const isAcid = !authSession && !isLoading;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isAcid ? Acid.moss : Acid.moss }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isAcid ? 'transparent' : Acid.hair }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={isAcid ? Acid.tx2 : Acid.tx} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Acid.tx }]}>
          {authSession ? 'My Account' : ''}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Acid.lime} />
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
            <View style={{ backgroundColor: Acid.mossDeep, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: Acid.tx }}>Select Country</Text>
                <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                  <Feather name="x" size={24} color={Acid.tx} />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Acid.mossDeep, borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, height: 40, borderWidth: 1, borderColor: Acid.hair }}>
                <Feather name="search" size={16} color={Acid.tx3} style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, color: Acid.tx, height: '100%' }}
                  placeholder="Search country..."
                  placeholderTextColor={Acid.tx3}
                  value={countrySearchQuery}
                  onChangeText={setCountrySearchQuery}
                  autoCorrect={false}
                />
                {countrySearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setCountrySearchQuery('')}>
                    <Feather name="x-circle" size={16} color={Acid.tx3} />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Acid.hair }}
                    onPress={() => {
                      setSelectedCountry(item);
                      setShowCountryPicker(false);
                      setCountrySearchQuery(''); // Reset search
                    }}
                  >
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{item.code === 'AE' ? '🇦🇪' : item.code === 'US' ? '🇺🇸' : item.code === 'GB' ? '🇬🇧' : '🏳️'}</Text>
                    <Text style={{ fontSize: 16, color: Acid.tx, flex: 1 }}>{item.name}</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: Acid.tx2 }}>{item.dial_code}</Text>
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
            <View style={{ backgroundColor: Acid.mossDeep, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: Acid.tx }}>Reset Password</Text>
                <TouchableOpacity onPress={() => setForgotPasswordVisible(false)}>
                  <Feather name="x" size={24} color={Acid.tx2} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 14, color: Acid.tx2, marginBottom: 8 }}>
                Enter your email to receive a reset link.
              </Text>

              <TextInput
                style={[styles.input, {
                  backgroundColor: Acid.mossDeep,
                  color: Acid.tx,
                  borderColor: Acid.hair
                }]}
                placeholder="john@example.com"
                placeholderTextColor={Acid.tx3}
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
    backgroundColor: '#171717', // Neutral-900 or Acid.tx equivalent
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: Acid.moss,
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
    backgroundColor: Acid.good,
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
    backgroundColor: Acid.good,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  signOutButtonText: {
    color: Acid.moss,
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
    color: Acid.moss,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
});

