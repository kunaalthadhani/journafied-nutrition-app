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
  onOpenAdvancedAnalytics?: () => void;
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
  onOpenAdvancedAnalytics,
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
  const [phoneInput, setPhoneInput] = useState(() => {
    // If we have an initial phone, we might need to parse it? 
    // For now, simpler to start empty or just raw. 
    // If initialAccountInfo.phoneNumber exists, it's likely full string "+97150..."
    // We should parse it ideally, but for now let's just leave it blank or raw
    // and let user fix it if they edit.
    // simpler:
    return '';
  });
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);
  const [otpCode, setOtpCode] = useState('');

  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // Default UAE
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');

  // -- Forgot Password State --
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState<'email' | 'phone'>('email');
  const [resetInput, setResetInput] = useState('');

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
      if (info?.phoneNumber) setPhoneInput(info.phoneNumber);

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
      phoneNumber: existing?.phoneNumber ?? (phoneInput.trim() || undefined),
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
      Alert.alert("Missing Info", `Please enter your ${forgotPasswordMode}.`);
      return;
    }

    try {
      setAuthMessage(null); // Clear previous
      setForgotPasswordVisible(false); // Close modal

      if (forgotPasswordMode === 'email') {
        await authService.resetPasswordForEmail(resetInput.trim());
        Alert.alert("Reset Link Sent", "Check your email for password reset instructions.");
      } else {
        // Phone flow (simulated as we might not have SMS set up, or standard OTP login)
        // Using signInWithOTP for phone is the standard way to 'verify' ownership then they can change password?
        // Or actually just 'Login with OTP'.
        Alert.alert("Coming Soon", "SMS reset is currently being configured. Please use Email reset for now.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send reset link.");
    }
  };

  const handleSignUp = async () => {
    let hasError = false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!otpSent) {
      // Phase 1: Validation
      if (!name.trim()) { setNameError(true); hasError = true; } else setNameError(false);
      if (!emailRegex.test(emailInput.trim())) { setEmailError(true); hasError = true; } else setEmailError(false);

      // Phone Validation
      const cleanPhone = phoneInput.replace(/\D/g, '');
      const finalPhoneBody = cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone;

      if (!finalPhoneBody || finalPhoneBody.length < 5) {
        setPhoneError(true);
        hasError = true;
      } else {
        setPhoneError(false);
      }

      if (!hasAcceptedTerms) { setTermsError(true); hasError = true; } else setTermsError(false);

      if (hasError) return;

      // Send OTP
      try {
        setAuthStatus('sending');
        setAuthMessage(null);
        const { error } = await authService.sendSignupOtp(emailInput.trim());
        if (error) throw error;
        setOtpSent(true);
        Alert.alert('Code Sent', `We sent a verification code to ${emailInput.trim()}.`);
      } catch (e: any) {
        setAuthMessage(e.message || 'Failed to send code.');
      } finally {
        setAuthStatus('idle');
      }

    } else {
      // Phase 2: Verify & Create
      if (!otpCode.trim() || otpCode.length < 6) {
        setAuthMessage('Please enter the 6-digit code.');
        return;
      }

      try {
        setAuthStatus('verifying');
        setAuthMessage(null);

        const { data, error } = await authService.verifyOtp(emailInput.trim(), otpCode.trim());
        if (error) throw error;

        if (data.session) {
          const cleanPhone = phoneInput.replace(/\D/g, '');
          const finalPhoneBody = cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone;
          const fullPhoneNumber = `${selectedCountry.dial_code}${finalPhoneBody}`;

          const existingInfo = await dataStorage.loadAccountInfo();
          const provisional: AccountInfo = {
            ...(existingInfo || {}),
            name: name.trim(),
            email: emailInput.trim(),
            phoneNumber: fullPhoneNumber,
            supabaseUserId: data.session.user.id,
          };

          // Referrals + Premium Bonus (3 Days)
          if (referralCode.trim()) {
            const validation = await referralService.validateReferralCodeForRedemption(referralCode.trim(), emailInput.trim());
            if (validation.valid) {
              await referralService.createReferralRedemption(validation.referralCode!, emailInput.trim(), name.trim());

              // Grant 3 Days Premium
              let currentExpiry = provisional.premiumUntil ? new Date(provisional.premiumUntil) : new Date();
              if (currentExpiry < new Date()) currentExpiry = new Date(); // If expired, start from now
              currentExpiry.setDate(currentExpiry.getDate() + 3);

              provisional.premiumUntil = currentExpiry.toISOString();
              Alert.alert('Referral Bonus Unlocked! 🎉', '+3 Days Premium Access & 5 Free Entries');
            }
          }

          await dataStorage.saveAccountInfo(provisional);
          await syncAccountInfoFromSession(data.session);



          await loadLocalData();
        }
      } catch (e: any) {
        setAuthMessage(e.message || 'Verification failed.');
      } finally {
        setAuthStatus('idle');
      }
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
              onPress={() => setAuthMode('signin')}
            >
              <Text style={{ fontWeight: 'bold', color: authMode === 'signin' ? theme.colors.textPrimary : theme.colors.textTertiary }}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: authMode === 'signup' ? 2 : 0, borderBottomColor: theme.colors.primary }}
              onPress={() => setAuthMode('signup')}
            >
              <Text style={{ fontWeight: 'bold', color: authMode === 'signup' ? theme.colors.textPrimary : theme.colors.textTertiary }}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.helperText, { color: theme.colors.textSecondary, marginBottom: 20 }]}>
            {authMode === 'signup'
              ? "Enter your details to sync your progress and get free entry bonuses."
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
                placeholder="John Doe"
                placeholderTextColor={theme.colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
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
            placeholder="john@example.com"
            placeholderTextColor={theme.colors.textTertiary}
            value={emailInput}
            onChangeText={setEmailInput}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* OTP Input (Signup Only - Phase 2) */}
          {authMode === 'signup' && otpSent ? (
            <>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Verification Code</Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.colors.input,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.primary,
                  textAlign: 'center',
                  letterSpacing: 8,
                  fontSize: 24,
                  fontWeight: 'bold'
                }]}
                placeholder="000000"
                placeholderTextColor={theme.colors.textTertiary}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity onPress={() => { setOtpSent(false); setAuthMessage('Resend code or edit email.'); }} style={{ marginTop: 8 }}>
                <Text style={{ color: theme.colors.primary, fontSize: 13, textAlign: 'center' }}>Wrong email? Edit details</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Password Input (SignIn Only) */}
              {authMode === 'signin' && (
                <>
                  <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Password</Text>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: theme.colors.input,
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.border
                    }]}
                    placeholder="••••••"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </>
              )}
            </>
          )}

          {authMode === 'signin' && (
            <TouchableOpacity onPress={() => setForgotPasswordVisible(true)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
              <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '500' }}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Additional SignUp Fields */}
          {authMode === 'signup' && (
            <>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Phone Number</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* Country Picker Trigger */}
                <TouchableOpacity
                  style={{
                    height: 50,
                    backgroundColor: theme.colors.input,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    justifyContent: 'center',
                    alignItems: 'center',
                    minWidth: 80
                  }}
                  onPress={() => setShowCountryPicker(true)}
                >
                  <Text style={{ color: theme.colors.textPrimary, fontWeight: 'bold' }}>{selectedCountry.dial_code}</Text>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 10 }}>{selectedCountry.code}</Text>
                </TouchableOpacity>

                {/* Phone Input */}
                <TextInput
                  style={[styles.input, {
                    flex: 1,
                    backgroundColor: theme.colors.input,
                    color: theme.colors.textPrimary,
                    borderColor: phoneError ? theme.colors.error : theme.colors.border
                  }]}
                  placeholder={selectedCountry.placeholder}
                  placeholderTextColor={theme.colors.textTertiary}
                  value={phoneInput}
                  onChangeText={(text) => {
                    // Start stripping lead 0 immediately for UX? 
                    // Or just let them type and strip validly. 
                    // User said "50... not 050". If they type 0, we can ignore it?
                    if (text.length === 1 && text === '0') return; // Prevent leading 0 if starting
                    setPhoneInput(text);
                  }}
                  keyboardType="phone-pad"
                />
              </View>

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

              {/* Terms Checkbox */}
              <TouchableOpacity style={styles.termsRow} onPress={() => setHasAcceptedTerms(!hasAcceptedTerms)}>
                <View style={[styles.checkbox, { borderColor: termsError ? theme.colors.error : theme.colors.border }]}>
                  {hasAcceptedTerms && <View style={styles.checkboxInner} />}
                </View>
                <Text style={[styles.helperText, { flex: 1, color: theme.colors.textSecondary }]}>
                  I agree to the Terms & Conditions
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Action Button */}
          {authMessage && <Text style={{ color: theme.colors.textPrimary, textAlign: 'center', marginVertical: 8 }}>{authMessage}</Text>}

          <TouchableOpacity
            style={[styles.primaryButton, (authMode === 'signup' && !hasAcceptedTerms) && styles.primaryButtonDisabled]}
            disabled={(authMode === 'signup' && !hasAcceptedTerms) || authStatus !== 'idle'}
            onPress={authMode === 'signup' ? handleSignUp : handleSignIn}
          >
            {authStatus !== 'idle' ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {authMode === 'signup'
                  ? (otpSent ? 'Verify & Create Account' : 'Send Verification Code')
                  : 'Sign In'}
              </Text>
            )}
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
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Log Streak</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{entryCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Referrals</Text>
            <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{referralDetails.totalReferrals}</Text>
          </View>
        </View>

        {/* Premium: Streak Freeze Status */}
        {plan === 'premium' && streakFreeze && (
          <View style={{ marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: 'rgba(59, 130, 246, 0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recovery Days</Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>Automatic protection for missed days.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[1, 2].map((i) => (
                <Text key={i} style={{ fontSize: 18, opacity: i <= streakFreeze.freezesAvailable ? 1 : 0.3 }}>
                  ❄️
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Advanced Analytics Menu Item */}
      {onOpenAdvancedAnalytics && (
        <TouchableOpacity
          style={[styles.summaryCard, {
            backgroundColor: 'rgba(139, 92, 246, 0.05)',
            borderColor: 'rgba(139, 92, 246, 0.3)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16
          }]}
          onPress={onOpenAdvancedAnalytics}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: 8, borderRadius: 8 }}>
              <Feather name="bar-chart-2" size={24} color="#8B5CF6" />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Advanced Analytics</Text>
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary }}>View trends, heatmaps & insights</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      )}

      {/* Smart Dynamic Adjustments (Placement: After Advanced Analytics) */}
      <View style={[styles.summaryCard, { marginTop: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.cardTitle, { color: theme.colors.textPrimary, marginBottom: 0 }]}>Smart Dynamic Adjustments</Text>
            {plan === 'premium' ? (
              <View style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>PRO</Text>
              </View>
            ) : (
              <Feather name="lock" size={14} color={theme.colors.textTertiary} />
            )}
          </View>
          <Switch
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={'white'}
            ios_backgroundColor={theme.colors.border}
            onValueChange={toggleDynamicAdjustment}
            value={dynamicEnabled}
            disabled={plan !== 'premium'}
          />
        </View>

        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
          Automatically adapts your nutrition plan as your body changes to prevent plateaus.
        </Text>

        {dynamicEnabled && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>Adjustment Threshold:</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[3, 4, 5].map((val) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => updateDynamicThreshold(val)}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    alignItems: 'center',
                    borderRadius: 6,
                    backgroundColor: dynamicThreshold === val ? 'rgba(59, 130, 246, 0.1)' : theme.colors.background,
                    borderWidth: 1,
                    borderColor: dynamicThreshold === val ? theme.colors.primary : theme.colors.border,
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: dynamicThreshold === val ? theme.colors.primary : theme.colors.textSecondary
                  }}>{val}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: theme.colors.textTertiary, fontSize: 11, marginTop: 4 }}>
              We'll suggest a Plan Update when your weight changes by {dynamicThreshold}%.
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={() => setShowDynamicHelp(true)} style={{ alignSelf: 'flex-start' }}>
          <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '500' }}>How it works</Text>
        </TouchableOpacity>
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

              {/* Type Selection */}
              <View style={{ flexDirection: 'row', marginBottom: 16, borderRadius: 8, backgroundColor: theme.colors.secondaryBg, padding: 4 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: forgotPasswordMode === 'email' ? theme.colors.card : 'transparent', shadowOpacity: forgotPasswordMode === 'email' ? 0.1 : 0 }}
                  onPress={() => setForgotPasswordMode('email')}
                >
                  <Text style={{ fontWeight: '600', color: forgotPasswordMode === 'email' ? theme.colors.textPrimary : theme.colors.textSecondary }}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: forgotPasswordMode === 'phone' ? theme.colors.card : 'transparent', shadowOpacity: forgotPasswordMode === 'phone' ? 0.1 : 0 }}
                  onPress={() => setForgotPasswordMode('phone')}
                >
                  <Text style={{ fontWeight: '600', color: forgotPasswordMode === 'phone' ? theme.colors.textPrimary : theme.colors.textSecondary }}>SMS</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 8 }}>
                Enter your {forgotPasswordMode} to receive a reset code.
              </Text>

              {forgotPasswordMode === 'email' ? (
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
              ) : (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{
                      height: 50,
                      backgroundColor: theme.colors.input,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      justifyContent: 'center',
                      alignItems: 'center',
                      minWidth: 80
                    }}
                    onPress={() => setShowCountryPicker(true)}
                  >
                    <Text style={{ color: theme.colors.textPrimary, fontWeight: 'bold' }}>{selectedCountry.dial_code}</Text>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 10 }}>{selectedCountry.code}</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.input, {
                      flex: 1,
                      backgroundColor: theme.colors.input,
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.border
                    }]}
                    placeholder={selectedCountry.placeholder}
                    placeholderTextColor={theme.colors.textTertiary}
                    value={resetInput}
                    onChangeText={(text) => {
                      if (text.length === 1 && text === '0') return;
                      setResetInput(text);
                    }}
                    keyboardType="phone-pad"
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 16 }]}
                onPress={handleForgotPassword}
              >
                <Text style={styles.primaryButtonText}>Send Reset Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showDynamicHelp}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDynamicHelp(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Why Dynamic Adjustments?</Text>
              <TouchableOpacity onPress={() => setShowDynamicHelp(false)}>
                <Feather name="x" size={24} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.primary, textAlign: 'center' }}>
                📉 Smaller Body = Lower Energy Needs
              </Text>
            </View>

            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22, marginBottom: 12 }}>
              When you lose weight, your body requires fewer calories to maintain itself.
            </Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22, marginBottom: 20 }}>
              If you keep eating the same amount, your weight loss will eventually stop (a "plateau"). To prevent this, we automatically suggest small updates to your plan when you make significant progress.
            </Text>

            <TouchableOpacity
              onPress={() => setShowDynamicHelp(false)}
              style={{ backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
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

