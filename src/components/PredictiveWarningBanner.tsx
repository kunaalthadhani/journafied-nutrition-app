import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { PremiumBlurredContent } from './PremiumBlurredContent';

interface PredictiveWarningBannerProps {
    projectedCalories: number;
    goalCalories: number;
    overage: number;
    isPremium: boolean;
    alternatives?: string[]; // Premium-only suggestions
    onUnlockPress: () => void;
    onDismiss: () => void;
}

/**
 * Real-time warning shown when logging food that will exceed goals
 * Free users see blurred warning, Premium users see alternatives
 */
export const PredictiveWarningBanner: React.FC<PredictiveWarningBannerProps> = ({
    projectedCalories,
    goalCalories,
    overage,
    isPremium,
    alternatives,
    onUnlockPress,
    onDismiss
}) => {
    const theme = useTheme();

    return (
        <View style={[styles.container, {
            backgroundColor: theme.colors.warning + '10',
            borderColor: theme.colors.warning + '40'
        }]}>
            <View style={styles.header}>
                <View style={styles.leftHeader}>
                    <View style={[styles.iconBox, { backgroundColor: theme.colors.warning }]}>
                        <Feather name="alert-triangle" size={20} color="white" />
                    </View>
                    <View>
                        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                            Predictive Guardrail
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            This meal will put you over goal
                        </Text>
                    </View>
                </View>

                <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
                    <Feather name="x" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.stats}>
                <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                        Projected Total
                    </Text>
                    <Text style={[styles.statValue, { color: theme.colors.warning }]}>
                        {Math.round(projectedCalories)} kcal
                    </Text>
                </View>

                <Feather name="arrow-right" size={16} color={theme.colors.textTertiary} />

                <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                        Over By
                    </Text>
                    <Text style={[styles.statValue, { color: theme.colors.error }]}>
                        +{Math.round(overage)} kcal
                    </Text>
                </View>
            </View>

            {/* Alternatives Section (Premium Gated) */}
            {isPremium && alternatives && alternatives.length > 0 ? (
                <View style={[styles.alternativesBox, { backgroundColor: theme.colors.secondaryBg }]}>
                    <View style={styles.alternativesHeader}>
                        <Feather name="zap" size={14} color={theme.colors.primary} />
                        <Text style={[styles.alternativesLabel, { color: theme.colors.primary }]}>
                            BETTER OPTIONS
                        </Text>
                    </View>
                    {alternatives.map((alt, index) => (
                        <View key={index} style={styles.alternativeItem}>
                            <Feather name="check" size={12} color={theme.colors.success} />
                            <Text style={[styles.alternativeText, { color: theme.colors.textSecondary }]}>
                                {alt}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : !isPremium ? (
                <PremiumBlurredContent onUnlockPress={onUnlockPress} height={80}>
                    <View style={[styles.alternativesBox, { backgroundColor: theme.colors.secondaryBg }]}>
                        <View style={styles.alternativesHeader}>
                            <Feather name="zap" size={14} color={theme.colors.primary} />
                            <Text style={[styles.alternativesLabel, { color: theme.colors.primary }]}>
                                BETTER OPTIONS
                            </Text>
                        </View>
                        <Text style={[styles.alternativeText, { color: theme.colors.textSecondary }]}>
                            Premium shows healthier alternatives...
                        </Text>
                    </View>
                </PremiumBlurredContent>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        borderWidth: 1.5,
        padding: 14,
        gap: 12,
        marginHorizontal: 16,
        marginTop: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    leftHeader: {
        flexDirection: 'row',
        gap: 10,
        flex: 1,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 15,
        fontFamily: Typography.fontFamily.semiBold,
    },
    subtitle: {
        fontSize: 12,
        fontFamily: Typography.fontFamily.regular,
    },
    dismissButton: {
        padding: 4,
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 8,
        gap: 12,
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 11,
        fontFamily: Typography.fontFamily.regular,
        marginBottom: 2,
    },
    statValue: {
        fontSize: 16,
        fontFamily: Typography.fontFamily.bold,
    },
    alternativesBox: {
        padding: 10,
        borderRadius: 8,
        gap: 8,
    },
    alternativesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    alternativesLabel: {
        fontSize: 10,
        fontFamily: Typography.fontFamily.bold,
        letterSpacing: 0.5,
    },
    alternativeItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    alternativeText: {
        fontSize: 12,
        fontFamily: Typography.fontFamily.regular,
        lineHeight: 18,
        flex: 1,
    },
});
