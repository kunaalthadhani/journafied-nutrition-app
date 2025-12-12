import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { healthService } from '../services/HealthService';

interface IntegrationsScreenProps {
    onBack: () => void;
}

export const IntegrationsScreen: React.FC<IntegrationsScreenProps> = ({ onBack }) => {
    const theme = useTheme();

    // State for connections
    const [isAppleHealthConnected, setIsAppleHealthConnected] = useState(false);
    const [isHealthConnectConnected, setIsHealthConnectConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);

    const handleToggleAppleHealth = async (value: boolean) => {
        if (value) {
            setIsLoading(true);
            const success = await healthService.init();
            setIsLoading(false);

            if (success) {
                setIsAppleHealthConnected(true);
                setLastSync(new Date().toLocaleTimeString());
                Alert.alert('Success', 'Apple Health connected! We will sync your steps and calories.');
            } else {
                setIsAppleHealthConnected(false);
                // Check if we are in Expo Go
                if (!healthService.isModuleAvailable()) {
                    Alert.alert(
                        'Development Build Required',
                        'To use Apple Health, you must run this app using a "Development Build" or on a real device with native code linked.\n\nThis feature cannot work in Expo Go.'
                    );
                } else {
                    Alert.alert('Connection Failed', 'Could not connect to Apple Health. Please check your permissions settings.');
                }
            }
        } else {
            setIsAppleHealthConnected(false);
        }
    };

    const handleToggleHealthConnect = async (value: boolean) => {
        if (value) {
            setIsLoading(true);
            const success = await healthService.init();
            setIsLoading(false);

            if (success) {
                setIsHealthConnectConnected(true);
                setLastSync(new Date().toLocaleTimeString());
                Alert.alert('Success', 'Health Connect paired! Data from your watch (Samsung/Pixel/etc) will sync.');
            } else {
                setIsHealthConnectConnected(false);
                if (!healthService.isModuleAvailable()) {
                    Alert.alert(
                        'Development Build Required',
                        'To use Health Connect, you must run this app using a "Development Build".\n\nThis feature cannot work in Expo Go.'
                    );
                } else {
                    Alert.alert('Connection Failed', 'Could not connect to Health Connect. Ensure the app is installed and permissions are granted.');
                }
            }
        } else {
            setIsHealthConnectConnected(false);
        }
    };

    const handleManualSync = async () => {
        setIsLoading(true);
        // Simulate sync delay
        const data = await healthService.getData();
        setIsLoading(false);
        setLastSync(new Date().toLocaleTimeString());
        Alert.alert('Synced', `Updated data: ${data.steps} steps, ${Math.round(data.calories)} kcal.`);
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Integrations</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.content}>
                <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                    Connect your smart watch and health apps to automatically sync steps, calories, and workouts.
                </Text>

                {/* iOS Section */}
                {Platform.OS === 'ios' && (
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: '#F0F0F0' }]}>
                                <Feather name="activity" size={24} color="#FF2D55" />
                            </View>
                            <View style={styles.cardTexts}>
                                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Apple Health</Text>
                                <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>Syncs with Apple Watch</Text>
                            </View>
                            <Switch
                                value={isAppleHealthConnected}
                                onValueChange={handleToggleAppleHealth}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={'#FFF'}
                            />
                        </View>
                    </View>
                )}

                {/* Android Section */}
                {Platform.OS === 'android' && (
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                                <Feather name="watch" size={24} color="#2196F3" />
                            </View>
                            <View style={styles.cardTexts}>
                                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Health Connect</Text>
                                <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>Samsung Health, Google Fit, Pixel Watch</Text>
                            </View>
                            <Switch
                                value={isHealthConnectConnected}
                                onValueChange={handleToggleHealthConnect}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={'#FFF'}
                            />
                        </View>
                    </View>
                )}

                {/* Sync Status Section */}
                {(isAppleHealthConnected || isHealthConnectConnected) && (
                    <View style={[styles.statusSection, { borderTopColor: theme.colors.border }]}>
                        <Text style={[styles.statusTitle, { color: theme.colors.textPrimary }]}>Sync Status</Text>

                        <View style={styles.statusRow}>
                            <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>Last synced:</Text>
                            <Text style={[styles.statusValue, { color: theme.colors.textPrimary }]}>{lastSync || 'Never'}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.syncButton, { backgroundColor: theme.colors.primary }]}
                            onPress={handleManualSync}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={theme.colors.primaryForeground} size="small" />
                            ) : (
                                <>
                                    <Feather name="refresh-cw" size={18} color={theme.colors.primaryForeground} />
                                    <Text style={[styles.syncButtonText, { color: theme.colors.primaryForeground }]}>Sync Now</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    backButton: { padding: 8 },
    headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.semiBold },
    headerRight: { width: 40 },
    content: { padding: 16 },
    description: { fontSize: Typography.fontSize.md, marginBottom: 24, lineHeight: 22 },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTexts: {
        flex: 1,
    },
    cardTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: Typography.fontWeight.semiBold,
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: Typography.fontSize.sm,
    },
    statusSection: {
        marginTop: 32,
        borderTopWidth: 1,
        paddingTop: 24,
    },
    statusTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: Typography.fontWeight.semiBold,
        marginBottom: 16,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statusLabel: { fontSize: Typography.fontSize.md },
    statusValue: { fontSize: Typography.fontSize.md, fontWeight: '500' },
    syncButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 30,
        gap: 8,
    },
    syncButtonText: {
        fontSize: Typography.fontSize.md,
        fontWeight: '600',
    }
});
