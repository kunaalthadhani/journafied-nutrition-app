import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../constants/theme';
import { dataStorage } from '../services/dataStorage';
import {
    generateGrocerySuggestions,
    generateStarterGrocerySuggestions,
    GrocerySuggestionResult,
    GroceryItem,
    CATEGORY_PRIORITY,
} from '../services/GrocerySuggestionService';
import { groceryCoachService, GroceryCoachExplanation } from '../services/groceryCoachService';

interface GrocerySuggestionsScreenProps {
    onBack: () => void;
    userMetrics?: any;
}

const CHECKED_KEY = '@trackkal:groceryChecked';

const CATEGORY_ICONS: Record<string, string> = {
    protein: 'target', fiber: 'feather', carbs: 'zap', fats: 'droplet', micronutrients: 'sun',
};
const CATEGORY_LABELS: Record<string, string> = {
    protein: 'Protein', fiber: 'Fiber & Greens', carbs: 'Carbs & Energy', fats: 'Healthy Fats', micronutrients: 'Vitamins & Minerals',
};
const CATEGORY_COLORS: Record<string, string> = {
    protein: '#6366F1', fiber: '#10B981', carbs: '#F59E0B', fats: '#EC4899', micronutrients: '#8B5CF6',
};

// Group the items and return category keys in the one canonical order.
const groupByCategory = (items: GroceryItem[]): [string, GroceryItem[]][] => {
    const grouped: Record<string, GroceryItem[]> = {};
    items.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });
    return Object.keys(grouped)
        .sort((a, b) => (CATEGORY_PRIORITY[a as GroceryItem['category']] ?? 99) - (CATEGORY_PRIORITY[b as GroceryItem['category']] ?? 99))
        .map(cat => [cat, grouped[cat]]);
};

