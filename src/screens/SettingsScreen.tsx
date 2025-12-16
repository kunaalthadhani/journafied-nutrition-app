import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { TimePickerModal } from '../components/TimePickerModal';
import { usePreferences } from '../contexts/PreferencesContext';

interface SettingsScreenProps {
  onBack: () => void;
  plan?: 'free' | 'premium';
  onOpenSubscription?: () => void;
  entryCount?: number;
  freeEntryLimit?: number;
  totalEarnedEntries?: number;
  taskBonusEntries?: number;
  onLogin?: () => void;
  onIntegrations?: () => void;
  onDowngradeToFree?: () => void;
}

interface SettingItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
}) => {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.settingItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.input }]}>
          <Feather name={icon as any} size={20} color={theme.colors.textPrimary} />
        </View>
        <View style={styles.settingItemText}>
          <Text style={[styles.settingTitle, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.settingItemRight}>
        {rightElement}
        {showChevron && onPress && (
          <Feather name="chevron-right" size={20} color={theme.colors.textTertiary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

interface SettingSectionProps {
  title?: string;
  children: React.ReactNode;
}

const SettingSection: React.FC<SettingSectionProps> = ({ title, children }) => {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      {title && (
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
          {title}
        </Text>
      )}
      <View style={[styles.sectionContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {children}
      </View>
    </View>
  );
};

type MealType = 'breakfast' | 'lunch' | 'dinner';

interface MealReminder {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  plan = 'free',
  onOpenSubscription,
  entryCount = 0,
  freeEntryLimit = 20,
  totalEarnedEntries,
  taskBonusEntries,
  onLogin,
  onIntegrations,
  onDowngradeToFree,
}) => {
  const theme = useTheme();
  const { weightUnit, setWeightUnit } = usePreferences();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const referralBonus = totalEarnedEntries || 0;
  const challengeBonus = taskBonusEntries || 0;
  const totalBonusEntries = referralBonus + challengeBonus;

  // Meal reminder settings
  const [breakfastReminder, setBreakfastReminder] = useState<MealReminder>({
    enabled: true,
    hour: 8,
    minute: 0,
  });
  const [lunchReminder, setLunchReminder] = useState<MealReminder>({
    enabled: true,
    hour: 12,
    minute: 30,
  });
  const [dinnerReminder, setDinnerReminder] = useState<MealReminder>({
    enabled: true,
    hour: 18,
    minute: 0,
  });

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Your data will be exported as a JSON file. This feature is coming soon!',
      [{ text: 'OK' }]
    );
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete All Data',
      'Are you sure you want to delete all your data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Data Deleted', 'All your data has been deleted.');
          },
        },
      ]
    );
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
              // Clear all AsyncStorage data
              await AsyncStorage.clear();
              Alert.alert(
                'Data Cleared',
                'All app data has been cleared successfully. The app will restart.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Note: In a real app, you might want to reload the app
                      // For now, we'll just show the alert
                    },
                  },
                ]
              );
            } catch (error) {
              Alert.alert(
                'Error',
                'Failed to clear data. Please try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'About TrackKcal',
      'Version 1.0.0\n\nA nutrition and fitness tracking app to help you achieve your health goals.',
      [{ text: 'OK' }]
    );
  };

  const handlePrivacyPolicy = () => {
    Alert.alert(
      'Privacy Policy',
      'Privacy policy content will be displayed here.',
      [{ text: 'OK' }]
    );
  };

  const handleTermsOfService = () => {
    Alert.alert(
      'Terms of Service',
      'Terms of service content will be displayed here.',
      [{ text: 'OK' }]
    );
  };

  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  };

  const handleMealReminderToggle = (mealType: MealType, enabled: boolean) => {
    switch (mealType) {
      case 'breakfast':
        setBreakfastReminder({ ...breakfastReminder, enabled });
        break;
      case 'lunch':
        setLunchReminder({ ...lunchReminder, enabled });
        break;
      case 'dinner':
        setDinnerReminder({ ...dinnerReminder, enabled });
        break;
    }
  };

  const handleTimeSelect = (mealType: MealType) => {
    const reminder = getMealReminder(mealType);
    if (!reminder.enabled) {
      // Don't open time picker if reminder is disabled
      return;
    }
    setSelectedMealType(mealType);
    setTimePickerVisible(true);
  };

  const handleTimeConfirm = (hour: number, minute: number) => {
    if (!selectedMealType) return;

    switch (selectedMealType) {
      case 'breakfast':
        setBreakfastReminder({ ...breakfastReminder, hour, minute });
        break;
      case 'lunch':
        setLunchReminder({ ...lunchReminder, hour, minute });
        break;
      case 'dinner':
        setDinnerReminder({ ...dinnerReminder, hour, minute });
        break;
    }
    setSelectedMealType(null);
  };

  const getMealReminder = (mealType: MealType): MealReminder => {
    switch (mealType) {
      case 'breakfast':
        return breakfastReminder;
      case 'lunch':
        return lunchReminder;
      case 'dinner':
        return dinnerReminder;
    }
  };

  const handleUpgradeToPremium = () => {
    if (plan === 'premium') {
      Alert.alert('Premium', 'You are already on Premium.');
      return;
    }
    onOpenSubscription?.();
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
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      >
        {/* Integrations Section */}
        <SettingSection title="Connections">
          <SettingItem
            icon="activity"
            title="Integrations"
            subtitle="Apple Health, Google Fit, etc."
            onPress={onIntegrations}
          />
        </SettingSection>

        {/* Account Section */}
        <SettingSection title="Account">
          <SettingItem
            icon="user"
            title="My Account"
            subtitle="Manage your profile and login"
            onPress={onLogin}
          />
        </SettingSection>

        {/* Subscriptions Section */}
        <SettingSection title="Subscriptions">
          <View style={[styles.subscriptionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionTitleRow}>
                <Feather name="star" size={18} color={theme.colors.textPrimary} />
                <Text style={[styles.subscriptionTitle, { color: theme.colors.textPrimary }]}>Current Plan</Text>
              </View>
              <View style={[styles.planBadge, { backgroundColor: plan === 'premium' ? theme.colors.primary : theme.colors.input, borderColor: theme.colors.border }]}>
                <Text style={[styles.planBadgeText, { color: plan === 'premium' ? Colors.white : theme.colors.textSecondary }]}>
                  {plan === 'premium' ? 'Premium' : 'Free'}
                </Text>
              </View>
            </View>
            <Text style={[styles.subscriptionSubtitle, { color: theme.colors.textSecondary }]}>
              {plan === 'premium' ? 'Enjoy all premium features.' : 'You are on the Free plan. Upgrade to unlock premium features.'}
            </Text>
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleUpgradeToPremium}
              activeOpacity={0.85}
            >
              <Text style={styles.upgradeButtonText}>
                {plan === 'premium' ? 'Manage Subscription' : 'Upgrade to Premium'}
              </Text>
            </TouchableOpacity>

            {/* Temporary Dev Button to Revert */}
            {plan === 'premium' && (
              <TouchableOpacity
                style={{ marginTop: 12, alignSelf: 'center' }}
                onPress={onDowngradeToFree}
              >
                <Text style={{ color: theme.colors.textTertiary, fontSize: 12, textDecorationLine: 'underline' }}>
                  (Dev) Downgrade to Free
                </Text>
              </TouchableOpacity>
            )}

            {plan === 'free' && (
              <Text style={[styles.remainingText, { color: theme.colors.textSecondary }]}>
                {Math.max(0, freeEntryLimit + totalBonusEntries - entryCount)} entries remaining
                {totalBonusEntries > 0 && (
                  <Text style={{ color: theme.colors.primary }}>
                    {' '}(
                    {[
                      referralBonus > 0 ? `+${referralBonus} from referrals` : null,
                      challengeBonus > 0 ? `+${challengeBonus} from challenges` : null,
                    ]
                      .filter(Boolean)
                      .join(' & ')}
                    )
                  </Text>
                )}
              </Text>
            )}
          </View>
        </SettingSection>

        {/* Preferences Section */}
        <SettingSection title="Preferences">
          <SettingItem
            icon="bell"
            title="Notifications"
            subtitle="Enable push notifications"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={Colors.white}
              />
            }
            showChevron={false}
          />
          <SettingItem
            icon="sliders"
            title="Weight Unit"
            subtitle={weightUnit === 'kg' ? 'Kilograms (kg)' : 'Pounds (lbs)'}
            onPress={() => setShowUnitSelector(true)}
            showChevron={true}
          />
        </SettingSection>

        {/* Meal Logging Reminders Section */}
        <SettingSection title="Meal Logging Reminders">
          <SettingItem
            icon="sunrise"
            title="Breakfast Reminder"
            subtitle={breakfastReminder.enabled ? formatTime(breakfastReminder.hour, breakfastReminder.minute) : 'Disabled'}
            onPress={() => handleTimeSelect('breakfast')}
            rightElement={
              <Switch
                value={breakfastReminder.enabled}
                onValueChange={(enabled) => handleMealReminderToggle('breakfast', enabled)}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={Colors.white}
              />
            }
            showChevron={breakfastReminder.enabled}
          />
          <SettingItem
            icon="sun"
            title="Lunch Reminder"
            subtitle={lunchReminder.enabled ? formatTime(lunchReminder.hour, lunchReminder.minute) : 'Disabled'}
            onPress={() => handleTimeSelect('lunch')}
            rightElement={
              <Switch
                value={lunchReminder.enabled}
                onValueChange={(enabled) => handleMealReminderToggle('lunch', enabled)}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={Colors.white}
              />
            }
            showChevron={lunchReminder.enabled}
          />
          <SettingItem
            icon="moon"
            title="Dinner Reminder"
            subtitle={dinnerReminder.enabled ? formatTime(dinnerReminder.hour, dinnerReminder.minute) : 'Disabled'}
            onPress={() => handleTimeSelect('dinner')}
            rightElement={
              <Switch
                value={dinnerReminder.enabled}
                onValueChange={(enabled) => handleMealReminderToggle('dinner', enabled)}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={Colors.white}
              />
            }
            showChevron={dinnerReminder.enabled}
          />
        </SettingSection>

        {/* Debug Section (Only visible in Development) */}
        {__DEV__ && (
          <SettingSection title="Developer Tools">
            <SettingItem
              icon="tool"
              title="Test AI Coach"
              subtitle="Reset & Inject Test Insight"
              onPress={async () => {
                try {
                  // 1. Clear Dismissal
                  await AsyncStorage.removeItem('@trackkal:coachDismissDate');

                  // 2. Clear Old Insights
                  await AsyncStorage.setItem('@trackkal:insights', '[]');

                  // 3. Inject Test Insight
                  const testInsight = {
                    id: 'test-' + Date.now(),
                    type: 'warning',
                    title: 'Protein Intake Low',
                    description: 'You are significantly under your protein goal.',
                    date: new Date().toISOString().split('T')[0],
                    referenceData: { metric: 'protein', value: 20, target: 150 }
                  };
                  await AsyncStorage.setItem('@trackkal:insights', JSON.stringify([testInsight]));

                  Alert.alert('Test Ready', 'Go to Home Screen to see the "Protein Intake Low" card.');
                } catch (e) {
                  Alert.alert('Error', 'Failed to set up test state');
                }
              }}
            />
          </SettingSection>
        )}

        {/* Data Section */}
        <SettingSection title="Data">
          <SettingItem
            icon="trash-2"
            title="Clear Cache"
            subtitle="Delete all app data (meals, weights, goals, settings)"
            onPress={handleClearCache}
          />
        </SettingSection>

        {/* Support Section */}
        <SettingSection title="Support">
          <SettingItem
            icon="help-circle"
            title="Help & Support"
            subtitle="Get help with using the app"
            onPress={() => Alert.alert('Help', 'Help content will be displayed here.')}
          />
          <SettingItem
            icon="mail"
            title="Contact Us"
            subtitle="Send us feedback"
            onPress={() => Alert.alert('Contact', 'Contact information will be displayed here.')}
          />
          <SettingItem
            icon="info"
            title="About and Legal"
            subtitle="Version, Terms, and Privacy"
            onPress={handleAbout}
          />
        </SettingSection>

        {/* Legal Section */}
        <SettingSection title="Legal">
          <SettingItem
            icon="file-text"
            title="Privacy Policy"
            onPress={handlePrivacyPolicy}
          />
          <SettingItem
            icon="file-text"
            title="Terms of Service"
            onPress={handleTermsOfService}
          />
        </SettingSection>

        {/* Spacing at bottom */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={timePickerVisible}
        onClose={() => {
          setTimePickerVisible(false);
          setSelectedMealType(null);
        }}
        onConfirm={handleTimeConfirm}
        initialHour={selectedMealType ? getMealReminder(selectedMealType).hour : 8}
        initialMinute={selectedMealType ? getMealReminder(selectedMealType).minute : 0}
        title={`Set ${selectedMealType ? selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1) : ''} Reminder Time`}
      />

      {/* Unit Selector Modal */}
      <Modal
        visible={showUnitSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.unitModalContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.unitModalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.unitModalTitle, { color: theme.colors.textPrimary }]}>
                Select Weight Unit
              </Text>
              <TouchableOpacity onPress={() => setShowUnitSelector(false)}>
                <Feather name="x" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.unitOptions}>
              <TouchableOpacity
                style={[
                  styles.unitOption,
                  weightUnit === 'kg' && { backgroundColor: theme.colors.primary },
                  { borderColor: theme.colors.border },
                ]}
                onPress={async () => {
                  await setWeightUnit('kg');
                  setShowUnitSelector(false);
                }}
              >
                <Text
                  style={[
                    styles.unitOptionText,
                    { color: weightUnit === 'kg' ? Colors.white : theme.colors.textPrimary },
                  ]}
                >
                  Kilograms (kg)
                </Text>
                {weightUnit === 'kg' && (
                  <Feather name="check" size={20} color={Colors.white} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitOption,
                  weightUnit === 'lbs' && { backgroundColor: theme.colors.primary },
                  { borderColor: theme.colors.border },
                ]}
                onPress={async () => {
                  await setWeightUnit('lbs');
                  setShowUnitSelector(false);
                }}
              >
                <Text
                  style={[
                    styles.unitOptionText,
                    { color: weightUnit === 'lbs' ? Colors.white : theme.colors.textPrimary },
                  ]}
                >
                  Pounds (lbs)
                </Text>
                {weightUnit === 'lbs' && (
                  <Feather name="check" size={20} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionContent: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingItemText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: Typography.fontSize.sm,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomSpacer: {
    height: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  unitModalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  unitModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  unitModalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  unitOptions: {
    padding: 16,
    gap: 12,
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
  subscriptionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subscriptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  subscriptionSubtitle: {
    fontSize: Typography.fontSize.sm,
    marginBottom: 12,
  },
  planBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upgradeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  upgradeButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
  remainingText: {
    marginTop: 8,
    fontSize: Typography.fontSize.sm,
  },
});


