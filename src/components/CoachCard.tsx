import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { dataStorage } from '../services/dataStorage';
import { generateSmartSuggestion } from '../services/openaiService';
import { chatCoachService } from '../services/chatCoachService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface SmartSuggestBannerProps {
    onLogSuggestion?: (suggestion: string) => void;
}

export const SmartSuggestBanner: React.FC<SmartSuggestBannerProps> = ({ onLogSuggestion }) => {
    const theme = useTheme();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [suggestion, setSuggestion] = useState<{ displayText: string; loggableText: string } | null>(null);

    useEffect(() => {
        const checkPref = async () => {
            const prefs = await dataStorage.loadPreferences();
            if (prefs && prefs.smartSuggestEnabled !== false) {
                setVisible(true);
            } else {
                setVisible(false);
            }
        };
        checkPref();
    }, []);

    const fetchSuggestion = async (forceNew: boolean) => {
        setLoading(true);
        try {
            const ctx = await chatCoachService.buildContext();

            if (ctx.dataQuality === 'insufficient') {
                Alert.alert("No Data", "Please log at least one meal to get smart suggestions!");
                setLoading(false);
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const logs = await dataStorage.getDailyLog(today);
            const goals = ctx.userProfile;

            let eatenCals = 0;
            let eatenProt = 0;
            logs.forEach(m => m.foods.forEach(f => {
                eatenCals += f.calories;
                eatenProt += f.protein;
            }));

            const targetCals = ctx.recentPerformance.calorieGoal || 2000;
            const targetProt = ctx.recentPerformance.proteinGoal || 150;

            const promptContext = {
                remainingCalories: targetCals - eatenCals,
                remainingProtein: targetProt - eatenProt,
                itemsEatenCount: logs.length,
                timeOfDay: new Date().getHours(),
                goal: goals.goalType,
                availableFoods: ctx.topFoods || []
            };

            const result = await generateSmartSuggestion(promptContext, forceNew);
            // Handle legacy string return just in case, though we updated service
            if (typeof result === 'string') {
                setSuggestion({ displayText: result, loggableText: result });
            } else {
                setSuggestion(result);
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded(true);
        } catch (e) {
            Alert.alert("Error", "Could not generate suggestion.");
        } finally {
            setLoading(false);
        }
    };

    const handlePress = () => {
        if (expanded) {
            // If already expanded, maybe just do nothing or toggle?
            // User said "option to close".
            // We'll let the close button handle closing.
            return;
        }
        fetchSuggestion(false);
    };

    const handleRefresh = () => {
        fetchSuggestion(true);
    };

    const handleClose = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(false);
    };

    if (!visible) return null;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={handlePress}
                style={styles.header}
                disabled={expanded}
            >
                <View style={styles.leftRow}>
                    <View style={[styles.iconBox, { backgroundColor: theme.colors.primary }]}>
                        <Feather name="zap" size={16} color="white" />
                    </View>
                    <View>
                        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Smart Suggest</Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            {expanded ? "Optimum Meal Found" : "Tap for your optimum next meal"}
                        </Text>
                    </View>
                </View>
                {!expanded && (
                    <View style={[styles.badge, { borderColor: theme.colors.primary }]}>
                        <Text style={[styles.badgeText, { color: theme.colors.primary }]}>PREMIUM</Text>
                    </View>
                )}
            </TouchableOpacity>

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Analyzing metabolism...</Text>
                </View>
            )}

            {expanded && !loading && suggestion && (
                <View style={styles.content}>
                    <View style={[styles.suggestionBox, { backgroundColor: theme.colors.secondaryBg }]}>
                        <Text style={[styles.suggestionText, { color: theme.colors.textPrimary }]}>
                            {suggestion.displayText}
                        </Text>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.logButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => onLogSuggestion?.(suggestion.loggableText)}
                        >
                            <Feather name="plus-circle" size={16} color="white" />
                            <Text style={styles.logButtonText}>Log This Meal</Text>
                        </TouchableOpacity>

                        <View style={styles.miniActions}>
                            <TouchableOpacity onPress={handleRefresh} style={styles.miniButton}>
                                <Feather name="refresh-cw" size={14} color={theme.colors.textSecondary} />
                                <Text style={[styles.miniButtonText, { color: theme.colors.textSecondary }]}>New</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleClose} style={styles.miniButton}>
                                <Feather name="x" size={14} color={theme.colors.textSecondary} />
                                <Text style={[styles.miniButtonText, { color: theme.colors.textSecondary }]}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginTop: 0,
        marginBottom: 16,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    leftRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: 15,
    },
    subtitle: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: 12,
    },
    badge: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    badgeText: {
        fontFamily: Typography.fontFamily.bold,
        fontSize: 10,
    },
    loadingContainer: {
        padding: 16,
        paddingTop: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 12,
        fontFamily: Typography.fontFamily.medium,
    },
    content: {
        padding: 16,
        paddingTop: 0,
    },
    suggestionBox: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    suggestionText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: 14,
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    logButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    logButtonText: {
        color: 'white',
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: 13,
    },
    miniActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    miniButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 4,
    },
    miniButtonText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: 12,
    }
});
