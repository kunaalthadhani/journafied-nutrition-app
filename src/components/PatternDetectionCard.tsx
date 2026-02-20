import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { DetectedPattern } from '../services/dataStorage';
import { PremiumBlurredContent } from './PremiumBlurredContent';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PatternDetectionCardProps {
    pattern: DetectedPattern;
    isPremium: boolean;
    onUnlockPress: () => void;
    onDismiss: () => void;
}

/**
 * Displays a detected behavioral pattern (Insight)
 * Collapsible to avoid cluttering the UI
 */
export const PatternDetectionCard: React.FC<PatternDetectionCardProps> = ({
    pattern,
    isPremium,
    onUnlockPress,
    onDismiss
}) => {
    const theme = useTheme();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);

    const toggleCollapse = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsCollapsed(!isCollapsed);
    };

    const getPatternIcon = () => {
        switch (pattern.type) {
            case 'correlation': return 'trending-up';
            case 'trigger': return 'alert-circle';
            case 'outcome': return 'target';
            default: return 'info';
        }
    };

    const getConfidenceColor = () => {
        if (pattern.confidence >= 85) return '#10b981'; // Green
        if (pattern.confidence >= 70) return '#f59e0b'; // Amber
        return theme.colors.textSecondary;
    };

    const handleFeedback = (type: 'helpful' | 'not_helpful') => {
        setFeedback(type);
        // Here you would typically send this to analytics or backend
    };

    if (isCollapsed) {
        return (
            <TouchableOpacity
                onPress={toggleCollapse}
                activeOpacity={0.8}
                style={[styles.container, styles.collapsedContainer, {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                }]}
            >
                <View style={styles.collapsedContent}>
                    <View style={styles.collapsedLeft}>
                        <View style={[styles.iconBoxSmall, { backgroundColor: theme.colors.primary + '15' }]}>
                            <Feather name="zap" size={16} color={theme.colors.primary} />
                        </View>
                        <Text style={[styles.collapsedTitle, { color: theme.colors.textPrimary }]}>
                            New Insight Available ✨
                        </Text>
                    </View>
                    <View style={styles.collapsedRight}>
                        <Feather name="chevron-down" size={20} color={theme.colors.textTertiary} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View style={[styles.container, {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border
        }]}>
            {/* Header */}
            <TouchableOpacity
                activeOpacity={1}
                onPress={toggleCollapse}
                style={styles.header}
            >
                <View style={styles.leftHeader}>
                    <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '20' }]}>
                        <Feather name={getPatternIcon()} size={18} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={styles.titleRow}>
                            <Text style={[styles.badge, { color: getConfidenceColor(), borderColor: getConfidenceColor() }]}>
                                {pattern.confidence}% Confidence
                            </Text>
                        </View>
                        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                            {pattern.title}
                        </Text>
                    </View>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={toggleCollapse} style={styles.actionButton}>
                        <Feather name="chevron-up" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDismiss} style={styles.actionButton}>
                        <Feather name="x" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Description (Always Visible in Expanded) */}
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                {pattern.description}
            </Text>

            {/* Fix Section */}
            {isPremium && pattern.fix ? (
                <View style={[styles.fixBox, { backgroundColor: theme.colors.success + '10', borderColor: theme.colors.success + '30' }]}>
                    <View style={styles.fixHeader}>
                        <Feather name="check-circle" size={14} color={theme.colors.success} />
                        <Text style={[styles.fixLabel, { color: theme.colors.success }]}>SMART FIX</Text>
                    </View>
                    <Text style={[styles.fixText, { color: theme.colors.textPrimary }]}>
                        {pattern.fix}
                    </Text>
                </View>
            ) : !isPremium && pattern.fix ? (
                <PremiumBlurredContent onUnlockPress={onUnlockPress} height={90}>
                    <View style={[styles.fixBox, { backgroundColor: theme.colors.success + '10', borderColor: theme.colors.success + '30' }]}>
                        <View style={styles.fixHeader}>
                            <Feather name="check-circle" size={14} color={theme.colors.success} />
                            <Text style={[styles.fixLabel, { color: theme.colors.success }]}>SMART FIX</Text>
                        </View>
                        <Text style={[styles.fixText, { color: theme.colors.textPrimary }]}>
                            {pattern.fix}
                        </Text>
                    </View>
                </PremiumBlurredContent>
            ) : null}

            {/* Footer: Data Points & Feedback */}
            <View style={styles.footer}>
                <Text style={[styles.dataPoints, { color: theme.colors.textTertiary }]}>
                    Based on {pattern.dataPoints} days of your data
                </Text>

                {isPremium && (
                    <View style={styles.feedbackContainer}>
                        {feedback ? (
                            <Text style={[styles.feedbackThanks, { color: theme.colors.textSecondary }]}>Thanks for your feedback!</Text>
                        ) : (
                            <>
                                <Text style={[styles.feedbackLabel, { color: theme.colors.textTertiary }]}>Helpful?</Text>
                                <View style={styles.feedbackButtons}>
                                    <TouchableOpacity onPress={() => handleFeedback('helpful')} style={styles.feedbackButton}>
                                        <Feather name="thumbs-up" size={14} color={theme.colors.textSecondary} />
                                    </TouchableOpacity>
                                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                                    <TouchableOpacity onPress={() => handleFeedback('not_helpful')} style={styles.feedbackButton}>
                                        <Feather name="thumbs-down" size={14} color={theme.colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        gap: 12,
        overflow: 'hidden',
    },
    collapsedContainer: {
        padding: 12,
        paddingVertical: 10, // More compact
    },
    collapsedContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    collapsedLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8, // Tighter gap
    },
    collapsedRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBoxSmall: {
        width: 28, // Smaller icon box
        height: 28,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    collapsedTitle: {
        fontSize: 14,
        fontFamily: Typography.fontFamily.medium, // Slightly lighter weight for "teaser" feel
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    leftHeader: {
        flexDirection: 'row',
        gap: 12,
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    actionButton: {
        padding: 4,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleRow: {
        marginBottom: 4,
    },
    badge: {
        fontSize: 10,
        fontFamily: Typography.fontFamily.bold,
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: 'flex-start',
    },
    title: {
        fontSize: 15,
        fontFamily: Typography.fontFamily.semiBold,
        lineHeight: 20,
    },
    description: {
        fontSize: 14,
        fontFamily: Typography.fontFamily.regular,
        lineHeight: 20,
    },
    fixBox: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        gap: 6,
    },
    fixHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fixLabel: {
        fontSize: 11,
        fontFamily: Typography.fontFamily.bold,
        letterSpacing: 0.5,
    },
    fixText: {
        fontSize: 13,
        fontFamily: Typography.fontFamily.medium,
        lineHeight: 18,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    dataPoints: {
        fontSize: 11,
        fontFamily: Typography.fontFamily.regular,
        fontStyle: 'italic',
    },
    feedbackContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    feedbackButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 12,
        padding: 2,
    },
    feedbackButton: {
        padding: 6,
    },
    divider: {
        width: 1,
        height: 12,
    },
    feedbackLabel: {
        fontSize: 11,
        fontFamily: Typography.fontFamily.medium,
    },
    feedbackThanks: {
        fontSize: 11,
        fontFamily: Typography.fontFamily.medium,
        fontStyle: 'italic',
    },
});
