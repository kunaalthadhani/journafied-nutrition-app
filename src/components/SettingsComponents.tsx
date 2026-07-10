import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';

interface SettingItemProps {
    icon?: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    onLongPress?: () => void;
    rightElement?: React.ReactNode;
    showChevron?: boolean;
    disabled?: boolean;
}

export const SettingItem: React.FC<SettingItemProps> = ({
    icon,
    title,
    subtitle,
    onPress,
    onLongPress,
    rightElement,
    showChevron = true,
    disabled = false,
}) => {
    return (
        <TouchableOpacity
            style={[styles.settingItem, disabled && { opacity: 0.5 }]}
            onPress={disabled ? undefined : onPress}
            onLongPress={disabled ? undefined : onLongPress}
            activeOpacity={0.7}
            disabled={disabled || !onPress}
        >
            <View style={styles.settingItemLeft}>
                {icon && (
                    <Feather name={icon as any} size={18} color={Acid.tx2} style={styles.icon} />
                )}
                <View style={styles.settingItemText}>
                    <Text style={styles.settingTitle}>
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={styles.settingSubtitle}>
                            {subtitle}
                        </Text>
                    )}
                </View>
            </View>
            <View style={styles.settingItemRight}>
                {rightElement}
                {showChevron && onPress && !disabled && (
                    <Feather name="chevron-right" size={18} color={Acid.tx3} />
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
    return (
        <View style={styles.section}>
            {title && (
                <Text style={styles.sectionTitle}>
                    {title}
                </Text>
            )}
            <View>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        marginTop: 28,
    },
    sectionTitle: {
        fontSize: 11,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: Acid.tx3,
        marginBottom: 4,
        paddingHorizontal: 4,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Acid.hair,
    },
    settingItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    icon: {
        width: 30,
    },
    settingItemText: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: Acid.tx,
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: 12.5,
        color: Acid.tx2,
        lineHeight: 17,
    },
    settingItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
});
