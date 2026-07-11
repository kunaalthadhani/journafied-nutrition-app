import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { dataStorage } from '../services/dataStorage';
import { generateSmartSuggestion } from '../services/openaiService';
import { chatCoachService } from '../services/chatCoachService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface SmartSuggestBannerProps {
    isPremium: boolean;
    // Returns true only if a meal was actually logged. The button must not claim
    // success when the log failed or was aborted (clarification, no food found).
    onLogSuggestion?: (suggestion: string) => boolean | void | Promise<boolean | void>;
}

export const SmartSuggestBanner: React.FC<SmartSuggestBannerProps> = ({ isPremium, onLogSuggestion }) => {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [suggestion, setSuggestion] = useState<{ displayText: string; loggableText: string; reasoning?: string } | null>(null);
    const [isDayComplete, setIsDayComplete] = useState(false);
    const [logState, setLogState] = useState<'idle' | 'logging' | 'logged'>('idle');

    const handleLog = async () => {
        if (logState !== 'idle' || !suggestion?.loggableText?.trim()) return;
        setLogState('logging');
        let logged = false;
        try {
            logged = (await onLogSuggestion?.(suggestion.loggableText)) === true;
        } catch { /* parent shows its own error; fall through to idle so the user can retry */ }
        setLogState(logged ? 'logged' : 'idle');
    };

    useEffect(() => {
        const checkPref = async () => {
            const prefs = await dataStorage.loadPreferences();
            if (prefs && prefs.smartSuggestEnabled === true) {
                setVisible(true);
            } else {
                setVisible(false);
            }
        };
        checkPref();
    }, []);

    const fetchSuggestion = async (forceNew: boolean, forceHungry: boolean = false) => {
        setLoading(true);
        setLogState('idle'); // a fresh suggestion is a new, loggable meal
        try {
            const ctx = await chatCoachService.buildContext({ minLoggedDays: 3, requireWeight: false });

            if (ctx.dataQuality === 'insufficient') {
                setSuggestion({
                    displayText: "Smart Suggest needs a few days of meal data to learn what you eat. Keep logging and check back soon.",
                    loggableText: "",
                });
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setExpanded(true);
                setLoading(false);
                return;
            }

            const remainingCalories = ctx.remainingMacros.calories;

            // Check if day is complete (0 or negative calories left)
            if (remainingCalories <= 0 && !forceHungry) {
                setSuggestion({
                    displayText: "You've hit your calorie goal for the day! Outstanding work.",
                    loggableText: "",
                    reasoning: "Staying within your budget is the key to progress. Close the kitchen and let your body do its work!"
                });
                setIsDayComplete(true);
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setExpanded(true);
                setLoading(false);
                return;
            }

            // Reset day complete if we're forcing a hungry suggestion
            if (forceHungry) {
                setIsDayComplete(false);
            }

            const promptContext = {
                remainingCalories: remainingCalories,
                remainingProtein: ctx.remainingMacros.protein,
                remainingCarbs: ctx.remainingMacros.carbs,
                remainingFat: ctx.remainingMacros.fat,
                mealsEatenToday: ctx.todaysLog.meals.length,
                timeOfDay: new Date().getHours(),
                goal: ctx.userProfile.goalType,
                availableFoods: ctx.topFoods || []
            };

            const result = await generateSmartSuggestion(promptContext, forceNew, { forceHungry });
            // Handle legacy string return just in case, though we updated service
            if (typeof result === 'string') {
                setSuggestion({ displayText: result, loggableText: result });
            } else {
                setSuggestion(result);
            }
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded(true);
        } catch (e) {
            setSuggestion({
                displayText: "Could not generate a suggestion right now. Please try again later.",
                loggableText: "",
            });
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded(true);
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

    if (!visible || !isPremium) return null;

    return (
        <View style={[styles.container, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={handlePress}
                style={styles.header}
                disabled={expanded}
            >
                <View style={styles.leftRow}>
                    <View style={[styles.iconBox, { backgroundColor: Acid.lime }]}>
                        <Feather name="zap" size={16} color="white" />
                    </View>
                    <View>
                        <Text style={[styles.title, { color: Acid.tx }]}>Smart Suggest</Text>
                        <Text style={[styles.subtitle, { color: Acid.tx2 }]}>
                            {expanded ? "Optimum Meal Found" : "Tap for your optimum next meal"}
                        </Text>
                    </View>
                </View>
                {!expanded && (
                    <View style={[styles.badge, { borderColor: Acid.lime }]}>
                        <Text style={[styles.badgeText, { color: Acid.lime }]}>PREMIUM</Text>
                    </View>
                )}
            </TouchableOpacity>

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Acid.lime} />
                    <Text style={[styles.loadingText, { color: Acid.tx2 }]}>Analyzing metabolism...</Text>
                </View>
            )}

            {expanded && !loading && suggestion && (
                <View style={styles.content}>
                    <View style={[styles.suggestionBox, { backgroundColor: Acid.mossDeep }]}>
                        <Text style={[styles.suggestionText, { color: Acid.tx }]}>
                            {suggestion.displayText}
                        </Text>
                        {suggestion.reasoning && (
                            <View style={[styles.reasoningContainer, { borderTopColor: Acid.hair + '40' }]}>
                                <View style={styles.reasoningHeader}>
                                    <Feather name="info" size={12} color={Acid.lime} style={styles.reasoningIcon} />
                                    <Text style={[styles.reasoningLabel, { color: Acid.lime }]}>Why this option?</Text>
                                </View>
                                <Text style={[styles.reasoningText, { color: Acid.tx2 }]}>
                                    {suggestion.reasoning}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.actions}>
                        {isDayComplete ? (
                            <TouchableOpacity
                                style={[styles.logButton, { backgroundColor: Acid.carbs || '#f59e0b' }]}
                                onPress={() => fetchSuggestion(true, true)}
                            >
                                <Feather name="alert-triangle" size={16} color="white" />
                                <Text style={styles.logButtonText}>I'm Hungry, Suggest Me</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.logButton, {
                                    backgroundColor: logState === 'logged' ? (Acid.good || Acid.good) : Acid.lime,
                                    opacity: logState === 'logging' ? 0.75 : 1,
                                }]}
                                onPress={handleLog}
                                disabled={logState !== 'idle'}
                                activeOpacity={0.8}
                            >
                                {logState === 'logging' ? (
                                    <>
                                        <ActivityIndicator size="small" color="white" />
                                        <Text style={styles.logButtonText}>Logging...</Text>
                                    </>
                                ) : logState === 'logged' ? (
                                    <>
                                        <Feather name="check-circle" size={16} color="white" />
                                        <Text style={styles.logButtonText}>Meal Logged</Text>
                                    </>
                                ) : (
                                    <>
                                        <Feather name="plus-circle" size={16} color="white" />
                                        <Text style={styles.logButtonText}>Log This Meal</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        <View style={styles.miniActions}>
                            <TouchableOpacity onPress={handleRefresh} style={styles.miniButton}>
                                <Feather name="refresh-cw" size={14} color={Acid.tx2} />
                                <Text style={[styles.miniButtonText, { color: Acid.tx2 }]}>New</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleClose} style={styles.miniButton}>
                                <Feather name="x" size={14} color={Acid.tx2} />
                                <Text style={[styles.miniButtonText, { color: Acid.tx2 }]}>Close</Text>
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
    },
    reasoningContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    reasoningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    reasoningIcon: {
        marginRight: 6,
    },
    reasoningLabel: {
        fontSize: 11,
        fontFamily: Typography.fontFamily.bold,
        textTransform: 'uppercase',
    },
    reasoningText: {
        fontSize: 13,
        fontStyle: 'italic',
        lineHeight: 18,
    },
});
