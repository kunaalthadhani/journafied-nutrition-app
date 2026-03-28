
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { dataStorage, UserMetricsSnapshot, Insight } from '../services/dataStorage';
import { generateGrocerySuggestions, GrocerySuggestionResult, GroceryItem } from '../services/GrocerySuggestionService';
import { groceryCoachService, GroceryCoachExplanation } from '../services/groceryCoachService';

interface GrocerySuggestionsScreenProps {
    onBack: () => void;
    userMetrics?: any;
}

const CATEGORY_ICONS: Record<string, string> = {
    protein: 'target',
    fiber: 'feather',
    carbs: 'zap',
    fats: 'droplet',
    micronutrients: 'sun',
};

const CATEGORY_LABELS: Record<string, string> = {
    protein: 'Protein',
    fiber: 'Fiber & Greens',
    carbs: 'Carbs & Energy',
    fats: 'Healthy Fats',
    micronutrients: 'Vitamins & Minerals',
};

export const GrocerySuggestionsScreen: React.FC<GrocerySuggestionsScreenProps> = ({ onBack }) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [groceryData, setGroceryData] = useState<GrocerySuggestionResult | null>(null);
    const [explanation, setExplanation] = useState<GroceryCoachExplanation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [durationWeeks, setDurationWeeks] = useState(1);
    const [isExporting, setIsExporting] = useState(false);
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const toggleItem = (name: string) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'protein': return '#6366F1';
            case 'fiber': return '#10B981';
            case 'carbs': return '#F59E0B';
            case 'fats': return '#EC4899';
            case 'micronutrients': return '#8B5CF6';
            default: return theme.colors.textSecondary;
        }
    };

    const handleExportPDF = async () => {
        if (!groceryData) return;

        try {
            setIsExporting(true);

            const grouped: Record<string, GroceryItem[]> = {};
            groceryData.items.forEach(item => {
                if (!grouped[item.category]) grouped[item.category] = [];
                grouped[item.category].push(item);
            });
            const priority = ['protein', 'fiber', 'micronutrients', 'fats', 'carbs'];
            const categories = Object.keys(grouped).sort((a, b) => priority.indexOf(a) - priority.indexOf(b));

            const itemsHtml = categories.map(cat => {
                const label = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
                const catItems = grouped[cat].map(item => {
                    const qty = (item.baseQuantity || 1) * durationWeeks;
                    const unit = item.unit || '';

                    return `
                    <tr>
                        <td class="name">${item.name}</td>
                        <td class="qty">${qty} ${unit}</td>
                    </tr>`;
                }).join('');

                return `
                <div class="category">
                    <div class="cat-label">${label}</div>
                    <table>${catItems}</table>
                </div>`;
            }).join('');

            const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
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
</style>
</head>
<body>
    <h1>Grocery List</h1>
    <div class="meta">${durationWeeks} week${durationWeeks > 1 ? 's' : ''} &middot; ${groceryData.items.length} items</div>
    ${itemsHtml}
    <div class="footer">Generated by TrackKcal</div>
</body>
</html>`;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

        } catch (error) {
            console.error('Error exporting PDF:', error);
            Alert.alert('Error', 'Failed to export PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            let snapshot = await dataStorage.getUserMetricsSnapshot();
            if (!snapshot) {
                console.log("No snapshot found, generating fresh...");
                snapshot = await dataStorage.generateUserMetricsSnapshot();
            }

            const insights = await dataStorage.loadInsights();

            if (!snapshot) {
                setError("Insufficient data. Log a few meals first!");
                setLoading(false);
                return;
            }

            const result = generateGrocerySuggestions(snapshot, insights, null);
            setGroceryData(result);

            const context = {
                userGoal: snapshot.userGoals.goalType,
                targetCalories: snapshot.userGoals.calories,
                avgCalories: snapshot.averages7Day.calories,
                consistencyScore: snapshot.consistencyScore,
                weightTrendChange: snapshot.weightTrend.change,
                activeInsightTypes: insights.filter(i => !i.isDismissed).map(i => i.title),
                commonFoods: snapshot.commonFoods.map(f => f.name)
            };

            const aiResponse = await groceryCoachService.getGroceryCoachExplanation(result, context);
            setExplanation(aiResponse);

        } catch (e) {
            console.error("Error loading grocery suggestions", e);
            setError("Failed to load suggestions. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const renderGroupedItems = () => {
        if (!groceryData) return null;

        const grouped: Record<string, GroceryItem[]> = {};
        groceryData.items.forEach(item => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push(item);
        });

        const priority = ['protein', 'fiber', 'micronutrients', 'fats', 'carbs'];
        const categories = Object.keys(grouped).sort((a, b) => priority.indexOf(a) - priority.indexOf(b));

        return categories.map(category => {
            const color = getCategoryColor(category);
            const icon = CATEGORY_ICONS[category] || 'box';
            const label = CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
            const items = grouped[category];

            return (
                <View key={category} style={{ marginBottom: 24 }}>
                    {/* Category Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name={icon as any} size={16} color={color} />
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, marginLeft: 10, flex: 1 }}>{label}</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textTertiary }}>{items.length} items</Text>
                    </View>

                    {/* Items */}
                    <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}>
                        {items.map((item, index) => {
                            const m = item.macros || { p: 0, c: 0, f: 0, kcal: 0 };
                            const qty = (item.baseQuantity || 1) * durationWeeks;
                            const kcal = Math.round(m.kcal * durationWeeks);
                            const isChecked = checkedItems.has(item.name);
                            const reasonText = explanation?.itemExplanations[item.name];

                            return (
                                <TouchableOpacity
                                    key={index}
                                    activeOpacity={0.6}
                                    onPress={() => toggleItem(item.name)}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        padding: 14,
                                        paddingLeft: 16,
                                        borderBottomWidth: index < items.length - 1 ? 1 : 0,
                                        borderBottomColor: theme.colors.border,
                                    }}
                                >
                                    {/* Checkbox */}
                                    <View style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 7,
                                        borderWidth: 2,
                                        borderColor: isChecked ? '#10B981' : theme.colors.border,
                                        backgroundColor: isChecked ? '#10B981' : 'transparent',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 12,
                                        marginTop: 1,
                                    }}>
                                        {isChecked && <Feather name="check" size={13} color="#fff" />}
                                    </View>

                                    {/* Content */}
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                            <Text style={{
                                                fontSize: 15,
                                                fontWeight: '600',
                                                color: isChecked ? theme.colors.textTertiary : theme.colors.textPrimary,
                                                textDecorationLine: isChecked ? 'line-through' : 'none',
                                                flex: 1,
                                            }}>
                                                {item.name}
                                                {item.reason === 'user_favorite' && ' \u2605'}
                                            </Text>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginLeft: 8 }}>
                                                {qty} {item.unit || ''}
                                            </Text>
                                        </View>

                                        {/* Macro pills */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                                            <View style={{ backgroundColor: color + '12', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '600', color }}>{kcal} kcal</Text>
                                            </View>
                                            <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                                                P {Math.round(m.p * durationWeeks)}g · C {Math.round(m.c * durationWeeks)}g · F {Math.round(m.f * durationWeeks)}g
                                            </Text>
                                        </View>

                                        {reasonText && (
                                            <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginTop: 5, lineHeight: 17 }}>
                                                {reasonText}
                                            </Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            );
        });
    };

    const renderSummary = () => {
        if (!groceryData?.summary) return null;
        const s = groceryData.summary;
        const totalK = Math.round(s.weeklyTotal.kcal * durationWeeks);
        const loss = (s.projectedWeightLossKg * durationWeeks).toFixed(1);
        const p = Math.round(s.weeklyTotal.p * durationWeeks);
        const c = Math.round(s.weeklyTotal.c * durationWeeks);
        const f = Math.round(s.weeklyTotal.f * durationWeeks);

        return (
            <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, padding: 20, marginBottom: 24 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 20 }}>Plan Impact</Text>

                {/* Big stats */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 32, fontWeight: '800', color: '#6366F1' }}>{totalK}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>Total kcal</Text>
                    </View>
                    <View style={{ width: 1, height: 44, backgroundColor: theme.colors.border }} />
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 32, fontWeight: '800', color: Number(loss) > 0 ? '#10B981' : '#F59E0B' }}>
                            {Number(loss) > 0 ? '-' : ''}{Math.abs(Number(loss))}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>kg expected</Text>
                    </View>
                </View>

                {/* Macro pills */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                    <View style={{ backgroundColor: '#6366F115', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366F1' }}>Protein {p}g</Text>
                    </View>
                    <View style={{ backgroundColor: '#F59E0B15', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#F59E0B' }}>Carbs {c}g</Text>
                    </View>
                    <View style={{ backgroundColor: '#EC489915', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#EC4899' }}>Fat {f}g</Text>
                    </View>
                </View>

                {s.replacedJunkCalories > 200 && (
                    <View style={{ marginTop: 16, backgroundColor: '#10B98110', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '500', color: '#10B981', textAlign: 'center', lineHeight: 18 }}>
                            Swapped ~{Math.round(s.replacedJunkCalories * durationWeeks)} kcal of processed food for whole food alternatives
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Feather name="chevron-down" size={24} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Grocery List</Text>
                    <View style={{ width: 40 }} />
                </View>
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
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Feather name="chevron-down" size={24} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Grocery List</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.center}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.error + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Feather name="alert-circle" size={28} color={theme.colors.error} />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 6 }}>Something went wrong</Text>
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>{error}</Text>
                    <TouchableOpacity style={{ backgroundColor: '#6366F1', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 }} onPress={loadData}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const checkedCount = checkedItems.size;
    const totalItems = groceryData?.items.length || 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Feather name="chevron-down" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Grocery List</Text>
                    {checkedCount > 0 && (
                        <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 }}>
                            {checkedCount}/{totalItems} items checked
                        </Text>
                    )}
                </View>
                <TouchableOpacity onPress={handleExportPDF} disabled={isExporting} style={{ width: 40, alignItems: 'center' }}>
                    {isExporting ? (
                        <ActivityIndicator size="small" color="#6366F1" />
                    ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#6366F110', alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="share" size={18} color="#6366F1" />
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {/* Duration Toggle */}
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: theme.colors.card,
                    borderRadius: 14,
                    padding: 4,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                }}>
                    {[1, 2].map(w => (
                        <TouchableOpacity
                            key={w}
                            onPress={() => setDurationWeeks(w)}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                alignItems: 'center',
                                borderRadius: 11,
                                backgroundColor: durationWeeks === w ? theme.colors.textPrimary : 'transparent',
                            }}
                        >
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '700',
                                color: durationWeeks === w ? theme.colors.background : theme.colors.textTertiary,
                            }}>
                                {w} Week{w > 1 ? 's' : ''}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* AI Coach Insight */}
                {explanation && (
                    <View style={{
                        backgroundColor: '#6366F108',
                        borderLeftWidth: 3,
                        borderLeftColor: '#6366F1',
                        borderRadius: 0,
                        borderTopRightRadius: 14,
                        borderBottomRightRadius: 14,
                        padding: 16,
                        marginBottom: 24,
                    }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>AI Insight</Text>
                        <Text style={{ fontSize: 14, color: theme.colors.textPrimary, lineHeight: 21 }}>
                            {explanation.summary}
                        </Text>
                    </View>
                )}

                {!explanation && groceryData && (
                    <View style={{
                        backgroundColor: theme.colors.card,
                        borderRadius: 14,
                        padding: 16,
                        marginBottom: 24,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                    }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#6366F1' }}>{groceryData.primaryFocus}</Text>
                    </View>
                )}

                {/* Grocery Items */}
                {renderGroupedItems()}

                {/* Summary */}
                {renderSummary()}

                {/* Disclaimer */}
                <Text style={{ textAlign: 'center', fontSize: 11, color: theme.colors.textTertiary, marginTop: 8, lineHeight: 16 }}>
                    Suggestions are based on your nutrition data and are for informational purposes only.
                </Text>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        width: 40,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
});