export const GrocerySuggestionsScreen: React.FC<GrocerySuggestionsScreenProps> = ({ onBack }) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [groceryData, setGroceryData] = useState<GrocerySuggestionResult | null>(null);
    const [explanation, setExplanation] = useState<GroceryCoachExplanation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isEmpty, setIsEmpty] = useState(false);
    const [usingStarter, setUsingStarter] = useState(false);
    const [durationWeeks, setDurationWeeks] = useState(1);
    const [isExporting, setIsExporting] = useState(false);
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(CHECKED_KEY);
                if (raw) setCheckedItems(new Set(JSON.parse(raw)));
            } catch { /* ignore */ }
            loadData();
        })();
    }, []);

    // Normalized lookup so a small wording difference from the AI does not
    // silently drop a food's reason line.
    const explanationFor = (name: string): string | undefined => {
        if (!explanation) return undefined;
        const want = name.toLowerCase().trim();
        for (const key in explanation.itemExplanations) {
            if (key.toLowerCase().trim() === want) return explanation.itemExplanations[key];
        }
        return undefined;
    };

    const toggleChecked = (name: string) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            AsyncStorage.setItem(CHECKED_KEY, JSON.stringify([...next])).catch(() => {});
            return next;
        });
    };

    const toggleExpanded = (name: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            setIsEmpty(false);
            setUsingStarter(false);
            setExplanation(null);

            let snapshot = await dataStorage.getUserMetricsSnapshot();
            if (!snapshot) snapshot = await dataStorage.generateUserMetricsSnapshot();
            if (!snapshot) {
                setError("Log a few meals first and we'll build your list.");
                return;
            }

            const insights = await dataStorage.loadInsights();
            const result = generateGrocerySuggestions(snapshot, insights, null);

            if (result.items.length === 0) {
                // Unlocked, but nothing matched (e.g. only processed foods logged).
                setGroceryData(null);
                setIsEmpty(true);
                return;
            }

            setGroceryData(result);

            const context = {
                userGoal: snapshot.userGoals.goalType,
                targetCalories: snapshot.userGoals.calories,
                avgCalories: snapshot.averages7Day.calories,
                consistencyScore: snapshot.consistencyScore,
                weightTrendChange: snapshot.weightTrend.change,
                activeInsightTypes: insights.filter(i => !i.isDismissed).map(i => i.title),
                commonFoods: snapshot.commonFoods.map(f => f.name),
            };
            const aiResponse = await groceryCoachService.getGroceryCoachExplanation(result, context);
            setExplanation(aiResponse);
        } catch (e) {
            console.error('Error loading grocery suggestions', e);
            setError('Could not build your list. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const showStarterList = () => {
        try {
            const starter = generateStarterGrocerySuggestions();
            setExplanation(null);
            setGroceryData(starter);
            setIsEmpty(false);
            setUsingStarter(true);
        } catch (e) {
            console.error('starter list failed', e);
        }
    };

    const handleExportPDF = async () => {
        if (!groceryData) return;
        try {
            setIsExporting(true);
            const categories = groupByCategory(groceryData.items);

            const itemsHtml = categories.map(([cat, catItems]) => {
                const label = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
                const rows = catItems.map(item => {
                    const qty = (item.baseQuantity || 1) * durationWeeks;
                    return `<tr><td class="name">${item.name}</td><td class="qty">${qty} ${item.unit || ''}</td></tr>`;
                }).join('');
                return `<div class="category"><div class="cat-label">${label}</div><table>${rows}</table></div>`;
            }).join('');

            const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', sans-serif; padding: 40px; color: #000; background: #fff; max-width: 600px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 32px; }
    .category { margin-bottom: 24px; }
    .cat-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #000; }
    table { width: 100%; border-collapse: collapse; }
    tr { border-bottom: 1px solid #eee; }
    tr:last-child { border-bottom: none; }
    td { padding: 10px 0; vertical-align: middle; }
    .name { font-size: 14px; font-weight: 500; }
    .qty { text-align: right; font-size: 13px; font-weight: 600; color: #555; }
    .footer { text-align: center; font-size: 9px; color: #ccc; margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; }
</style></head>
<body>
    <h1>Grocery List</h1>
    <div class="meta">${durationWeeks} week${durationWeeks > 1 ? 's' : ''} &middot; ${groceryData.items.length} items</div>
    ${itemsHtml}
    <div class="footer">Generated by TrackKcal</div>
</body></html>`;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (e) {
            console.error('Error exporting PDF:', e);
            Alert.alert('Error', 'Failed to export PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const renderHeader = (subtitle?: string) => (
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Feather name="chevron-down" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
                <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Grocery List</Text>
                {!!subtitle && (
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 }}>{subtitle}</Text>
                )}
            </View>
            {groceryData ? (
                <TouchableOpacity onPress={handleExportPDF} disabled={isExporting} style={{ width: 40, alignItems: 'center' }}>
                    {isExporting ? (
                        <ActivityIndicator size="small" color="#6366F1" />
                    ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#6366F110', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="share" size={18} color="#6366F1" />
                        </View>
                    )}
                </TouchableOpacity>
            ) : (
                <View style={{ width: 40 }} />
            )}
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                {renderHeader()}
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={{ color: theme.colors.textSecondary, marginTop: 16, fontSize: 15 }}>Building your list...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                {renderHeader()}
                <View style={styles.center}>
                    <View style={[styles.bigIcon, { backgroundColor: theme.colors.error + '15' }]}>
                        <Feather name="alert-circle" size={28} color={theme.colors.error} />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 6 }}>Something went wrong</Text>
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>{error}</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={loadData}>
                        <Text style={styles.primaryBtnText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (isEmpty) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                {renderHeader()}
                <View style={styles.center}>
                    <View style={[styles.bigIcon, { backgroundColor: '#6366F115' }]}>
                        <Feather name="shopping-cart" size={28} color="#6366F1" />
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>No list to build yet</Text>
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 28, paddingHorizontal: 8 }}>
                        Your list is built from the whole foods you log. We could not find enough to work with yet. Log a few staples like chicken, rice, or veg, or start from a healthy template below.
                    </Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={showStarterList}>
                        <Text style={styles.primaryBtnText}>See healthy staples</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const items = groceryData?.items ?? [];
    const totalItems = items.length;
    const checkedCount = items.filter(i => checkedItems.has(i.name)).length;
    const progress = totalItems > 0 ? checkedCount / totalItems : 0;
    const categories = groupByCategory(items);

    const focusText = explanation?.summary || groceryData?.primaryFocus || '';
    const s = groceryData?.summary;
    const totalK = s ? Math.round(s.weeklyTotal.kcal * durationWeeks) : 0;
    const totP = s ? Math.round(s.weeklyTotal.p * durationWeeks) : 0;
    const totC = s ? Math.round(s.weeklyTotal.c * durationWeeks) : 0;
    const totF = s ? Math.round(s.weeklyTotal.f * durationWeeks) : 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {renderHeader(`${checkedCount} of ${totalItems} checked`)}

            {/* Progress bar */}
            <View style={{ height: 3, backgroundColor: theme.colors.border }}>
                <View style={{ height: 3, width: `${Math.round(progress * 100)}%`, backgroundColor: '#10B981' }} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {usingStarter && (
                    <View style={{ backgroundColor: '#F59E0B12', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Feather name="info" size={14} color="#F59E0B" />
                        <Text style={{ flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 }}>
                            A starter template. Log your own meals and your list will personalize to what you actually eat.
                        </Text>
                    </View>
                )}

                {/* Quiet nutrition layer: the "why" in one compact card */}
                {!!focusText && (
                    <View style={{ backgroundColor: '#6366F108', borderLeftWidth: 3, borderLeftColor: '#6366F1', borderTopRightRadius: 12, borderBottomRightRadius: 12, padding: 14, marginBottom: 20 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
                            {explanation ? 'Why this list' : 'Focus'}
                        </Text>
                        <Text style={{ fontSize: 14, color: theme.colors.textPrimary, lineHeight: 20 }}>{focusText}</Text>
                    </View>
                )}

                {/* Duration toggle */}
                <View style={{ flexDirection: 'row', backgroundColor: theme.colors.card, borderRadius: 14, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border }}>
                    {[1, 2].map(w => (
                        <TouchableOpacity key={w} onPress={() => setDurationWeeks(w)} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11, backgroundColor: durationWeeks === w ? theme.colors.textPrimary : 'transparent' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: durationWeeks === w ? theme.colors.background : theme.colors.textTertiary }}>
                                {w} Week{w > 1 ? 's' : ''}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* The list */}
                {categories.map(([category, catItems]) => {
                    const color = CATEGORY_COLORS[category] || theme.colors.textSecondary;
                    const icon = CATEGORY_ICONS[category] || 'box';
                    const label = CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
                    return (
                        <View key={category} style={{ marginBottom: 22 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
                                    <Feather name={icon as any} size={14} color={color} />
                                </View>
                                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginLeft: 10, flex: 1 }}>{label}</Text>
                                <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>{catItems.length}</Text>
                            </View>

                            <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}>
                                {catItems.map((item, index) => {
                                    const m = item.macros || { p: 0, c: 0, f: 0, kcal: 0 };
                                    const qty = (item.baseQuantity || 1) * durationWeeks;
                                    const kcal = Math.round(m.kcal * durationWeeks);
                                    const isChecked = checkedItems.has(item.name);
                                    const isExpanded = expandedItems.has(item.name);
                                    const reason = explanationFor(item.name);

                                    return (
                                        <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: index < catItems.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                                            {/* Checkbox (its own tap target) */}
                                            <TouchableOpacity onPress={() => toggleChecked(item.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }} style={{ marginRight: 12, marginTop: 1 }}>
                                                <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: isChecked ? '#10B981' : theme.colors.border, backgroundColor: isChecked ? '#10B981' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                                    {isChecked && <Feather name="check" size={13} color="#fff" />}
                                                </View>
                                            </TouchableOpacity>

                                            {/* Body (tap to expand details) */}
                                            <TouchableOpacity activeOpacity={0.6} onPress={() => toggleExpanded(item.name)} style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text style={{ fontSize: 15, fontWeight: '600', color: isChecked ? theme.colors.textTertiary : theme.colors.textPrimary, textDecorationLine: isChecked ? 'line-through' : 'none', flex: 1 }}>
                                                        {item.name}{item.reason === 'user_favorite' && ' ★'}
                                                    </Text>
                                                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, marginLeft: 8 }}>{qty} {item.unit || ''}</Text>
                                                    <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={theme.colors.textTertiary} style={{ marginLeft: 8 }} />
                                                </View>

                                                {isExpanded && (
                                                    <View style={{ marginTop: 8 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <View style={{ backgroundColor: color + '12', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                                                <Text style={{ fontSize: 11, fontWeight: '600', color }}>{kcal} kcal</Text>
                                                            </View>
                                                            <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                                                                P {Math.round(m.p * durationWeeks)}g · C {Math.round(m.c * durationWeeks)}g · F {Math.round(m.f * durationWeeks)}g
                                                            </Text>
                                                        </View>
                                                        {!!reason && (
                                                            <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginTop: 6, lineHeight: 17 }}>{reason}</Text>
                                                        )}
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })}

                {/* Honest footer summary: calories + macros, no weight projection */}
                {s && (
                    <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, padding: 20, marginTop: 4, marginBottom: 16 }}>
                        <Text style={{ fontSize: 12, color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>
                            Your list · {durationWeeks} week{durationWeeks > 1 ? 's' : ''}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 14 }}>
                            <Text style={{ fontSize: 30, fontWeight: '800', color: theme.colors.textPrimary }}>{totalK.toLocaleString()}</Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, marginLeft: 6 }}>kcal of whole foods</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ backgroundColor: '#6366F115', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366F1' }}>Protein {totP}g</Text>
                            </View>
                            <View style={{ backgroundColor: '#F59E0B15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#F59E0B' }}>Carbs {totC}g</Text>
                            </View>
                            <View style={{ backgroundColor: '#EC489915', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#EC4899' }}>Fat {totF}g</Text>
                            </View>
                        </View>
                    </View>
                )}

                <Text style={{ textAlign: 'center', fontSize: 11, color: theme.colors.textTertiary, marginTop: 8, lineHeight: 16 }}>
                    Suggestions are based on your nutrition data and are for informational purposes only.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
    backButton: { padding: 8, width: 40 },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    bigIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    primaryBtn: { backgroundColor: '#6366F1', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
    primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
