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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { usePreferences } from '../contexts/PreferencesContext';
import { featureFlags } from '../config/featureFlags';
import { dataStorage } from '../services/dataStorage';
import { authService } from '../services/authService';
import { SettingItem, SettingSection } from '../components/SettingsComponents';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';
import { IntegrationsScreen } from './IntegrationsScreen';

interface SettingsScreenProps {
  onBack: () => void;
  plan?: 'free' | 'premium';
  onOpenSubscription?: () => void;
  onLogin?: () => void;
  onIntegrations?: () => void;
  onDowngradeToFree?: () => void;
  onGrocerySuggestions?: () => void;
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
  onHowItWorks,
  renderAccountScreen,
  onAccountClose,
}) => {
  const theme = useTheme();
  const { weightUnit, setWeightUnit } = usePreferences();

  // Slide-up panel state
  type SlideUpType = 'account' | 'notifications' | 'connections' | 'weightUnit' | 'dynamic';
  const [activeSlideUp, setActiveSlideUp] = useState<SlideUpType | null>(null);
  const activeSlideUpRef = useRef<SlideUpType | null>(null);

  // Feature flags & settings
  const [smartSuggestEnabled, setSmartSuggestEnabled] = useState(true);
  const [dynamicEnabled, setDynamicEnabled] = useState(false);
  const [dynamicThreshold, setDynamicThreshold] = useState<number>(5);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [loadedPreferences, setLoadedPreferences] = useState<any>(null);

  // Shared slide-up animation
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const slideUpAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const openSlideUp = (type: SlideUpType) => {
    if (type === 'dynamic' && plan !== 'premium') {
      onOpenSubscription?.();
      return;
    }
    if (type === 'account' && !renderAccountScreen) {
      onLogin?.();
      return;
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
    }).start(() => {
      setActiveSlideUp(null);
      activeSlideUpRef.current = null;
      if (closingType === 'account') {
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
      const prefs = await dataStorage.loadPreferences();
      setLoadedPreferences(prefs);
      setSmartSuggestEnabled(prefs?.smartSuggestEnabled !== false);
      setDynamicEnabled(prefs?.dynamicAdjustmentEnabled === true);
      setDynamicThreshold(prefs?.dynamicAdjustmentThreshold || 5);

      const entries = await dataStorage.loadWeightEntries();
      if (entries && entries.length > 0) {
        const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setCurrentWeightKg(sorted[0].weight);
      }
    } catch (e) {
      console.error("Error checking feature flags", e);
    }
  };

  const toggleDynamicAdjustment = async (newValue: boolean) => {
    if (plan !== 'premium') return;
    setDynamicEnabled(newValue);
    const currentPrefs = await dataStorage.loadPreferences() || {};
    // @ts-ignore
    await dataStorage.savePreferences({ ...currentPrefs, dynamicAdjustmentEnabled: newValue, dynamicAdjustmentThreshold: dynamicThreshold });
  };

  const updateDynamicThreshold = async (val: number) => {
    if (plan !== 'premium') return;
    setDynamicThreshold(val);
    const currentPrefs = await dataStorage.loadPreferences() || {};
    // @ts-ignore
    await dataStorage.savePreferences({ ...currentPrefs, dynamicAdjustmentEnabled: dynamicEnabled, dynamicAdjustmentThreshold: val });
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
            try {
              await AsyncStorage.clear();
              Alert.alert('Data Cleared', 'All app data has been cleared successfully. The app will restart.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
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
            try {
              Alert.alert('Processing...', 'Deleting your data... please wait.');
              await authService.deleteAccount();
              Alert.alert('Account Deleted', 'Your account and data have been removed. You will be signed out.');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account completely. Local data cleared.');
            }
          }
        }
      ]
    );
  };

  const handleAbout = () => {
    Alert.alert('About TrackKcal', 'Version 1.0.0\n\nA nutrition and fitness tracking app to help you achieve your health goals.', [{ text: 'OK' }]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
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

          <View style={[styles.subscriptionRow, { borderBottomColor: theme.colors.border }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.input }]}>
                <Feather name="star" size={20} color={plan === 'premium' ? '#EAB308' : theme.colors.textPrimary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.colors.textPrimary }]}>Current Plan</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                  {plan === 'premium' ? 'Premium Plan' : 'Free Plan'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
              onPress={() => {
                if (plan === 'premium') Alert.alert('Premium', 'You are already on Premium.');
                else onOpenSubscription?.();
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>
                {plan === 'premium' ? 'Manage' : 'Upgrade'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dev Tools for Plan */}
          {plan === 'premium' && (
            <TouchableOpacity style={{ padding: 12, alignItems: 'center' }} onPress={onDowngradeToFree}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: 11 }}>(Dev) Downgrade to Free</Text>
            </TouchableOpacity>
          )}
        </SettingSection>

        {/* App Preferences */}
        <SettingSection title="App Preferences">
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
          {plan === 'premium' ? (
            <SettingItem
              icon="zap"
              title="Smart Suggest"
              subtitle="Show next meal suggestions on Home"
              rightElement={
                <Switch
                  value={smartSuggestEnabled}
                  onValueChange={async (val) => {
                    setSmartSuggestEnabled(val);
                    const current = await dataStorage.loadPreferences() || {};
                    // @ts-ignore
                    await dataStorage.savePreferences({ ...current, smartSuggestEnabled: val });
                  }}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={Colors.white}
                />
              }
              showChevron={false}
            />
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="zap"
                title="Smart Suggest"
                subtitle="Show next meal suggestions on Home"
                onPress={() => onOpenSubscription?.()}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={theme.colors.textTertiary} />}
                showChevron={false}
              />
            </View>
          )}
          {plan === 'premium' ? (
            <SettingItem
              icon="shopping-cart"
              title="Grocery Suggestions"
              subtitle="AI-Powered Lists"
              onPress={() => onGrocerySuggestions?.()}
            />
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="shopping-cart"
                title="Grocery Suggestions"
                subtitle="AI-Powered Lists"
                onPress={() => onOpenSubscription?.()}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={theme.colors.textTertiary} />}
                showChevron={false}
              />
            </View>
          )}
          {plan === 'premium' ? (
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
                onPress={() => onOpenSubscription?.()}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={theme.colors.textTertiary} />}
                showChevron={false}
              />
            </View>
          )}
          {plan === 'premium' ? (
            <SettingItem
              icon="eye"
              title="Pattern Detection"
              subtitle="Spot trends in your eating habits"
              showChevron={false}
              rightElement={
                <View style={{ backgroundColor: theme.colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: theme.colors.primary, fontSize: 11, fontWeight: '600' }}>Active</Text>
                </View>
              }
            />
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="eye"
                title="Pattern Detection"
                subtitle="Spot trends in your eating habits"
                onPress={() => onOpenSubscription?.()}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={theme.colors.textTertiary} />}
                showChevron={false}
              />
            </View>
          )}
          {plan === 'premium' ? (
            <SettingItem
              icon="bar-chart-2"
              title="Weekly AI Overview"
              subtitle="Personalized nutrition insights every week"
              showChevron={false}
              rightElement={
                <View style={{ backgroundColor: theme.colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: theme.colors.primary, fontSize: 11, fontWeight: '600' }}>Active</Text>
                </View>
              }
            />
          ) : (
            <View style={{ opacity: 0.5 }}>
              <SettingItem
                icon="bar-chart-2"
                title="Weekly AI Overview"
                subtitle="Personalized nutrition insights every week"
                onPress={() => onOpenSubscription?.()}
                rightElement={<MaterialCommunityIcons name="shield-lock-outline" size={16} color={theme.colors.textTertiary} />}
                showChevron={false}
              />
            </View>
          )}
        </SettingSection>

        {/* Support & Legal */}
        <SettingSection title="Support & Legal">
          <SettingItem icon="help-circle" title="Help & Support" onPress={() => Alert.alert('Help', 'Support content coming soon.')} />
          <SettingItem icon="book-open" title="How it Works" onPress={onHowItWorks} />
          <SettingItem icon="mail" title="Contact Us" onPress={() => Alert.alert('Contact', 'Contact form coming soon.')} />
          <SettingItem icon="file-text" title="Privacy Policy" onPress={() => Alert.alert('Privacy', 'Privacy Policy')} />
          <SettingItem icon="file-text" title="Terms of Service" onPress={() => Alert.alert('Terms', 'Terms of Service')} />
          <SettingItem icon="info" title="About" onPress={handleAbout} />
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
            subtitle="Permanently remove your account and data"
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

      </ScrollView>

      {/* ── Unified Slide-Up Modal ── */}
      <Modal
        visible={activeSlideUp !== null}
        transparent={true}
        animationType="none"
        onRequestClose={closeSlideUp}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {/* Tappable backdrop (5% gap) */}
          <TouchableOpacity style={{ height: SCREEN_HEIGHT * 0.05 }} activeOpacity={1} onPress={closeSlideUp} />

          <Animated.View
            style={{
              height: SCREEN_HEIGHT * 0.95,
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
              transform: [{ translateY: slideUpAnim }],
            }}
          >
            {/* Drag handle */}
            <View
              style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}
              {...slideUpPanResponder.panHandlers}
            >
              <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: theme.colors.border }} />
            </View>

            {/* ── Account ── */}
            {activeSlideUp === 'account' && renderAccountScreen?.(closeSlideUp)}

            {/* ── Notifications ── */}
            {activeSlideUp === 'notifications' && (
              <NotificationSettingsScreen
                onBack={closeSlideUp}
                isPremium={plan === 'premium'}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  <TouchableOpacity onPress={closeSlideUp} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary }}>Weight Unit</Text>
                  </View>
                  <View style={{ width: 40 }} />
                </View>

                <View style={{ padding: 24, gap: 12 }}>
                  <TouchableOpacity
                    style={[styles.unitOption, weightUnit === 'kg' && { backgroundColor: theme.colors.primary }, { borderColor: theme.colors.border }]}
                    onPress={async () => { await setWeightUnit('kg'); closeSlideUp(); }}
                  >
                    <Text style={[styles.unitOptionText, { color: weightUnit === 'kg' ? Colors.white : theme.colors.textPrimary }]}>Kilograms (kg)</Text>
                    {weightUnit === 'kg' && <Feather name="check" size={20} color={Colors.white} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.unitOption, weightUnit === 'lbs' && { backgroundColor: theme.colors.primary }, { borderColor: theme.colors.border }]}
                    onPress={async () => { await setWeightUnit('lbs'); closeSlideUp(); }}
                  >
                    <Text style={[styles.unitOptionText, { color: weightUnit === 'lbs' ? Colors.white : theme.colors.textPrimary }]}>Pounds (lbs)</Text>
                    {weightUnit === 'lbs' && <Feather name="check" size={20} color={Colors.white} />}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Dynamic Adjustments ── */}
            {activeSlideUp === 'dynamic' && (
              <>
                {/* Header — down arrow left, title center */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  <TouchableOpacity onPress={closeSlideUp} style={{ padding: 8 }}>
                    <Feather name="chevron-down" size={24} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary }}>Dynamic Adjustments</Text>
                      <View style={{ backgroundColor: '#18181B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                        <MaterialCommunityIcons name="crown" size={14} color="#EAB308" />
                      </View>
                    </View>
                  </View>
                  <View style={{ width: 40 }} />
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                  {/* Toggle */}
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: theme.colors.card, borderRadius: 14, padding: 16, marginBottom: 24,
                    borderWidth: 1, borderColor: theme.colors.border,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary }}>
                      {dynamicEnabled ? 'Enabled' : 'Disabled'}
                    </Text>
                    <Switch
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                      thumbColor={'white'}
                      ios_backgroundColor={theme.colors.border}
                      onValueChange={toggleDynamicAdjustment}
                      value={dynamicEnabled}
                    />
                  </View>

                  {/* Threshold (visible when enabled) */}
                  {dynamicEnabled && (
                    <View style={{ marginBottom: 24 }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>Adjustment Threshold</Text>
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
                                paddingVertical: 12,
                                alignItems: 'center',
                                borderRadius: 12,
                                backgroundColor: isActive ? theme.colors.card : theme.colors.background,
                                borderWidth: 1.5,
                                borderColor: isActive ? theme.colors.textPrimary : theme.colors.border,
                              }}
                            >
                              <Text style={{
                                fontSize: 18,
                                fontWeight: '700',
                                color: isActive ? theme.colors.textPrimary : theme.colors.textTertiary,
                              }}>{val}%</Text>
                              {displayAmount && (
                                <Text style={{
                                  fontSize: 11,
                                  color: isActive ? theme.colors.textSecondary : theme.colors.textTertiary,
                                  marginTop: 2,
                                }}>{displayAmount}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: 12, marginTop: 10 }}>
                        We'll suggest a plan update when your weight changes by {dynamicThreshold}%
                        {currentWeightKg ? ` (about ${weightUnit === 'lbs' ? `${(currentWeightKg * dynamicThreshold / 100 * 2.20462).toFixed(1)} lbs` : `${(currentWeightKg * dynamicThreshold / 100).toFixed(1)} kg`})` : ''}.
                      </Text>
                    </View>
                  )}

                  {/* Divider */}
                  <View style={{ height: 1, backgroundColor: theme.colors.border, marginBottom: 24 }} />

                  {/* How it works */}
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 12 }}>How it works</Text>

                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22, marginBottom: 12 }}>
                    As you lose weight, your body needs fewer calories to maintain itself. If your calorie plan stays the same, your progress will eventually slow down and stop. That's called a plateau.
                  </Text>

                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22, marginBottom: 24 }}>
                    Dynamic Adjustments keeps an eye on your weight trend and automatically suggests small updates to your nutrition plan when you hit your chosen threshold, so your progress keeps moving.
                  </Text>

                  {/* Example */}
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 14 }}>Example</Text>

                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22, marginBottom: 16 }}>
                    Say you weigh 100 kg and your daily calorie target is 2,000 kcal. As you lose weight, your body burns fewer calories at rest, so that same 2,000 kcal plan gradually becomes less effective.
                  </Text>

                  {/* 3% row */}
                  <View style={{ backgroundColor: theme.colors.card, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>3% threshold</Text>
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 }}>
                      Triggers at 97 kg. Your target might adjust from 2,000 to ~1,940 kcal. Smaller, more frequent updates.
                    </Text>
                  </View>

                  {/* 4% row */}
                  <View style={{ backgroundColor: theme.colors.card, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>4% threshold</Text>
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 }}>
                      Triggers at 96 kg. Your target might adjust from 2,000 to ~1,900 kcal. A balanced middle ground.
                    </Text>
                  </View>

                  {/* 5% row */}
                  <View style={{ backgroundColor: theme.colors.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 }}>5% threshold</Text>
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 }}>
                      Triggers at 95 kg. Your target might adjust from 2,000 to ~1,800 kcal. Fewer but bigger updates.
                    </Text>
                  </View>

                  <Text style={{ fontSize: 13, color: theme.colors.textTertiary, lineHeight: 20 }}>
                    The lower the threshold, the more often you'll get suggestions. Pick what feels right for you.
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
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  unitOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  unitOptionText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
});
