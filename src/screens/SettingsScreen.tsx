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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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
}

// Module-level variable to persist unlock across re-renders
let isGroceryUnlocked = false;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  plan = 'free',
  onOpenSubscription,

  onLogin,
  onIntegrations,
  onDowngradeToFree,
  onGrocerySuggestions,
  onHowItWorks,
}) => {
  const theme = useTheme();
  const { weightUnit, setWeightUnit } = usePreferences();
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  // Feature Flags & Easter Egg
  const [grocerySuggestionsEnabled, setGrocerySuggestionsEnabled] = useState(false);
  const [smartSuggestEnabled, setSmartSuggestEnabled] = useState(true);
  const secretTaps = useRef(0);

  useEffect(() => {
    checkFeatureFlags();
  }, []);

  const checkFeatureFlags = async () => {
    try {
      const accountInfo = await dataStorage.loadAccountInfo();
      // Enable if admin OR if unlocked via easter egg
      const enabled = featureFlags.grocerySuggestions.isEnabled(accountInfo) || isGroceryUnlocked;
      setGrocerySuggestionsEnabled(enabled);

      const prefs = await dataStorage.loadPreferences();
      setSmartSuggestEnabled(prefs?.smartSuggestEnabled !== false);
    } catch (e) {
      console.error("Error checking feature flags", e);
    }
  };

  const handleGroceryTap = () => {
    if (grocerySuggestionsEnabled) {
      onGrocerySuggestions?.();
    } else {
      secretTaps.current += 1;
      if (secretTaps.current >= 5) {
        isGroceryUnlocked = true;
        setGrocerySuggestionsEnabled(true);
        Alert.alert("🥕 Beta Feature Unlocked", "You've enabled Grocery Suggestions for this session!");
        setTimeout(() => {
          onGrocerySuggestions?.();
        }, 500);
        secretTaps.current = 0;
      }
    }
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

  if (showNotifications) {
    return <NotificationSettingsScreen onBack={() => setShowNotifications(false)} />;
  }

  if (showIntegrations) {
    return <IntegrationsScreen onBack={() => setShowIntegrations(false)} />;
  }


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
            onPress={onLogin}
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
            onPress={() => setShowNotifications(true)}
          />
          <SettingItem
            icon="activity"
            title="Connections"
            subtitle="Apple Health, Google Fit"
            onPress={() => setShowIntegrations(true)}
          />
          <SettingItem
            icon="sliders"
            title="Weight Unit"
            subtitle={weightUnit === 'kg' ? 'Kilograms (kg)' : 'Pounds (lbs)'}
            onPress={() => setShowUnitSelector(true)}
          />
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
          <SettingItem
            icon="shopping-cart"
            title="Grocery Suggestions"
            subtitle={grocerySuggestionsEnabled ? "AI-Powered Lists" : "Hidden"}
            onPress={handleGroceryTap}
          />
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
              <Text style={[styles.unitModalTitle, { color: theme.colors.textPrimary }]}>Select Weight Unit</Text>
              <TouchableOpacity onPress={() => setShowUnitSelector(false)}>
                <Feather name="x" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.unitOptions}>
              <TouchableOpacity
                style={[styles.unitOption, weightUnit === 'kg' && { backgroundColor: theme.colors.primary }, { borderColor: theme.colors.border }]}
                onPress={async () => { await setWeightUnit('kg'); setShowUnitSelector(false); }}
              >
                <Text style={[styles.unitOptionText, { color: weightUnit === 'kg' ? Colors.white : theme.colors.textPrimary }]}>Kilograms (kg)</Text>
                {weightUnit === 'kg' && <Feather name="check" size={20} color={Colors.white} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitOption, weightUnit === 'lbs' && { backgroundColor: theme.colors.primary }, { borderColor: theme.colors.border }]}
                onPress={async () => { await setWeightUnit('lbs'); setShowUnitSelector(false); }}
              >
                <Text style={[styles.unitOptionText, { color: weightUnit === 'lbs' ? Colors.white : theme.colors.textPrimary }]}>Pounds (lbs)</Text>
                {weightUnit === 'lbs' && <Feather name="check" size={20} color={Colors.white} />}
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
