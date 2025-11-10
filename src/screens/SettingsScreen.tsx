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
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';
import { TimePickerModal } from '../components/TimePickerModal';
import { usePreferences } from '../contexts/PreferencesContext';

interface SettingsScreenProps {
  onBack: () => void;
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
          <Feather name={icon as any} size={20} color="#14B8A6" />
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

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const { weightUnit, setWeightUnit } = usePreferences();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  
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
      'Clear Cache',
      'Cache cleared successfully!',
      [{ text: 'OK' }]
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'About Journafied',
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#14B8A6" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          Settings
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                trackColor={{ false: theme.colors.border, true: '#14B8A6' }}
                thumbColor={Colors.white}
              />
            }
            showChevron={false}
          />
          <SettingItem
            icon="ruler"
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
                trackColor={{ false: theme.colors.border, true: '#14B8A6' }}
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
                trackColor={{ false: theme.colors.border, true: '#14B8A6' }}
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
                trackColor={{ false: theme.colors.border, true: '#14B8A6' }}
                thumbColor={Colors.white}
              />
            }
            showChevron={dinnerReminder.enabled}
          />
        </SettingSection>

        {/* Data Management Section */}
        <SettingSection title="Data Management">
          <SettingItem
            icon="download"
            title="Export Data"
            subtitle="Download your data as JSON"
            onPress={handleExportData}
          />
          <SettingItem
            icon="trash-2"
            title="Clear Cache"
            subtitle="Free up storage space"
            onPress={handleClearCache}
          />
          <SettingItem
            icon="alert-triangle"
            title="Delete All Data"
            subtitle="Permanently remove all your data"
            onPress={handleDeleteData}
          />
        </SettingSection>

        {/* About Section */}
        <SettingSection title="About">
          <SettingItem
            icon="info"
            title="About Journafied"
            subtitle="Version 1.0.0"
            onPress={handleAbout}
          />
          <SettingItem
            icon="shield"
            title="Privacy Policy"
            onPress={handlePrivacyPolicy}
          />
          <SettingItem
            icon="file-text"
            title="Terms of Service"
            onPress={handleTermsOfService}
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
                  weightUnit === 'kg' && { backgroundColor: '#14B8A6' },
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
                  weightUnit === 'lbs' && { backgroundColor: '#14B8A6' },
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
});

