import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { SettingItem, SettingSection } from '../components/SettingsComponents';
import { TimePickerModal } from '../components/TimePickerModal';
import { dataStorage, Preferences } from '../services/dataStorage';

interface NotificationSettingsScreenProps {
    onBack: () => void;
}

type MealType = 'breakfast' | 'lunch' | 'dinner';

export const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({ onBack }) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [preferences, setPreferences] = useState<Preferences | null>(null);

    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);

    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            setLoading(true);
            const prefs = await dataStorage.loadPreferences();
            setPreferences(prefs || {
                weightUnit: 'kg',
                notificationsEnabled: true,
                mealReminders: {
                    breakfast: { enabled: true, hour: 8, minute: 0 },
                    lunch: { enabled: true, hour: 12, minute: 30 },
                    dinner: { enabled: true, hour: 18, minute: 0 }
                },
                dynamicAdjustmentEnabled: false,
                dynamicAdjustmentThreshold: 5,
            });
        } catch (error) {
            console.error('Failed to load preferences', error);
        } finally {
            setLoading(false);
        }
    };

    const savePreferences = async (newPrefs: Preferences) => {
        setPreferences(newPrefs);
        try {
            await dataStorage.savePreferences(newPrefs);
        } catch (error) {
            console.error('Failed to save preferences', error);
        }
    };

    const handleGlobalToggle = (value: boolean) => {
        if (!preferences) return;
        savePreferences({ ...preferences, notificationsEnabled: value });
    };

    const handleMealReminderToggle = (mealType: MealType, enabled: boolean) => {
        if (!preferences) return;
        const newReminders = {
            ...preferences.mealReminders,
            [mealType]: { ...preferences.mealReminders[mealType], enabled }
        };
        savePreferences({ ...preferences, mealReminders: newReminders });
    };

    const handleTimeSelect = (mealType: MealType) => {
        if (!preferences?.mealReminders[mealType].enabled) return;
        setSelectedMealType(mealType);
        setTimePickerVisible(true);
    };

    const handleTimeConfirm = (hour: number, minute: number) => {
        if (!selectedMealType || !preferences) return;
        const newReminders = {
            ...preferences.mealReminders,
            [selectedMealType]: { ...preferences.mealReminders[selectedMealType], hour, minute }
        };
        savePreferences({ ...preferences, mealReminders: newReminders });
        setSelectedMealType(null);
    };

    const formatTime = (hour: number, minute: number): string => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const displayMinute = minute.toString().padStart(2, '0');
        return `${displayHour}:${displayMinute} ${period}`;
    };

    if (loading || !preferences) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Notifications</Text>
                    <View style={{ width: 40 }} />
                </View>
            </SafeAreaView>
        );
    }

    const { mealReminders } = preferences;

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
                    Notifications
                </Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {/* Global Toggle */}
                <SettingSection title="General">
                    <SettingItem
                        icon="bell"
                        title="Allow Notifications"
                        subtitle="Enable push notifications for reminders and updates"
                        rightElement={
                            <Switch
                                value={preferences.notificationsEnabled}
                                onValueChange={handleGlobalToggle}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={Colors.white}
                            />
                        }
                        showChevron={false}
                    />
                </SettingSection>

                {/* Meal Reminders */}
                {preferences.notificationsEnabled && (
                    <SettingSection title="Meal Reminders">
                        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
                            TrackKcal will remind you to log your meals at these times if you haven't already.
                        </Text>

                        <SettingItem
                            icon="sunrise"
                            title="Breakfast"
                            subtitle={mealReminders.breakfast.enabled ? formatTime(mealReminders.breakfast.hour, mealReminders.breakfast.minute) : 'Off'}
                            onPress={() => handleTimeSelect('breakfast')}
                            rightElement={
                                <Switch
                                    value={mealReminders.breakfast.enabled}
                                    onValueChange={(val) => handleMealReminderToggle('breakfast', val)}
                                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                    thumbColor={Colors.white}
                                />
                            }
                            showChevron={mealReminders.breakfast.enabled}
                        />
                        <SettingItem
                            icon="sun"
                            title="Lunch"
                            subtitle={mealReminders.lunch.enabled ? formatTime(mealReminders.lunch.hour, mealReminders.lunch.minute) : 'Off'}
                            onPress={() => handleTimeSelect('lunch')}
                            rightElement={
                                <Switch
                                    value={mealReminders.lunch.enabled}
                                    onValueChange={(val) => handleMealReminderToggle('lunch', val)}
                                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                    thumbColor={Colors.white}
                                />
                            }
                            showChevron={mealReminders.lunch.enabled}
                        />
                        <SettingItem
                            icon="moon"
                            title="Dinner"
                            subtitle={mealReminders.dinner.enabled ? formatTime(mealReminders.dinner.hour, mealReminders.dinner.minute) : 'Off'}
                            onPress={() => handleTimeSelect('dinner')}
                            rightElement={
                                <Switch
                                    value={mealReminders.dinner.enabled}
                                    onValueChange={(val) => handleMealReminderToggle('dinner', val)}
                                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                    thumbColor={Colors.white}
                                />
                            }
                            showChevron={mealReminders.dinner.enabled}
                        />
                    </SettingSection>
                )}

            </ScrollView>

            {/* Time Picker */}
            <TimePickerModal
                visible={timePickerVisible}
                onClose={() => {
                    setTimePickerVisible(false);
                    setSelectedMealType(null);
                }}
                onConfirm={handleTimeConfirm}
                initialHour={selectedMealType ? mealReminders[selectedMealType]?.hour : 8}
                initialMinute={selectedMealType ? mealReminders[selectedMealType]?.minute : 0}
                title={`Set ${selectedMealType ? selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1) : ''} Time`}
            />
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
    helperText: {
        fontSize: Typography.fontSize.sm,
        marginBottom: 12,
        lineHeight: 20,
        paddingHorizontal: 4,
    }
});
