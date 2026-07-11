import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { Typography } from '../constants/typography';
import { Acid } from '../constants/acid';
import { APP_VERSION } from '../constants/appVersion';
import { usePreferences } from '../contexts/PreferencesContext';
import { featureFlags } from '../config/featureFlags';
import { dataStorage } from '../services/dataStorage';
import { authService } from '../services/authService';
import { useUser } from '../contexts/UserContext';
import { SettingItem, SettingSection } from '../components/SettingsComponents';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';
import { IntegrationsScreen } from './IntegrationsScreen';
import { CalorieBankConfig } from '../services/dataStorage';
import { enableCalorieBank, disableCalorieBank, updateCalorieBankSettings, archiveInProgressCycle } from '../services/calorieBankService';
import { getDayName } from '../utils/calorieBankEngine';
import { format, startOfDay } from 'date-fns';

interface SettingsScreenProps {
  onBack: () => void;
  plan?: 'free' | 'premium';
  onOpenSubscription?: () => void;
  onLogin?: () => void;
  onIntegrations?: () => void;
  onDowngradeToFree?: () => void;
  onGrocerySuggestions?: () => void;
  onSetGoals?: () => void;
  onOpenAbout?: () => void;
  onOpenFeedback?: () => void;
  onAdminPush?: () => void;
  onHowItWorks?: () => void;
  renderAccountScreen?: (onBack: () => void) => React.ReactNode;
  onAccountClose?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  plan = 'free',
  onOpenSubscription,
  onLogin,
  onIntegrations,
  onDowngradeToFree,
  onGrocerySuggestions,
  onSetGoals,
  onOpenAbout,
  onOpenFeedback,
  onAdminPush,
  onHowItWorks,
  renderAccountScreen,
  onAccountClose,
}) => {
  const { weightUnit, setWeightUnit } = usePreferences();
  // Source of truth for whether the user is signed in. Reactive — when
  // UserContext refreshes (after signup, sign-in, sign-out, ITP rehydrate)
  // every screen re-renders. No more stale sticky notes.
  const { accountInfo } = useUser();
  const isSignedIn = !!accountInfo?.email;

  // Slide-up panel state
  type SlideUpType = 'account' | 'notifications' | 'connections' | 'weightUnit' | 'dynamic' | 'smartSuggest' | 'patternDetection' | 'weeklyOverview' | 'grocery' | 'calorieBank';
  const [activeSlideUp, setActiveSlideUp] = useState<SlideUpType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const adminTapCount = useRef(0);
  const adminTapTimer = useRef<NodeJS.Timeout | null>(null);
  const activeSlideUpRef = useRef<SlideUpType | null>(null);

  // Feature flags & settings. Smart Suggest defaults OFF for new accounts.
  const [smartSuggestEnabled, setSmartSuggestEnabled] = useState(false);
  const [groceryUnlocked, setGroceryUnlocked] = useState(false);
  const [groceryProgress, setGroceryProgress] = useState({ loggedDays: 0, uniqueFoods: 0 });
  const [dynamicEnabled, setDynamicEnabled] = useState(false);
  const [dynamicThreshold, setDynamicThreshold] = useState<number>(5);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [loadedPreferences, setLoadedPreferences] = useState<any>(null);
  // isSignedIn is now derived from UserContext above. Local useState removed.

  // Calorie Bank
  const [calorieBankConfig, setCalorieBankConfig] = useState<CalorieBankConfig | null>(null);
  // Base daily calorie goal, used to show the real kcal a cap percent works out to.
  const [baseCalorieTarget, setBaseCalorieTarget] = useState(2000);
  const [bankExampleTab, setBankExampleTab] = useState<'lose' | 'maintain' | 'gain'>('lose');

  // Shared slide-up animation
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const slideUpAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const openSlideUp = (type: SlideUpType) => {
    // Block double-tap: if a slide-up is already open or animating, ignore the second tap.
    if (activeSlideUpRef.current !== null) return;

    const premiumFeatures = ['dynamic', 'smartSuggest', 'patternDetection', 'weeklyOverview', 'grocery', 'calorieBank'];
    if (premiumFeatures.includes(type)) {
      if (!isSignedIn) {
        Alert.alert('Sign In Required', 'You need to sign in to access premium features.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => openSlideUp('account') },
        ]);
        return;
      }
      if (plan !== 'premium') {
        onOpenSubscription?.();
        return;
      }
    }
    if (type === 'account' && !renderAccountScreen) {
      onLogin?.();
      return;
    }
    if (type === 'calorieBank') {
      // Refresh in case the config or base target changed out of band (e.g. a
      // sync from another device) since this screen mounted.
      dataStorage.loadCalorieBankConfig().then(setCalorieBankConfig).catch(() => {});
      dataStorage.loadGoals().then(g => { if (g?.calories) setBaseCalorieTarget(g.calories); }).catch(() => {});
    }
    activeSlideUpRef.current = type;
    setActiveSlideUp(type);
    slideUpAnim.setValue(SCREEN_HEIGHT);
    Animated.spring(slideUpAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 90,
      overshootClamping: true,
    }).start();
  };

  const closeSlideUp = () => {
    const closingType = activeSlideUpRef.current;
    Animated.timing(slideUpAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(async () => {
      setActiveSlideUp(null);
      activeSlideUpRef.current = null;
      if (closingType === 'account') {
        // isSignedIn is reactive via UserContext. Just notify parent to
        // refresh its own state and the auth listener will propagate.
        onAccountClose?.();
      }
    });
  };

  const slideUpPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) slideUpAnim.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          closeSlideUp();
        } else {
          Animated.spring(slideUpAnim, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    checkFeatureFlags();
  }, []);

  const checkFeatureFlags = async () => {
    try {
      // isSignedIn is now reactive via UserContext (see useUser above).
      // checkFeatureFlags only loads the local-only settings that this screen
      // owns (preferences, weight, grocery, calorie bank).
      const prefs = await dataStorage.loadPreferences();
      setLoadedPreferences(prefs);
      setSmartSuggestEnabled(prefs?.smartSuggestEnabled === true);
      setDynamicEnabled(prefs?.dynamicAdjustmentEnabled === true);
      setDynamicThreshold(prefs?.dynamicAdjustmentThreshold || 5);

      const entries = await dataStorage.loadWeightEntries();
      if (entries && entries.length > 0) {
        const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setCurrentWeightKg(sorted[0].weight);
      }

      // Grocery unlock check
      const unlocked = await dataStorage.isGroceryUnlocked();
      setGroceryUnlocked(unlocked);
      if (!unlocked) {
        const progress = await dataStorage.checkGroceryUnlockEligibility();
        setGroceryProgress({ loggedDays: progress.loggedDays, uniqueFoods: progress.uniqueFoods });
      }

      // Calorie Bank
      const bankConfig = await dataStorage.loadCalorieBankConfig();
      setCalorieBankConfig(bankConfig);
      const goals = await dataStorage.loadGoals();
      if (goals?.calories) setBaseCalorieTarget(goals.calories);
    } catch (e) {
      console.error("Error checking feature flags", e);
    }
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

  const handleClearCache = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all app data? This will delete all your meals, weight entries, goals, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            // Push any unsynced offline changes to the cloud first so a signed-in
            // user does not lose edits that had not synced yet. Their cloud data is
            // re-pulled after the reload below. Best effort: if offline, proceed.
            try { await dataStorage.flushSyncQueue(); } catch { /* proceed regardless */ }
            try {
              await AsyncStorage.clear();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
              return;
            }
            // Actually restart so no context keeps re-persisting the state we
            // just wiped. The old build only claimed it would restart and never
            // did, leaving the app running on ghost data.
            try {
              if (Platform.OS === 'web') {
                (globalThis as any).location?.reload();
              } else {
                await Updates.reloadAsync();
              }
            } catch {
              Alert.alert('Data Cleared', 'All app data has been cleared. Please fully close and reopen the app.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account & Data',
      'This will disable your account and permanently delete all your data from our servers and this device. This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await authService.deleteAccount();
              Alert.alert('Account Deleted', 'Your account and data have been removed. You have been signed out.', [{ text: 'OK', onPress: () => onBack() }]);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Could not delete your account. Nothing was changed, please try again.');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleAbout = () => {
    Alert.alert('About TrackKcal', `Version ${APP_VERSION}\n\nA nutrition and fitness tracking app to help you achieve your health goals.`, [{ text: 'OK' }]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Acid.moss }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Acid.hair }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Acid.tx} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Acid.tx }]}>
          Settings
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Account & Subscription Section */}
        <SettingSection title="Account & Plan">
          <SettingItem
            icon="user"
            title="My Account"
            subtitle="Manage your profile and login"
            onPress={() => openSlideUp('account')}
          />

          <View style={[styles.subscriptionRow, { borderBottomColor: Acid.hair, opacity: isSignedIn ? 1 : 0.5 }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Feather name="star" size={18} color={plan === 'premium' ? Acid.lime : Acid.tx2} style={{ width: 30 }} />
              <View>
                <Text style={[styles.settingTitle, { color: Acid.tx }]}>Current Plan</Text>
                <Text style={{ color: Acid.tx2, fontSize: 13 }}>
                  {!isSignedIn ? 'Sign in to manage your plan' : plan === 'premium' ? 'Premium Plan' : 'Free Plan'}
                </Text>
              </View>
            </View>
            {isSignedIn ? (
              <TouchableOpacity
                style={{ backgroundColor: Acid.lime, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 }}
                onPress={() => {
                  if (plan === 'premium') Alert.alert('Premium', 'You are already on Premium.');
                  else onOpenSubscription?.();
                }}
              >
                <Text style={{ color: Acid.moss, fontWeight: '700', fontSize: 13 }}>
                  {plan === 'premium' ? 'Manage' : 'Upgrade'}
                </Text>
              </TouchableOpacity>
            ) : (
              <MaterialCommunityIcons name="shield-lock-outline" size={16} color={Acid.tx3} />
            )}
          </View>

          {/* Dev Tools for Plan */}
          {__DEV__ && plan === 'premium' && (
            <TouchableOpacity style={{ padding: 12, alignItems: 'center' }} onPress={onDowngradeToFree}>
              <Text style={{ color: Acid.tx3, fontSize: 11 }}>(Dev) Downgrade to Free</Text>
            </TouchableOpacity>
          )}
        </SettingSection>

        {/* App Preferences */}
        <SettingSection title="App Preferences">
          <SettingItem
            icon="target"
            title="Nutrition Goals"
            subtitle="Daily target and macro split"
            onPress={() => onSetGoals?.()}
          />
          <SettingItem
            icon="bell"
            title="Notifications"
            subtitle="Meal reminders & updates"
            onPress={() => openSlideUp('notifications')}
          />
          <SettingItem
            icon="activity"
            title="Connections"
            subtitle="Apple Health, Google Fit"
            onPress={() => openSlideUp('connections')}
          />
          <SettingItem
            icon="sliders"
            title="Weight Unit"
            subtitle={weightUnit === 'kg' ? 'Kilograms (kg)' : 'Pounds (lbs)'}
            onPress={() => openSlideUp('weightUnit')}
          />
          {plan === 'premium' && isSignedIn ? (
            <SettingItem
              icon="zap"
              title="Smart Suggest"
              subtitle={smartSuggestEnabled ? 'On · Suggestions on Home' : 'Off · Tap to configure'}
              onPress={() => openSlideUp('smartSuggest')}
            />
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="zap"
                title="Smart Suggest"
                subtitle="Show next meal suggestions on Home"
                onPress={() => openSlideUp('smartSuggest')}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={Acid.tx3} />}
                showChevron={false}
              />
            </View>
          )}
          {plan === 'premium' && isSignedIn && groceryUnlocked ? (
            <SettingItem
              icon="shopping-cart"
              title="Grocery Suggestions"
              subtitle="AI-Powered Lists · Hold to open"
              onPress={() => openSlideUp('grocery')}
              onLongPress={() => onGrocerySuggestions?.()}
            />
          ) : plan === 'premium' && isSignedIn && !groceryUnlocked ? (
            <View style={{ opacity: 0.7 }}>
              <SettingItem
                icon="shopping-cart"
                title="Grocery Suggestions"
                subtitle={`${groceryProgress.loggedDays}/5 days · ${groceryProgress.uniqueFoods}/7 foods to unlock`}
                onPress={() => Alert.alert('Grocery Suggestions', `Log 5 days and 7 unique foods to unlock AI grocery lists.\n\nYou have ${groceryProgress.loggedDays}/5 days and ${groceryProgress.uniqueFoods}/7 foods so far.`)}
                rightElement={
                  <View style={{ backgroundColor: Acid.lime + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: Acid.lime }}>{Math.round(((Math.min(groceryProgress.loggedDays, 5) + Math.min(groceryProgress.uniqueFoods, 7)) / 12) * 100)}%</Text>
                  </View>
                }
                showChevron={false}
              />
            </View>
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="shopping-cart"
                title="Grocery Suggestions"
                subtitle="AI-Powered Lists"
                onPress={() => openSlideUp('grocery')}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={Acid.tx3} />}
                showChevron={false}
              />
            </View>
          )}
          {plan === 'premium' && isSignedIn ? (
            <SettingItem
              icon="trending-up"
              title="Dynamic Adjustments"
              subtitle={dynamicEnabled ? `On · ${dynamicThreshold}% threshold` : 'Auto-adjust your plan as your body changes'}
              onPress={() => openSlideUp('dynamic')}
            />
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="trending-up"
                title="Dynamic Adjustments"
                subtitle="Auto-adjust your plan as your body changes"
                onPress={() => openSlideUp('dynamic')}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={Acid.tx3} />}
                showChevron={false}
              />
            </View>
          )}
          {plan === 'premium' && isSignedIn ? (
            <SettingItem
              icon="credit-card"
              title="Calorie Bank"
              subtitle={calorieBankConfig?.enabled ? `On · Resets every ${getDayName(calorieBankConfig.cycleStartDay)}` : 'Flexible weekly calorie budgeting'}
              onPress={() => openSlideUp('calorieBank')}
            />
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="credit-card"
                title="Calorie Bank"
                subtitle="Flexible weekly calorie budgeting"
                onPress={() => openSlideUp('calorieBank')}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={Acid.tx3} />}
                showChevron={false}
              />
            </View>
          )}
          {plan === 'premium' && isSignedIn ? (
            <SettingItem
              icon="eye"
              title="Pattern Detection"
              subtitle="Active · Analyzing your eating habits"
              onPress={() => openSlideUp('patternDetection')}
            />
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="eye"
                title="Pattern Detection"
                subtitle="Spot trends in your eating habits"
                onPress={() => openSlideUp('patternDetection')}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={Acid.tx3} />}
                showChevron={false}
              />
            </View>
          )}
          {plan === 'premium' && isSignedIn ? (
            <SettingItem
              icon="bar-chart-2"
              title="Weekly AI Overview"
              subtitle="Active · New insights every Monday"
              onPress={() => openSlideUp('weeklyOverview')}
            />
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="bar-chart-2"
                title="Weekly AI Overview"
                subtitle="Personalized nutrition insights every week"
                onPress={() => openSlideUp('weeklyOverview')}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={Acid.tx3} />}
                showChevron={false}
              />
            </View>
          )}
        </SettingSection>

        {/* Support & Legal */}
        <SettingSection title="Support & Legal">
          <SettingItem icon="help-circle" title="Help & Support" onPress={() => Alert.alert('Help', 'Support content coming soon.')} />
          <SettingItem icon="book-open" title="How it Works" onPress={onHowItWorks} />
          <SettingItem icon="mail" title="Send Feedback" subtitle="Tell us what to fix or build" onPress={() => onOpenFeedback?.()} />
          <SettingItem icon="file-text" title="Privacy Policy" onPress={() => Alert.alert('Privacy', 'Privacy Policy')} />
          <SettingItem icon="file-text" title="Terms of Service" onPress={() => Alert.alert('Terms', 'Terms of Service')} />
          <SettingItem icon="info" title="About" onPress={() => (onOpenAbout ? onOpenAbout() : handleAbout())} />
        </SettingSection>

        {/* Data Management */}
        <SettingSection title="Data Management">
          <SettingItem
            icon="trash-2"
            title="Clear Cache"
            subtitle="Delete all local app data"
            onPress={handleClearCache}
          />
          <SettingItem
            icon="user-x"
            title="Delete Account"
            subtitle={isDeleting ? 'Deleting…' : 'Permanently remove your account and data'}
            onPress={handleDeleteAccount}
          />
        </SettingSection>

        {/* Dev Tools */}
        {__DEV__ && (
          <SettingSection title="Developer Tools">
            <SettingItem
              title="Inject Plateau Data"
              subtitle="Test Smart Coach"
              onPress={() => {
                dataStorage.debug_injectPlateauData();
                Alert.alert('Done', 'Plateau data injected.');
              }}
            />
          </SettingSection>
        )}

        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            adminTapCount.current += 1;
            if (adminTapTimer.current) clearTimeout(adminTapTimer.current);
            adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 2000);
            if (adminTapCount.current >= 7) {
              adminTapCount.current = 0;
              onAdminPush?.();
            }
          }}
        >
          <Text style={{ textAlign: 'center', color: Acid.tx3, fontSize: Typography.fontSize.xs, paddingVertical: 24 }}>
            TrackKcal v{APP_VERSION}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Unified Slide-Up Modal ── */}
      <Modal
        visible={activeSlideUp !== null}
        transparent={true}
        animationType="none"
        onRequestClose={closeSlideUp}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
          {/* Tappable backdrop (5% gap) */}
          <TouchableOpacity style={{ height: SCREEN_HEIGHT * 0.05 }} activeOpacity={1} onPress={closeSlideUp} />

          <Animated.View
            style={{
              height: SCREEN_HEIGHT * 0.95,
              backgroundColor: Acid.moss,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
              transform: [{ translateY: slideUpAnim }],
            }}
          >
            {/* Drag handle */}
            <View
              style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}
              {...slideUpPanResponder.panHandlers}
            >
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Acid.hair2 }} />
            </View>

            {/* ── Account ── */}
            {activeSlideUp === 'account' && renderAccountScreen?.(closeSlideUp)}

            {/* ── Notifications ── */}
            {activeSlideUp === 'notifications' && (
              <NotificationSettingsScreen
                onBack={closeSlideUp}
                initialPreferences={loadedPreferences}
              />
            )}

            {/* ── Connections ── */}
            {activeSlideUp === 'connections' && (
              <IntegrationsScreen onBack={closeSlideUp} />
            )}

            {/* ── Weight Unit ── */}
            {activeSlideUp === 'weightUnit' && (
              <View style={{ flex: 1 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Acid.hair }}>
                  <TouchableOpacity onPress={closeSlideUp} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={Acid.tx2} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontFamily: Acid.serifItalic, fontSize: 19, color: Acid.tx }}>Weight Unit</Text>
                  </View>
                  <View style={{ width: 40 }} />
                </View>

                <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
                  <TouchableOpacity
                    style={styles.unitOption}
                    onPress={async () => { await setWeightUnit('kg'); closeSlideUp(); }}
                  >
                    <Text style={[styles.unitOptionText, { color: weightUnit === 'kg' ? Acid.tx : Acid.tx2 }]}>Kilograms (kg)</Text>
                    {weightUnit === 'kg' && <Feather name="check" size={20} color={Acid.lime} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.unitOption}
                    onPress={async () => { await setWeightUnit('lbs'); closeSlideUp(); }}
                  >
                    <Text style={[styles.unitOptionText, { color: weightUnit === 'lbs' ? Acid.tx : Acid.tx2 }]}>Pounds (lbs)</Text>
                    {weightUnit === 'lbs' && <Feather name="check" size={20} color={Acid.lime} />}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Dynamic Adjustments ── */}
            {activeSlideUp === 'dynamic' && (
              <>
                {/* Header — down arrow left, title center */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Acid.hair }}>
                  <TouchableOpacity onPress={closeSlideUp} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={Acid.tx2} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: Acid.serifItalic, fontSize: 19, color: Acid.tx }}>Dynamic Adjustments</Text>
                      <MaterialCommunityIcons name="crown" size={14} color={Acid.lime} />
                    </View>
                  </View>
                  <View style={{ width: 40 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                  {/* Toggle */}
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 4, marginBottom: 24,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Acid.tx }}>
                      {dynamicEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <Switch
                      trackColor={{ false: Acid.hair, true: Acid.lime }}
                      thumbColor={'white'}
                      ios_backgroundColor={Acid.hair}
                      onValueChange={toggleDynamicAdjustment}
                      value={dynamicEnabled}
                    />
                  </View>

                  {/* Threshold (visible when enabled) */}
                  {dynamicEnabled && (
                    <View style={{ marginBottom: 24 }}>
                      <Text style={{ color: Acid.tx, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>Adjustment Threshold</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {[3, 4, 5].map((val) => {
                          const isActive = dynamicThreshold === val;
                          const absAmount = currentWeightKg ? (currentWeightKg * val / 100) : null;
                          const displayAmount = absAmount
                            ? weightUnit === 'lbs'
                              ? `${(absAmount * 2.20462).toFixed(1)} lbs`
                              : `${absAmount.toFixed(1)} kg`
                            : null;
                          return (
                            <TouchableOpacity
                              key={val}
                              onPress={() => updateDynamicThreshold(val)}
                              style={{
                                flex: 1,
                                paddingVertical: 10,
                                alignItems: 'center',
                                borderBottomWidth: 2,
                                borderBottomColor: isActive ? Acid.lime : 'transparent',
                              }}
                            >
                              <Text style={{
                                fontSize: 18,
                                fontWeight: '700',
                                color: isActive ? Acid.lime : Acid.tx3,
                              }}>{val}%</Text>
                              {displayAmount && (
                                <Text style={{
                                  fontSize: 11,
                                  color: isActive ? Acid.tx2 : Acid.tx3,
                                  marginTop: 2,
                                }}>{displayAmount}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={{ color: Acid.tx3, fontSize: 12, marginTop: 10 }}>
                        We'll suggest a plan update when your weight changes by {dynamicThreshold}%
                        {currentWeightKg ? ` (about ${weightUnit === 'lbs' ? `${(currentWeightKg * dynamicThreshold / 100 * 2.20462).toFixed(1)} lbs` : `${(currentWeightKg * dynamicThreshold / 100).toFixed(1)} kg`})` : ''}.
                      </Text>
                    </View>
                  )}

                  {/* Divider */}
                  <View style={{ height: 1, backgroundColor: Acid.hair, marginBottom: 24 }} />

                  {/* How it works */}
                  <Text style={{ fontSize: 16, fontWeight: '700', color: Acid.tx, marginBottom: 12 }}>How it works</Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 12 }}>
                    As you lose weight, your body needs fewer calories to maintain itself. If your calorie plan stays the same, your progress will eventually slow down and stop. That's called a plateau.
                  </Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 24 }}>
                    Dynamic Adjustments keeps an eye on your weight trend and automatically suggests small updates to your nutrition plan when you hit your chosen threshold, so your progress keeps moving.
                  </Text>

                  {/* Example */}
                  <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx, marginBottom: 14 }}>Example</Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 16 }}>
                    Say you weigh 100 kg and your daily calorie target is 2,000 kcal. As you lose weight, your body burns fewer calories at rest, so that same 2,000 kcal plan gradually becomes less effective.
                  </Text>

                  {/* 3% row */}
                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>3% threshold</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Triggers at 97 kg. Your target might adjust from 2,000 to ~1,940 kcal. Smaller, more frequent updates.
                    </Text>
                  </View>

                  {/* 4% row */}
                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>4% threshold</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Triggers at 96 kg. Your target might adjust from 2,000 to ~1,900 kcal. A balanced middle ground.
                    </Text>
                  </View>

                  {/* 5% row */}
                  <View style={{ paddingVertical: 12, marginBottom: 16, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>5% threshold</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Triggers at 95 kg. Your target might adjust from 2,000 to ~1,800 kcal. Fewer but bigger updates.
                    </Text>
                  </View>

                  <Text style={{ fontSize: 13, color: Acid.tx3, lineHeight: 20 }}>
                    The lower the threshold, the more often you'll get suggestions. Pick what feels right for you.
                  </Text>
                </ScrollView>
              </>
            )}

            {/* Smart Suggest Slide-Up */}
            {activeSlideUp === 'smartSuggest' && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Acid.hair }}>
                  <TouchableOpacity onPress={closeSlideUp} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={Acid.tx2} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: Acid.serifItalic, fontSize: 19, color: Acid.tx }}>Smart Suggest</Text>
                      <MaterialCommunityIcons name="crown" size={14} color={Acid.lime} />
                    </View>
                  </View>
                  <View style={{ width: 40 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                  {/* Toggle */}
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 4, marginBottom: 24,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Acid.tx }}>
                      {smartSuggestEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <Switch
                      trackColor={{ false: Acid.hair, true: Acid.lime }}
                      thumbColor={'white'}
                      ios_backgroundColor={Acid.hair}
                      onValueChange={(val) => {
                        setSmartSuggestEnabled(val);
                        dataStorage.savePreferences({ smartSuggestEnabled: val });
                      }}
                      value={smartSuggestEnabled}
                    />
                  </View>

                  <View style={{ height: 1, backgroundColor: Acid.hair, marginBottom: 24 }} />

                  <Text style={{ fontSize: 16, fontWeight: '700', color: Acid.tx, marginBottom: 12 }}>How it works</Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 12 }}>
                    Smart Suggest learns from your eating patterns and recommends what to eat next based on your goals, the time of day, and what you've already logged today.
                  </Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 24 }}>
                    Suggestions appear on your Home screen as a quick-add card. Tap any suggestion to instantly log it, or dismiss it if you have something else in mind.
                  </Text>

                  <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx, marginBottom: 14 }}>Where to find it</Text>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Home screen</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      A suggestion card appears below your food log when Smart Suggest is enabled. It updates throughout the day as you log meals.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, marginBottom: 16, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Adapts to you</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      The more you log, the better the suggestions get. It factors in your macro targets, calorie budget remaining, and foods you actually enjoy eating.
                    </Text>
                  </View>
                </ScrollView>
              </>
            )}

            {/* Pattern Detection Slide-Up */}
            {activeSlideUp === 'patternDetection' && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Acid.hair }}>
                  <TouchableOpacity onPress={closeSlideUp} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={Acid.tx2} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: Acid.serifItalic, fontSize: 19, color: Acid.tx }}>Pattern Detection</Text>
                      <MaterialCommunityIcons name="crown" size={14} color={Acid.lime} />
                    </View>
                  </View>
                  <View style={{ width: 40 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                  {/* Status */}
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 4, marginBottom: 24,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Acid.tx }}>Always Active</Text>
                    <Text style={{ color: Acid.good, fontSize: 12, fontWeight: '700' }}>Running</Text>
                  </View>

                  <View style={{ height: 1, backgroundColor: Acid.hair, marginBottom: 24 }} />

                  <Text style={{ fontSize: 16, fontWeight: '700', color: Acid.tx, marginBottom: 12 }}>How it works</Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 12 }}>
                    Pattern Detection runs in the background and analyzes your food log history to find recurring habits, both good and bad. It looks at what you eat, when you eat, and how your intake shifts across days of the week.
                  </Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 24 }}>
                    When a pattern is detected, a card appears on your Home screen explaining what was found and suggesting a specific action you can take to improve.
                  </Text>

                  <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx, marginBottom: 14 }}>What it detects</Text>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Weekend overeating</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Flags when your Saturday and Sunday intake consistently exceeds your weekday average by a significant margin.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Late-night eating</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Identifies when a large portion of your calories are being logged in the evening, which can affect sleep and weight management.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Protein gaps</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Detects when your protein intake is consistently below your target, which can impact muscle retention and satiety.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, marginBottom: 16, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Consistency streaks</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Recognizes when you've been hitting your targets consistently, so you know what's working.
                    </Text>
                  </View>

                  <Text style={{ fontSize: 13, color: Acid.tx3, lineHeight: 20 }}>
                    Patterns are refreshed automatically as you log more data. The more you track, the more accurate the detection becomes.
                  </Text>
                </ScrollView>
              </>
            )}

            {/* Grocery Suggestions Slide-Up */}
            {activeSlideUp === 'grocery' && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Acid.hair }}>
                  <TouchableOpacity onPress={closeSlideUp} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={Acid.tx2} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: Acid.serifItalic, fontSize: 19, color: Acid.tx }}>Grocery Suggestions</Text>
                      <MaterialCommunityIcons name="crown" size={14} color={Acid.lime} />
                    </View>
                  </View>
                  <View style={{ width: 40 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: Acid.tx, marginBottom: 12 }}>How it works</Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 12 }}>
                    Grocery Suggestions uses AI to generate a personalized shopping list based on your nutrition goals, the foods you already enjoy, and your macro targets.
                  </Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 24 }}>
                    Instead of guessing what to buy, you get a curated list that aligns with your calorie budget and helps you stay on track for the week ahead.
                  </Text>

                  <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx, marginBottom: 14 }}>Features</Text>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>1 Week or 2 Weeks</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Choose how far ahead you want to shop. The 1 week option gives you just enough for the next 7 days. The 2 week option doubles all quantities so you can do a bigger shop and avoid midweek trips.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Weekly Plan Impact</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      At the bottom of your list you'll see a summary showing the total calories, protein, carbs, and fats the grocery list covers for your chosen duration. It also shows your expected weight change if you follow the plan, so you can see the real impact before you shop.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Healthier swaps</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      If the AI detects that a significant portion of your recent calories came from processed food, it will flag how many calories were replaced with healthier staples. This shows you the exact calorie difference between what you were eating and what the new list provides.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Organized by category</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Items are grouped into proteins, fiber, carbs, and fats so you can move through the store efficiently without backtracking.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, marginBottom: 24, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Export and share</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Export your grocery list as a PDF to share with someone else or keep on your phone while you shop.
                    </Text>
                  </View>

                  {/* Open Grocery Screen Button */}
                  <TouchableOpacity
                    onPress={() => {
                      closeSlideUp();
                      setTimeout(() => onGrocerySuggestions?.(), 300);
                    }}
                    style={{
                      backgroundColor: Acid.lime,
                      borderRadius: 999,
                      paddingVertical: 16,
                      alignItems: 'center',
                      shadowColor: Acid.lime, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6,
                    }}
                  >
                    <Text style={{ color: Acid.moss, fontSize: 15, fontWeight: '700' }}>Generate Grocery List</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}

            {/* Weekly AI Overview Slide-Up */}
            {activeSlideUp === 'weeklyOverview' && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Acid.hair }}>
                  <TouchableOpacity onPress={closeSlideUp} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={Acid.tx2} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: Acid.serifItalic, fontSize: 19, color: Acid.tx }}>Weekly AI Overview</Text>
                      <MaterialCommunityIcons name="crown" size={14} color={Acid.lime} />
                    </View>
                  </View>
                  <View style={{ width: 40 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                  {/* Status */}
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 4, marginBottom: 24,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Acid.tx }}>Always Active</Text>
                    <Text style={{ color: Acid.good, fontSize: 12, fontWeight: '700' }}>Running</Text>
                  </View>

                  <View style={{ height: 1, backgroundColor: Acid.hair, marginBottom: 24 }} />

                  <Text style={{ fontSize: 16, fontWeight: '700', color: Acid.tx, marginBottom: 12 }}>How it works</Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 12 }}>
                    Every week, our AI reviews your complete nutrition data including what you ate, how much, when, and how it compares to your goals, then writes a personalized analysis just for you.
                  </Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 24 }}>
                    This isn't generic advice. Each insight references your actual numbers, specific foods, and real patterns from the past 7 days.
                  </Text>

                  <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx, marginBottom: 14 }}>What you get</Text>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Target comparison</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      See exactly how your average intake stacks up against your calorie and macro goals, with specific numbers.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Day-by-day patterns</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Identifies which days you went off-track and explains why, so you can plan ahead next week.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, marginBottom: 16, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Actionable next steps</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Each insight comes with a concrete suggestion you can try this week. Not vague advice, but something specific to your data.
                    </Text>
                  </View>

                  <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx, marginBottom: 14 }}>Where to find it</Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 16 }}>
                    Open Nutrition Analysis from the Home screen, then tap the Insights tab. A new overview is generated every Monday based on the previous week's data.
                  </Text>

                  <Text style={{ fontSize: 13, color: Acid.tx3, lineHeight: 20 }}>
                    The more days you log each week, the more useful and specific your insights will be.
                  </Text>
                </ScrollView>
              </>
            )}
            {/* ── Calorie Bank ── */}
            {activeSlideUp === 'calorieBank' && (
              <>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Acid.hair }}>
                  <TouchableOpacity onPress={closeSlideUp} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={Acid.tx2} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: Acid.serifItalic, fontSize: 19, color: Acid.tx }}>Calorie Bank</Text>
                      <MaterialCommunityIcons name="crown" size={14} color={Acid.lime} />
                    </View>
                  </View>
                  <View style={{ width: 40 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                  {/* Toggle */}
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 4, marginBottom: 24,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Acid.tx }}>
                      {calorieBankConfig?.enabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <Switch
                      trackColor={{ false: Acid.hair, true: Acid.lime }}
                      thumbColor={'white'}
                      ios_backgroundColor={Acid.hair}
                      onValueChange={async (val) => {
                        if (val) {
                          // Optimistic update first so Switch doesn't bounce back
                          setCalorieBankConfig(prev => prev
                            ? { ...prev, enabled: true }
                            : { enabled: true, cycleStartDay: 1, dailyCapPercent: 20, spendingCapPercent: 20, enabledDate: format(startOfDay(new Date()), 'yyyy-MM-dd') }
                          );
                          const config = await enableCalorieBank();
                          setCalorieBankConfig(config);
                        } else {
                          setCalorieBankConfig(prev => prev ? { ...prev, enabled: false } : null);
                          await disableCalorieBank();
                        }
                      }}
                      value={calorieBankConfig?.enabled || false}
                    />
                  </View>

                  {/* Settings (visible when enabled) */}
                  {calorieBankConfig?.enabled && (
                    <>
                      {/* Cycle Start Day */}
                      <View style={{ marginBottom: 24 }}>
                        <Text style={{ color: Acid.tx, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>Cycle Start Day</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                            const isActive = calorieBankConfig.cycleStartDay === day;
                            const applyStartDay = async () => {
                              const [summaries, goals] = await Promise.all([
                                dataStorage.loadDailySummaries(),
                                dataStorage.loadGoals(),
                              ]);
                              // Archiving the in-progress week and restructuring the cycle
                              // must be atomic. updateCalorieBankSettings resets enabledDate
                              // to today, so if the plan fails to load or archiving throws we
                              // must NOT proceed, or this week's banked calories are orphaned
                              // with no history record.
                              if (!goals) {
                                Alert.alert('Could not change start day', 'Your plan failed to load. Please try again.');
                                return;
                              }
                              try {
                                await archiveInProgressCycle(summaries, goals);
                              } catch (e) {
                                Alert.alert('Could not change start day', 'Saving this week to your history failed. Nothing was changed, please try again.');
                                return;
                              }
                              const updated = await updateCalorieBankSettings({ cycleStartDay: day as CalorieBankConfig['cycleStartDay'] });
                              if (updated) setCalorieBankConfig(updated);
                            };
                            return (
                              <TouchableOpacity
                                key={day}
                                onPress={() => {
                                  if (isActive) return;
                                  Alert.alert(
                                    'Change start day?',
                                    'This starts a new week today. The days so far this week are saved to your history.',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      { text: 'Change', style: 'destructive', onPress: applyStartDay },
                                    ]
                                  );
                                }}
                                style={{
                                  paddingVertical: 8, paddingHorizontal: 6,
                                  borderBottomWidth: 2,
                                  borderBottomColor: isActive ? Acid.lime : 'transparent',
                                }}
                              >
                                <Text style={{
                                  fontSize: 14, fontWeight: '600',
                                  color: isActive ? Acid.lime : Acid.tx3,
                                }}>{getDayName(day)}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={{ color: Acid.tx3, fontSize: 12, marginTop: 8 }}>
                          Your weekly budget resets every {getDayName(calorieBankConfig.cycleStartDay)}. Any unused banked calories expire at reset.
                        </Text>
                      </View>

                      {/* Daily Banking Cap */}
                      <View style={{ marginBottom: 24 }}>
                        <Text style={{ color: Acid.tx, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>Daily Banking Cap</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {([15, 20, 25] as const).map((pct) => {
                            // Show the user's chosen cap (pending if they just changed it),
                            // not the active cap that is still running out the current week.
                            const selectedCap = calorieBankConfig.pendingDailyCapPercent ?? calorieBankConfig.dailyCapPercent;
                            const isActive = selectedCap === pct;
                            return (
                              <TouchableOpacity
                                key={pct}
                                onPress={async () => {
                                  const updated = await updateCalorieBankSettings({ dailyCapPercent: pct, spendingCapPercent: pct });
                                  if (updated) setCalorieBankConfig(updated);
                                }}
                                style={{
                                  flex: 1, paddingVertical: 10, alignItems: 'center',
                                  borderBottomWidth: 2,
                                  borderBottomColor: isActive ? Acid.lime : 'transparent',
                                }}
                              >
                                <Text style={{
                                  fontSize: 18, fontWeight: '700',
                                  color: isActive ? Acid.lime : Acid.tx3,
                                }}>{pct}%</Text>
                                <Text style={{
                                  fontSize: 11,
                                  color: isActive ? Acid.tx2 : Acid.tx3,
                                  marginTop: 2,
                                }}>~{Math.round(baseCalorieTarget * pct / 100)} kcal</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {calorieBankConfig.pendingDailyCapPercent !== undefined &&
                          calorieBankConfig.pendingDailyCapPercent !== calorieBankConfig.dailyCapPercent && (
                          <Text style={{ color: Acid.lime, fontSize: 12, marginTop: 8 }}>
                            New cap applies from your next cycle ({getDayName(calorieBankConfig.cycleStartDay)}). This week keeps its current cap.
                          </Text>
                        )}
                        <Text style={{ color: Acid.tx3, fontSize: 12, marginTop: 8 }}>
                          The maximum you can bank or spend beyond your daily target in a single day. This prevents extreme restriction or overeating.
                        </Text>
                      </View>
                    </>
                  )}

                  {/* Divider */}
                  <View style={{ height: 1, backgroundColor: Acid.hair, marginBottom: 24 }} />

                  {/* Simple explanation */}
                  <Text style={{ fontSize: 16, fontWeight: '700', color: Acid.tx, marginBottom: 12 }}>How it works</Text>

                  <Text style={{ fontSize: 14, color: Acid.tx2, lineHeight: 22, marginBottom: 20 }}>
                    Your daily calorie target gets multiplied by 7 to create a weekly budget. Eat less on some days, and those saved calories spread across the rest of your week. Eat more on another day, and the extra gets deducted from the remaining days. As long as your weekly total stays on track, you are making progress.
                  </Text>

                  <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.good, marginBottom: 4 }}>Banked</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Calories you did not use today. They transfer to the remaining days of your week, giving you a slightly higher target on those days.
                    </Text>
                  </View>

                  <View style={{ paddingVertical: 12, marginBottom: 20, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.error, marginBottom: 4 }}>Surplus</Text>
                    <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20 }}>
                      Calories you ate over your daily target. They get deducted from the remaining days of your week, slightly reducing each day's target.
                    </Text>
                  </View>

                  {/* Example with tabs */}
                  <Text style={{ fontSize: 15, fontWeight: '700', color: Acid.tx, marginBottom: 14 }}>Example</Text>

                  {/* Goal type tabs */}
                  <View style={{ flexDirection: 'row', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Acid.hair }}>
                    {(['lose', 'maintain', 'gain'] as const).map((tab) => {
                      const isActive = bankExampleTab === tab;
                      const label = tab === 'lose' ? 'Lose' : tab === 'maintain' ? 'Maintain' : 'Gain';
                      return (
                        <TouchableOpacity
                          key={tab}
                          onPress={() => setBankExampleTab(tab)}
                          style={{
                            flex: 1, paddingVertical: 10, alignItems: 'center',
                            borderBottomWidth: 2, marginBottom: -1,
                            borderBottomColor: isActive ? Acid.lime : 'transparent',
                          }}
                        >
                          <Text style={{
                            fontSize: 13, fontWeight: '600',
                            color: isActive ? Acid.lime : Acid.tx3,
                          }}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {bankExampleTab === 'lose' && (
                    <>
                      <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20, marginBottom: 12 }}>
                        Daily target: 2,000 kcal. Weekly budget: 14,000 kcal.
                      </Text>
                      <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Monday: 1,650 kcal</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18 }}>350 banked. The remaining 6 days each go up by ~58 kcal.</Text>
                      </View>
                      <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Tue to Fri: On target</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18 }}>Adjusted target is slightly above 2,000. You eat normally.</Text>
                      </View>
                      <View style={{ paddingVertical: 12, marginBottom: 16, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Saturday: Dinner out, 2,350 kcal</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18 }}>350 surplus, covered by banked calories. Weekly total: 13,900. Under budget.</Text>
                      </View>
                    </>
                  )}

                  {bankExampleTab === 'maintain' && (
                    <>
                      <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20, marginBottom: 12 }}>
                        Daily target: 2,200 kcal. Weekly budget: 15,400 kcal.
                      </Text>
                      <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Weekdays: ~2,000 kcal</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18 }}>You save about 200 per day. 1,000 goes into the bank for the weekend.</Text>
                      </View>
                      <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Saturday: Brunch + dinner, 2,700 kcal</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18 }}>500 surplus. Bank covers it. Maintenance range stays intact.</Text>
                      </View>
                      <View style={{ paddingVertical: 12, marginBottom: 16, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Sunday: Relaxed, 2,300 kcal</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18 }}>Weekly total: 15,300. Within budget. Weight stays stable.</Text>
                      </View>
                    </>
                  )}

                  {bankExampleTab === 'gain' && (
                    <>
                      <Text style={{ fontSize: 13, color: Acid.tx2, lineHeight: 20, marginBottom: 12 }}>
                        Daily target: 3,000 kcal. Weekly budget: 21,000 kcal. For gaining, banking works in reverse: eating over target saves the surplus.
                      </Text>
                      <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Training days: 3,500 kcal</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18 }}>500 over target gets banked. You can eat less on rest days without falling behind.</Text>
                      </View>
                      <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Rest days: 2,625 kcal</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18 }}>Appetite is lower. The bank covers the shortfall from training day surplus.</Text>
                      </View>
                      <View style={{ paddingVertical: 12, marginBottom: 16, borderTopWidth: 1, borderTopColor: Acid.hair }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Acid.tx, marginBottom: 4 }}>Weekly result</Text>
                        <Text style={{ fontSize: 12, color: Acid.tx2, lineHeight: 18 }}>Total: 21,000 kcal. Right on target even though no two days looked the same.</Text>
                      </View>
                    </>
                  )}

                  {/* Safety notes */}
                  <View style={{ height: 1, backgroundColor: Acid.hair, marginVertical: 16 }} />

                  <Text style={{ fontSize: 14, fontWeight: '700', color: Acid.tx, marginBottom: 10 }}>Good to know</Text>

                  <Text style={{ fontSize: 12, color: Acid.tx3, lineHeight: 18, marginBottom: 8 }}>
                    Your daily target will never drop below 1,500 kcal for men or 1,200 kcal for women, no matter what.
                  </Text>
                  <Text style={{ fontSize: 12, color: Acid.tx3, lineHeight: 18, marginBottom: 8 }}>
                    If you skip logging for a day, the app assumes you ate your base target. No banking, no penalty.
                  </Text>
                  <Text style={{ fontSize: 12, color: Acid.tx3, lineHeight: 18, marginBottom: 8 }}>
                    The bank resets to zero on your chosen start day. Unused banked calories expire.
                  </Text>
                  <Text style={{ fontSize: 12, color: Acid.tx3, lineHeight: 18 }}>
                    Your protein, carbs, and fat scale with the adjusted target. Percentages stay the same, only grams change.
                  </Text>
                </ScrollView>
              </>
            )}

          </Animated.View>
        </View>
      </Modal>

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
    fontFamily: Acid.serifItalic,
    fontSize: 22,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  settingTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  unitOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Acid.hair,
  },
  unitOptionText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
});
