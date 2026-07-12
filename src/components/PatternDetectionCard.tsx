import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { DetectedPattern } from '../services/dataStorage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PatternDetectionCardProps {
    pattern: DetectedPattern;
    isPremium: boolean;
    onUnlockPress: () => void;
    onDismiss: () => void;
}

export const PatternDetectionCard: React.FC<PatternDetectionCardProps> = ({
    pattern,
    isPremium,
    onUnlockPress,
    onDismiss
}) => {
    const [isCollapsed, setIsCollapsed] = useState(true);

    const toggleCollapse = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsCollapsed(!isCollapsed);
    };

    if (isCollapsed) {
        return (
            <TouchableOpacity onPress={toggleCollapse} activeOpacity={0.7} style={styles.collapsedRow}>
                <Text style={styles.microWord}>PATTERN</Text>
                <Text style={styles.collapsedTitle} numberOfLines={1}>{pattern.title}</Text>
                <Feather name="chevron-down" size={16} color={Acid.tx3} />
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity activeOpacity={0.7} onPress={toggleCollapse} style={styles.headerRow}>
                <Text style={styles.microWord}>PATTERN</Text>
                <Text style={styles.microMeta}>FROM {pattern.dataPoints} LOGGED DAYS</Text>
                <Feather name="chevron-up" size={16} color={Acid.tx3} />
            </TouchableOpacity>

            <Text style={styles.title}>{pattern.title}</Text>
            <Text style={styles.description}>{pattern.description}</Text>

            {pattern.fix ? (
                <View style={styles.fixBlock}>
                    <Text style={styles.fixLabel}>THE FIX</Text>
                    {isPremium ? (
                        <Text style={styles.fixText}>{pattern.fix}</Text>
                    ) : (
                        <TouchableOpacity onPress={onUnlockPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.unlockText}>UNLOCK PREMIUM TO SEE IT</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : null}

            <View style={styles.footerRow}>
                <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.dismissText}>DISMISS</Text>
                </TouchableOpacity>
                <Text style={styles.microMeta}>CONFIDENCE {pattern.confidence}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    collapsedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: Acid.hair,
    },
    container: {
        paddingVertical: 14,
        gap: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: Acid.hair,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    microWord: {
        fontSize: 10,
        fontFamily: Typography.fontFamily.bold,
        letterSpacing: 1.5,
        color: Acid.lime,
    },
    microMeta: {
        flex: 1,
        fontSize: 10,
        fontFamily: Typography.fontFamily.medium,
        letterSpacing: 1,
        color: Acid.tx3,
        textAlign: 'right',
    },
    collapsedTitle: {
        flex: 1,
        fontFamily: 'Fraunces_600SemiBold_Italic',
        fontSize: 14,
        color: Acid.tx,
    },
    title: {
        fontFamily: 'Fraunces_600SemiBold_Italic',
        fontSize: 17,
        lineHeight: 23,
        color: Acid.tx,
    },
    description: {
        fontSize: 14,
        fontFamily: Typography.fontFamily.regular,
        lineHeight: 20,
        color: Acid.tx2,
    },
    fixBlock: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: Acid.hair,
        paddingTop: 10,
        gap: 4,
    },
    fixLabel: {
        fontSize: 10,
        fontFamily: Typography.fontFamily.bold,
        letterSpacing: 1.5,
        color: Acid.tx3,
    },
    fixText: {
        fontSize: 14,
        fontFamily: Typography.fontFamily.regular,
        lineHeight: 20,
        color: Acid.tx,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    dismissText: {
        fontSize: 10,
        fontFamily: Typography.fontFamily.bold,
        letterSpacing: 1.5,
        color: Acid.tx3,
        textDecorationLine: 'underline',
    },
    unlockText: {
        fontSize: 11,
        fontFamily: Typography.fontFamily.bold,
        letterSpacing: 1.5,
        color: Acid.tx,
        textDecorationLine: 'underline',
    },
});
