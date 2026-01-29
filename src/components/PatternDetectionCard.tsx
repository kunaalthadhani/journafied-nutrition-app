import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { DetectedPattern } from '../services/dataStorage';
import { PremiumBlurredContent } from './PremiumBlurredContent';

interface PatternDetectionCardProps {
    pattern: DetectedPattern;
    isPremium: boolean;
    onUnlockPress: () => void;
    onDismiss: () => void;
}

/**
 * Displays a detected behavioral pattern
 * Free users see the problem, premium users see the fix
 */
export const PatternDetectionCard: React.FC<PatternDetectionCardProps> = ({
    pattern,
    isPremium,
    onUnlockPress,
    onDismiss
}) => {
    const theme = useTheme();

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

    return (
        <View style={[styles.container, {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border
        }]}>
            {/* Header */}
            <View style={styles.header}>
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

                <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
                    <Feather name="x" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Description (Always Visible) */}
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

            {/* Data Points Info */}
            <Text style={[styles.dataPoints, { color: theme.colors.textTertiary }]}>
                Based on {pattern.dataPoints} days of your data
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        gap: 12,
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
    dismissButton: {
        padding: 4,
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
    dataPoints: {
        fontSize: 11,
        fontFamily: Typography.fontFamily.regular,
        fontStyle: 'italic',
    },
});
