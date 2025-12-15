
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated, LayoutAnimation, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { AdjustmentRecord } from '../services/dataStorage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SmartAdjustmentModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (adjustment?: AdjustmentRecord) => void;
    adjustment: AdjustmentRecord | null;
}

export const SmartAdjustmentModal: React.FC<SmartAdjustmentModalProps> = ({ visible, onClose, onApply, adjustment }) => {
    const theme = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const expandAnim = useRef(new Animated.Value(0)).current; // 0 = collapsed, 1 = expanded

    // Editable values (Strings to allow empty state)
    const [editedCalories, setEditedCalories] = useState('');
    const [editedProtein, setEditedProtein] = useState('');
    const [editedCarbs, setEditedCarbs] = useState('');
    const [editedFats, setEditedFats] = useState('');

    // Ratios state: stored to preserve distribution when scaling calories
    const [ratios, setRatios] = useState({ p: 0.3, c: 0.4, f: 0.3 });

    useEffect(() => {
        if (adjustment) {
            setEditedCalories(String(adjustment.newCalories));
            setEditedProtein(String(adjustment.macros?.protein || 0));
            setEditedCarbs(String(adjustment.macros?.carbs || 0));
            setEditedFats(String(adjustment.macros?.fats || 0));

            // Calculate initial ratios from the SUGGESTED macros
            const total = adjustment.newCalories;
            if (total > 0 && adjustment.macros) {
                const p = (adjustment.macros.protein * 4) / total;
                const c = (adjustment.macros.carbs * 4) / total;
                const f = (adjustment.macros.fats * 9) / total;
                setRatios({ p, c, f });
            }

            setIsEditing(false);
            setIsExpanded(false);
            expandAnim.setValue(0);
        }
    }, [adjustment, visible]);

    const toggleExpand = () => {
        Animated.timing(expandAnim, {
            toValue: isExpanded ? 0 : 1,
            duration: 300,
            useNativeDriver: false, // height animation requires false
        }).start();
        setIsExpanded(!isExpanded);
    };

    if (!adjustment) return null;

    // --- Validation Logic ---
    const currentCalVal = parseInt(editedCalories) || 0;
    const minAllowed = adjustment.previousCalories - 300;
    // Rule: New calories cannot be less than (Previous - 300)
    // aka "Max reduction is 300"
    const isTooLow = currentCalVal < minAllowed;

    // --- Bi-directional Editing Logic ---

    // 1. Calories changed -> Recalculate Macros based on *saved* ratios
    const handleCaloriesChange = (text: string) => {
        setEditedCalories(text); // Allow empty string
        const cals = parseInt(text);

        if (!isNaN(cals) && cals > 0) {
            // Use EXISTING ratios to distribute new calories
            const p = Math.round((cals * ratios.p) / 4);
            const c = Math.round((cals * ratios.c) / 4);
            const f = Math.round((cals * ratios.f) / 9);
            setEditedProtein(String(p));
            setEditedCarbs(String(c));
            setEditedFats(String(f));
        } else {
            // If calories cleared to 0 or empty, we DON'T update macros to 0 visually 
            // OR we do, but we keep ratios intact.
            // Let's clear macros too for visual consistency, but RATIOS state remains safe.
            if (text === '' || cals === 0) {
                setEditedProtein('');
                setEditedCarbs('');
                setEditedFats('');
            }
        }
    };

    // 2. Macro changed -> Recalculate Total Calories AND update ratios
    const handleMacroChange = (type: 'p' | 'c' | 'f', text: string) => {
        // Parse current values (treat empty as 0 for calc)
        let p = parseInt(editedProtein) || 0;
        let c = parseInt(editedCarbs) || 0;
        let f = parseInt(editedFats) || 0;

        // Strip leading zeros if user is typing
        const cleanText = text.replace(/^0+/, '') || '';
        const val = parseInt(cleanText) || 0;

        if (type === 'p') { setEditedProtein(cleanText); p = val; }
        if (type === 'c') { setEditedCarbs(cleanText); c = val; }
        if (type === 'f') { setEditedFats(cleanText); f = val; }

        // Recalculate total
        const newTotal = (p * 4) + (c * 4) + (f * 9);
        setEditedCalories(String(newTotal || '')); // If 0, show empty or 0? specific request: "persistent zero" gone.

        // Update ratios only if we have a valid total to base off
        if (newTotal > 0) {
            setRatios({
                p: (p * 4) / newTotal,
                c: (c * 4) / newTotal,
                f: (f * 9) / newTotal
            });
        }
    };


    const handleApplyPress = () => {
        if (isTooLow) {
            // Block or warn? request says "not be allowed".
            return;
        }

        if (isEditing) {
            setIsEditing(false);
        }

        const finalCalories = parseInt(editedCalories) || adjustment.newCalories;
        const finalProtein = parseInt(editedProtein) || adjustment.macros?.protein || 0;
        const finalCarbs = parseInt(editedCarbs) || adjustment.macros?.carbs || 0;
        const finalFats = parseInt(editedFats) || adjustment.macros?.fats || 0;

        const modifiedRecord: AdjustmentRecord = {
            ...adjustment,
            newCalories: finalCalories,
            macros: {
                protein: finalProtein,
                carbs: finalCarbs,
                fats: finalFats,
            }
        };

        onApply(modifiedRecord);
    };

    // Animation interpolation for text height
    // We'll animate the max-height or height of the container
    const detailsHeight = expandAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 100] // aprox max height needed
    });

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>

                        <View style={styles.header}>
                            <View style={[styles.headerIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                <Feather name="trending-up" size={24} color={theme.colors.primary} />
                            </View>
                            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Smart Adjustment</Text>

                            {/* Collapsible Educational Text */}
                            <View>
                                {/* First 2 lines always visible (approx) */}
                                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                    Smart Update automatically fine-tunes your nutrition targets based on your weight progress.
                                </Text>

                                {/* Animated collapsible part */}
                                <Animated.View style={{
                                    overflow: 'hidden', height: expandAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, 45] // Estimate height for the rest of text
                                    }), opacity: expandAnim
                                }}>
                                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary, marginTop: 0 }]}>
                                        This prevents plateaus and ensures your goals stay realistic and effective.
                                    </Text>
                                </Animated.View>

                                <TouchableOpacity onPress={toggleExpand} activeOpacity={0.8} style={{ padding: 4 }}>
                                    <Text style={{ color: theme.colors.primary, fontSize: 12, textAlign: 'center' }}>
                                        {isExpanded ? 'Show less' : 'Read more'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={[styles.diffCard, { backgroundColor: theme.colors.background }]}>
                            <View style={styles.diffRow}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Weight Change</Text>
                                <Text style={[styles.value, { color: theme.colors.textPrimary }]}>
                                    {adjustment.previousWeight}kg → {adjustment.currentWeight}kg
                                </Text>
                            </View>
                            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                            {/* Daily Goal Header + Edit Icon */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Daily Goal</Text>
                                {!isEditing && (
                                    <TouchableOpacity onPress={() => setIsEditing(true)} style={{ padding: 4 }}>
                                        <Feather name="edit-2" size={16} color={theme.colors.primary} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.diffRow}>
                                <Text style={{ fontSize: 14, color: isEditing ? theme.colors.textTertiary : theme.colors.textSecondary, textDecorationLine: isEditing ? 'none' : 'line-through' }}>
                                    {adjustment.previousCalories}
                                </Text>
                                <Feather name="arrow-right" size={14} color={theme.colors.textTertiary} />

                                {isEditing ? (
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 8, borderWidth: 1, borderColor: isTooLow ? 'red' : theme.colors.primary, paddingHorizontal: 8, paddingVertical: 4 }}>
                                            <TextInput
                                                value={editedCalories}
                                                onChangeText={handleCaloriesChange}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                placeholderTextColor={theme.colors.textTertiary}
                                                style={[styles.input, { color: theme.colors.primary, fontWeight: 'bold', minWidth: 40, textAlign: 'right' }]}
                                            />
                                            <Text style={{ color: theme.colors.textSecondary, marginLeft: 4 }}>kcal</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <Text style={[styles.value, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                                        {editedCalories} kcal
                                    </Text>
                                )}
                            </View>
                            {isEditing && isTooLow && (
                                <Text style={{ color: 'red', fontSize: 10, textAlign: 'right', marginTop: 4 }}>
                                    Max reduction: 300 kcal (Min: {minAllowed})
                                </Text>
                            )}
                        </View>

                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 16, marginBottom: 8, fontWeight: '600' }}>
                            NEW MACRO SPLIT {isEditing ? '(Editable)' : ''}
                        </Text>

                        {isEditing ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 }}>
                                <MacroEditItem label="Protein" value={editedProtein} onChange={(t: string) => handleMacroChange('p', t)} color="#3B82F6" theme={theme} />
                                <MacroEditItem label="Carbs" value={editedCarbs} onChange={(t: string) => handleMacroChange('c', t)} color="#10B981" theme={theme} />
                                <MacroEditItem label="Fats" value={editedFats} onChange={(t: string) => handleMacroChange('f', t)} color="#F59E0B" theme={theme} />
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
                                <MacroItem
                                    label="Protein"
                                    value={`${editedProtein}g`}
                                    oldValue={adjustment.previousMacros?.protein}
                                    color="#3B82F6"
                                    theme={theme}
                                />
                                <MacroItem
                                    label="Carbs"
                                    value={`${editedCarbs}g`}
                                    oldValue={adjustment.previousMacros?.carbs}
                                    color="#10B981"
                                    theme={theme}
                                />
                                <MacroItem
                                    label="Fats"
                                    value={`${editedFats}g`}
                                    oldValue={adjustment.previousMacros?.fats}
                                    color="#F59E0B"
                                    theme={theme}
                                />
                            </View>
                        )}

                        <View style={styles.actions}>
                            <TouchableOpacity
                                onPress={onClose}
                                style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                            >
                                <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Not Now</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleApplyPress}
                                style={[styles.primaryButton, { backgroundColor: isTooLow ? theme.colors.textTertiary : theme.colors.primary, opacity: isTooLow ? 0.7 : 1 }]}
                                disabled={isTooLow}
                            >
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Update My Plan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const MacroItem = ({ label, value, oldValue, color, theme }: any) => (
    <View style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: theme.colors.background, marginHorizontal: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginBottom: 6 }} />
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 }}>{label}</Text>

        {oldValue && (
            <Text style={{ fontSize: 11, color: theme.colors.textTertiary, textDecorationLine: 'line-through', marginBottom: 0 }}>
                {oldValue}g
            </Text>
        )}

        <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary }}>{value}</Text>
    </View>
);

const MacroEditItem = ({ label, value, onChange, color, theme }: any) => (
    <View style={{ flex: 1, alignItems: 'center', padding: 8, borderRadius: 8, backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginBottom: 6 }} />
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 2 }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <TextInput
                value={value}
                onChangeText={onChange}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.textTertiary}
                style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary, textAlign: 'center', minWidth: 30 }}
            />
            <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>g</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        padding: 20,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: Typography.fontSize.xl,
        fontWeight: Typography.fontWeight.bold,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: Typography.fontSize.sm,
        textAlign: 'center',
        lineHeight: 20,
    },
    diffCard: {
        borderRadius: 12,
        padding: 16,
    },
    diffRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    divider: {
        height: 1,
        marginVertical: 12,
    },
    label: {
        fontSize: Typography.fontSize.sm,
    },
    value: {
        fontSize: Typography.fontSize.md,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    primaryButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        fontSize: Typography.fontSize.md,
        padding: 0,
    },
});
