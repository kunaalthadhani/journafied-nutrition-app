import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';

interface SettingItemProps {
    icon?: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    showChevron?: boolean;
    disabled?: boolean;
}

export const SettingItem: React.FC<SettingItemProps> = ({
    icon,
    title,
    subtitle,
    onPress,
    rightElement,
    showChevron = true,
    disabled = false,
}) => {
    const theme = useTheme();

    return (
        <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.colors.border }, disabled && { opacity: 0.5 }]}
            onPress={disabled ? undefined : onPress}
            activeOpacity={0.7}
            disabled={disabled || !onPress}
        >
            <View style={styles.settingItemLeft}>
                {icon && (
                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.input }]}>
                        <Feather name={icon as any} size={20} color={theme.colors.textPrimary} />
                    </View>
                )}
                <View style={styles.settingItemText}>
                    <Text style={[styles.settingTitle, { color: theme.colors.textPrimary }]}>
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                            {subtitle}
                        </Text>
                    )}
                </View>
            </View>
            <View style={styles.settingItemRight}>
                {rightElement}
                {showChevron && onPress && !disabled && (
                    <Feather name="chevron-right" size={20} color={theme.colors.textTertiary} />
                )}
            </View>
        </TouchableOpacity>
    );
};

interface SettingSectionProps {
    title?: string;
    children: React.ReactNode;
}

export const SettingSection: React.FC<SettingSectionProps> = ({ title, children }) => {
    const theme = useTheme();

    return (
        <View style={styles.section}>
            {title && (
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                    {title}
                </Text>
            )}
            <View style={[styles.sectionContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: Typography.fontWeight.semiBold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionContent: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    settingItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingItemText: {
        flex: 1,
    },
    settingTitle: {
        fontSize: Typography.fontSize.md,
        fontWeight: Typography.fontWeight.medium,
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: Typography.fontSize.sm,
    },
    settingItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
});
