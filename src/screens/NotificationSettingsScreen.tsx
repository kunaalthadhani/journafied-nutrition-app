import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { Acid } from '../constants/acid';
import { SettingItem, SettingSection } from '../components/SettingsComponents';
import { TimePickerModal } from '../components/TimePickerModal';
import { dataStorage, Preferences, SmartReminderPreferences, PREFERENCES_DEFAULTS } from '../services/dataStorage';

interface NotificationSettingsScreenProps {
    onBack: () => void;
    initialPreferences?: any;
}

type MealType = 'breakfast' | 'lunch' | 'dinner';

const DEFAULT_SMART_PREFS: SmartReminderPreferences = {
    enabled: true,
    reminderMode: 'smart',
    smartRemindersEnabled: true,
    mealSlots: { breakfast: true, lunch: true, dinner: true },
    endOfDaySummary: true,
    quietHoursStart: 22,
    quietHoursEnd: 7,
};

export const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({ onBack, initialPreferences }) => {
    const [loading, setLoading] = useState(!initialPreferences);
    const [preferences, setPreferences] = useState<Preferences | null>(initialPreferences ? {
        ...PREFERENCES_DEFAULTS,
        ...initialPreferences,
    } : null);

    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);

    useEffect(() => {
        if (!initialPreferences) loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            setLoading(true);
            const prefs = await dataStorage.loadPreferences();
            setPreferences(prefs || PREFERENCES_DEFAULTS);
        } catch (error) {
            console.error('Failed to load preferences', error);
        } finally {
            setLoading(false);
        }
    };

    const savePreferences = async (patch: Partial<Preferences>) => {
        setPreferences(prev => (prev ? { ...prev, ...patch } : prev));
        try {
            await dataStorage.savePreferences(patch);
        } catch (error) {
            console.error('Failed to save preferences', error);
        }
    };

    const handleGlobalToggle = (value: boolean) => {
        if (!preferences) return;
        savePreferences({ notificationsEnabled: value });
    };

    const handleMealReminderToggle = (mealType: MealType, enabled: boolean) => {
        if (!preferences) return;
        const newReminders = {
            ...preferences.mealReminders,
            [mealType]: { ...preferences.mealReminders[mealType], enabled }
        };
        savePreferences({ mealReminders: newReminders });
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
        savePreferences({ mealReminders: newReminders });
        setSelectedMealType(null);
    };

    const formatTime = (hour: number, minute: number): string => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const displayMinute = minute.toString().padStart(2, '0');
        return `${displayHour}:${displayMinute} ${period}`;
    };

    // ---- Smart Reminder Handlers ----

    const smartPrefs = preferences?.smartReminderPreferences ?? DEFAULT_SMART_PREFS;
    // Default to 'smart' for any user upgrading from a version that didn't have this field.
    const reminderMode: 'smart' | 'scheduled' = smartPrefs.reminderMode ?? 'smart';

    const updateSmartPrefs = (updates: Partial<SmartReminderPreferences>) => {
        if (!preferences) return;
        const newSmartPrefs = { ...smartPrefs, ...updates };
        savePreferences({ smartReminderPreferences: newSmartPrefs });
    };

    if (loading || !preferences) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: Acid.moss }]} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color={Acid.tx} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: Acid.tx }]}>Notifications</Text>
                    <View style={{ width: 40 }} />
                </View>
            </SafeAreaView>
        );
    }

    const { mealReminders } = preferences;

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: Acid.moss }]} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: Acid.hair }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={Acid.tx} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: Acid.tx }]}>
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
                                trackColor={{ false: Acid.hair2, true: Acid.lime }}
                                thumbColor={Colors.white}
                            />
                        }
                        showChevron={false}
                    />
                </SettingSection>

                {/* Reminders */}
                {preferences.notificationsEnabled && (
                    <SettingSection title="Reminders">
                        <SettingItem
                            icon="bell"
                            title="Reminders"
                            subtitle={smartPrefs.enabled ? (reminderMode === 'smart' ? 'Smart timing' : 'At set times') : 'Off'}
                            rightElement={
                                <Switch
                                    value={smartPrefs.enabled}
                                    onValueChange={(val) => updateSmartPrefs({ enabled: val })}
                                    trackColor={{ false: Acid.hair2, true: Acid.lime }}
                                    thumbColor={Colors.white}
                                />
                            }
                            showChevron={false}
                        />

                        {smartPrefs.enabled && (
                            <>
                                {/* Mode toggle */}
                                <View style={styles.modeToggleRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.modeToggleOption,
                                            reminderMode === 'smart' && styles.modeToggleActive,
                                        ]}
                                        onPress={() => updateSmartPrefs({ reminderMode: 'smart' })}
                                    >
                                        <Text style={[styles.modeToggleText, { color: reminderMode === 'smart' ? Acid.lime : Acid.tx3 }]}>
                                            Smart
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.modeToggleOption,
                                            reminderMode === 'scheduled' && styles.modeToggleActive,
                                        ]}
                                        onPress={() => updateSmartPrefs({ reminderMode: 'scheduled' })}
                                    >
                                        <Text style={[styles.modeToggleText, { color: reminderMode === 'scheduled' ? Acid.lime : Acid.tx3 }]}>
                                            Scheduled
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.helperText, { color: Acid.tx2 }]}>
                                    {reminderMode === 'smart'
                                        ? 'TrackKcal learns when you typically eat and nudges you at the right time. Needs a few days of logging to calibrate.'
                                        : 'Reminders fire at the times you pick below.'}
                                </Text>

                                {reminderMode === 'scheduled' && (
                                    <>
                                        <SettingItem
                                            icon="sunrise"
                                            title="Breakfast"
                                            subtitle={mealReminders.breakfast.enabled ? formatTime(mealReminders.breakfast.hour, mealReminders.breakfast.minute) : 'Off'}
                                            onPress={() => handleTimeSelect('breakfast')}
                                            rightElement={
                                                <Switch
                                                    value={mealReminders.breakfast.enabled}
                                                    onValueChange={(val) => handleMealReminderToggle('breakfast', val)}
                                                    trackColor={{ false: Acid.hair2, true: Acid.lime }}
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
                                                    trackColor={{ false: Acid.hair2, true: Acid.lime }}
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
                                                    trackColor={{ false: Acid.hair2, true: Acid.lime }}
                                                    thumbColor={Colors.white}
                                                />
                                            }
                                            showChevron={mealReminders.dinner.enabled}
                                        />
                                    </>
                                )}

                                <SettingItem
                                    icon="bar-chart-2"
                                    title="End-of-Day Summary"
                                    subtitle="A reminder at 8:30 PM to finish logging your day"
                                    rightElement={
                                        <Switch
                                            value={smartPrefs.endOfDaySummary}
                                            onValueChange={(val) => updateSmartPrefs({ endOfDaySummary: val })}
                                            trackColor={{ false: Acid.hair2, true: Acid.lime }}
                                            thumbColor={Colors.white}
                                        />
                                    }
                                    showChevron={false}
                                />
                            </>
                        )}
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
    helperText: {
        fontSize: Typography.fontSize.sm,
        marginBottom: 12,
        lineHeight: 20,
        paddingHorizontal: 4,
    },
    modeToggleRow: {
        flexDirection: 'row',
        marginVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: Acid.hair,
    },
    modeToggleOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
        marginBottom: -1,
    },
    modeToggleActive: {
        borderBottomColor: Acid.lime,
    },
    modeToggleText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: Typography.fontWeight.semiBold,
    },
});
