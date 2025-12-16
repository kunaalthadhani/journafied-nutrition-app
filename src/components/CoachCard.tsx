import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { dataStorage, Insight } from '../services/dataStorage';
import { aiCoachService } from '../services/aiCoachService';
import { getActionForInsight, ActionSuggestion, generateInsights } from '../services/insightService';
import { format } from 'date-fns';

export const CoachCard = () => {
    const theme = useTheme();
    const [insight, setInsight] = useState<Insight | null>(null);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [action, setAction] = useState<ActionSuggestion | null>(null);
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        let active = true;

        const loadCoach = async () => {
            try {
                // 1. Check if card was already dismissed today
                const dismissedToday = await dataStorage.isCoachDismissedToday();
                if (dismissedToday) {
                    if (active) {
                        setVisible(false);
                        setLoading(false);
                    }
                    return;
                }

                // 2. Load active insights
                let insights = await dataStorage.loadInsights();
                const todayStr = new Date().toISOString().split('T')[0];
                const hasTodayInsights = insights.some(i => i.date === todayStr);

                // 3. Generate if needed (lazy generation)
                if (!hasTodayInsights) {
                    const snapshot = await dataStorage.getUserMetricsSnapshot();
                    if (snapshot) {
                        const newInsights = generateInsights(snapshot, insights);
                        if (newInsights.length > 0) {
                            await dataStorage.saveInsights(newInsights);
                            insights = await dataStorage.loadInsights();
                        }
                    }
                }

                // 4. Select top insight
                // We show the first active insight for today
                const topInsight = insights.filter(i => !i.isDismissed && i.date === todayStr)[0];

                if (!topInsight) {
                    if (active) {
                        setVisible(false);
                        setLoading(false);
                    }
                    return;
                }

                if (active) setInsight(topInsight);

                // 5. Get Deterministic Action
                const suggestedAction = getActionForInsight(topInsight);
                if (active) setAction(suggestedAction);

                // 6. Get AI Explanation
                const text = await aiCoachService.getCoachResponse();

                if (active) {
                    setExplanation(text);
                    setLoading(false);
                }

            } catch (e) {
                console.error("Coach Card Error", e);
                if (active) setLoading(false);
            }
        };

        loadCoach();

        return () => { active = false; };
    }, []);

    const handleDismiss = async () => {
        setVisible(false);
        await dataStorage.setCoachDismissedToday();
    };

    if (!visible || !insight || !explanation) return null;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Feather name="zap" size={16} color={theme.colors.primary} />
                    <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Daily Coach</Text>
                </View>
                <TouchableOpacity onPress={handleDismiss}>
                    <Feather name="x" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 10 }} />
            ) : (
                <View style={styles.content}>
                    <Text style={[styles.insightType, { color: theme.colors.primary }]}>
                        {insight.title.toUpperCase()}
                    </Text>
                    <Text style={[styles.explanation, { color: theme.colors.textSecondary }]}>
                        {explanation}
                    </Text>

                    {action && (
                        <View style={[styles.actionContainer, { backgroundColor: theme.colors.secondaryBg, borderColor: theme.colors.border }]}>
                            <View style={styles.actionHeader}>
                                <Feather name="check-circle" size={14} color={theme.colors.primary} />
                                <Text style={[styles.actionLabel, { color: theme.colors.textPrimary }]}>TRY THIS</Text>
                            </View>
                            <Text style={[styles.actionTitle, { color: theme.colors.textPrimary }]}>{action.shortLabel}</Text>
                            <Text style={[styles.actionDescription, { color: theme.colors.textSecondary }]}>{action.description}</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 20,
        marginVertical: 10,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        // Shadow (subtle)
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: 14,
    },
    content: {
        gap: 4,
    },
    insightType: {
        fontFamily: Typography.fontFamily.bold,
        fontSize: 12,
        letterSpacing: 0.5,
    },
    explanation: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: 14,
        lineHeight: 20,
    },
    actionContainer: {
        marginTop: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
    },
    actionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    actionLabel: {
        fontFamily: Typography.fontFamily.bold,
        fontSize: 10,
        letterSpacing: 1,
    },
    actionTitle: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: 13,
    },
    actionDescription: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: 12,
        lineHeight: 18,
    }
});
