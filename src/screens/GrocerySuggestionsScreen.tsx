
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
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
    userMetrics?: any; // Just for types, unused
}

export const GrocerySuggestionsScreen: React.FC<GrocerySuggestionsScreenProps> = ({ onBack }) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [groceryData, setGroceryData] = useState<GrocerySuggestionResult | null>(null);
    const [explanation, setExplanation] = useState<GroceryCoachExplanation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [durationWeeks, setDurationWeeks] = useState(1);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const handleExportPDF = async () => {
        if (!groceryData) return;

        try {
            setIsExporting(true);

            // Group items and generate HTML
            const grouped: Record<string, GroceryItem[]> = {};
            groceryData.items.forEach(item => {
                if (!grouped[item.category]) grouped[item.category] = [];
                grouped[item.category].push(item);
            });
            const priority = ['protein', 'fiber', 'micronutrients', 'fats', 'carbs'];
            const categories = Object.keys(grouped).sort((a, b) => priority.indexOf(a) - priority.indexOf(b));

            const itemsHtml = categories.map(cat => {
                const catItems = grouped[cat].map(item => {
                    const qty = (item.baseQuantity || 1) * durationWeeks;
                    const unit = item.unit || '';
                    const m = item.macros || { p: 0, c: 0, f: 0, kcal: 0 };
                    const p = Math.round(m.p * durationWeeks);
                    const c = Math.round(m.c * durationWeeks);
                    const f = Math.round(m.f * durationWeeks);

                    return `
                    <div class="item-row">
                        <div class="item-main">
                            <span class="item-name">${item.name}</span>
                            <span class="item-qty">${qty} ${unit}</span>
                        </div>
                        <div class="item-meta">
                            <span class="item-macros">P:${p} F:${f} C:${c}</span>
                        </div>
                        <div class="item-reason">
                            ${explanation?.itemExplanations[item.name] || item.reason.replace('_', ' ')}
                        </div>
                    </div>
                    `;
                }).join('');

                const catColor = getCategoryColor(cat, theme);
                return `
                    <div class="category-section">
                        <div class="category-header">
                            <span class="category-dot" style="background-color: ${catColor}"></span>
                            <span class="category-title" style="color: ${theme.colors.textPrimary}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                        </div>
                        <div class="card">
                            ${catItems}
                        </div>
                    </div>
                `;
            }).join('');

            // Summary HTML
            const sum = groceryData.summary;
            let summaryHtml = '';
            if (sum) {
                const totalK = Math.round(sum.weeklyTotal.kcal * durationWeeks);
                const loss = (sum.projectedWeightLossKg * durationWeeks).toFixed(2);

                summaryHtml = `
                    <div class="summary-card card">
                        <div class="summary-header">Weekly Plan Impact</div>
                        <div class="summary-grid">
                            <div class="stat-box">
                                <div class="stat-label">Total Calories</div>
                                <div class="stat-value" style="color: ${theme.colors.primary}">${totalK}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">Proj. Weight Change</div>
                                <div class="stat-value" style="color: ${Number(loss) >= 0 ? '#22c55e' : '#eab308'}">
                                    ${Number(loss) > 0 ? '-' : ''}${Math.abs(Number(loss))} kg
                                </div>
                            </div>
                        </div>
                        <div class="macro-row">
                            <span>Protein: ${Math.round(sum.weeklyTotal.p * durationWeeks)}g</span>
                            <span>Carbs: ${Math.round(sum.weeklyTotal.c * durationWeeks)}g</span>
                            <span>Fats: ${Math.round(sum.weeklyTotal.f * durationWeeks)}g</span>
                        </div>
                        ${sum.replacedJunkCalories > 200 ? `
                        <div class="alert-box">
                            <strong>Note:</strong> Replaced approx ${Math.round(sum.replacedJunkCalories * durationWeeks)} kcal of processed food with healthy staples.
                        </div>` : ''}
                    </div>
                `;
            }

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; color: ${theme.colors.textPrimary}; background: #fff; max-width: 800px; margin: 0 auto; }
                        h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px 0; }
                        .header { margin-bottom: 30px; border-bottom: 1px solid ${theme.colors.border}; padding-bottom: 20px; }
                        .subtitle { font-size: 14px; color: ${theme.colors.textSecondary}; }
                        .card { background: #fff; border: 1px solid ${theme.colors.border}; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
                        .coach-card { background: ${theme.colors.card}; border: 1px solid ${theme.colors.primary}40; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
                        .coach-title { font-weight: 600; color: ${theme.colors.primary}; margin-bottom: 8px; font-size: 14px; }
                        .coach-text { font-size: 14px; line-height: 1.5; }
                        .category-section { margin-bottom: 24px; }
                        .category-header { display: flex; align-items: center; margin-bottom: 12px; }
                        .category-dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
                        .category-title { font-weight: 600; font-size: 15px; }
                        .item-row { padding: 12px 16px; border-bottom: 1px solid ${theme.colors.border}; }
                        .item-row:last-child { border-bottom: none; }
                        .item-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
                        .item-name { font-weight: 600; font-size: 15px; }
                        .item-qty { font-size: 14px; color: ${theme.colors.textSecondary}; }
                        .item-meta { margin-bottom: 6px; }
                        .item-macros { font-size: 11px; color: ${theme.colors.textSecondary}; font-family: monospace; background: ${theme.colors.background}; padding: 2px 6px; border-radius: 4px; }
                        .item-reason { font-size: 13px; color: ${theme.colors.textTertiary}; font-style: italic; }
                        .summary-card { padding: 20px; background: ${theme.colors.card}; }
                        .summary-header { font-weight: 600; margin-bottom: 16px; font-size: 16px; }
                        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
                        .stat-label { font-size: 12px; color: ${theme.colors.textSecondary}; margin-bottom: 4px; }
                        .stat-value { font-size: 20px; font-weight: 700; }
                        .macro-row { display: flex; justify-content: space-between; padding-top: 16px; border-top: 1px solid ${theme.colors.border}; font-size: 13px; }
                        .alert-box { margin-top: 16px; padding: 12px; background: #fef2f2; color: #ef4444; font-size: 12px; border-radius: 8px; }
                        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: ${theme.colors.textTertiary}; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1 style="color: ${theme.colors.textPrimary}">Grocery Plan</h1>
                        <div class="subtitle">Focus: ${groceryData.primaryFocus} • Duration: ${durationWeeks} Week${durationWeeks > 1 ? 's' : ''}</div>
                    </div>
                    
                    ${explanation?.generalAdvice ? `
                    <div class="coach-card">
                        <div class="coach-title">Coach Insight</div>
                        <div class="coach-text">${explanation.generalAdvice}</div>
                    </div>` : ''}
                    
                    <div class="list">
                        ${itemsHtml}
                    </div>
                    
                    ${summaryHtml}

                    <div class="footer">
                        Generated by TrackKcal App
                    </div>
                </body>
                </html>
            `;

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

            // 1. Gather Dependencies
            let snapshot = await dataStorage.getUserMetricsSnapshot();

            // Fallback: Generate snapshot if it doesn't exist yet (e.g. new user or first run)
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

            // 2. Generate Deterministic List
            const result = generateGrocerySuggestions(snapshot, insights, null);
            setGroceryData(result);

            // 3. Generate AI Explanation
            // Prepare context
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

        // Group by category
        const grouped: Record<string, GroceryItem[]> = {};
        groceryData.items.forEach(item => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push(item);
        });

        // Sort categories by priority
        const priority = ['protein', 'fiber', 'micronutrients', 'fats', 'carbs'];
        const categories = Object.keys(grouped).sort((a, b) => {
            return priority.indexOf(a) - priority.indexOf(b);
        });

        return categories.map(category => (
            <View key={category} style={styles.sectionContainer}>
                <View style={styles.categoryHeaderRow}>
                    <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(category, theme) }]} />
                    <Text style={[styles.categoryTitle, { color: theme.colors.textPrimary }]}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Text>
                </View>

                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {grouped[category].map((item, index) => {
                        // Display Macros
                        const m = item.macros || { p: 0, c: 0, f: 0 };
                        const p = Math.round(m.p * durationWeeks);
                        const c = Math.round(m.c * durationWeeks);
                        const f = Math.round(m.f * durationWeeks);

                        return (
                            <View key={index} style={[
                                styles.itemRow,
                                index < grouped[category].length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: 1 }
                            ]}>
                                <View style={styles.itemHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Text style={[styles.itemName, { color: theme.colors.textPrimary }]}>{item.name}</Text>
                                        {item.reason === 'user_favorite' && (
                                            <Feather name="star" size={12} color={theme.colors.warning} style={{ marginLeft: 6 }} />
                                        )}
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[styles.quantityText, { color: theme.colors.textSecondary }]}>
                                            {(item.baseQuantity || 1) * durationWeeks} {item.unit || ''}
                                        </Text>
                                        <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontFamily: Typography.fontFamily.medium }}>
                                            P:{p} F:{f} C:{c}
                                        </Text>
                                    </View>
                                </View>
                                {explanation?.itemExplanations[item.name] && (
                                    <Text style={[styles.aiReason, { color: theme.colors.textSecondary }]}>
                                        "{explanation.itemExplanations[item.name]}"
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>
        ));
    };

    const renderSummaryFooter = () => {
        if (!groceryData?.summary) return null;
        const s = groceryData.summary;
        const totalK = Math.round(s.weeklyTotal.kcal * durationWeeks);
        const loss = (s.projectedWeightLossKg * durationWeeks).toFixed(2);

        return (
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 20, marginBottom: 40 }]}>
                <View style={{ padding: 16 }}>
                    <Text style={[styles.categoryTitle, { color: theme.colors.textPrimary, marginBottom: 12 }]}>Weekly Plan Impact</Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Total Calories</Text>
                            <Text style={{ fontSize: 18, color: theme.colors.primary, fontWeight: 'bold' }}>{totalK}</Text>
                        </View>
                        <View>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Exp. Weight Change</Text>
                            <Text style={{ fontSize: 18, color: Number(loss) > 0 ? theme.colors.success : theme.colors.warning, fontWeight: 'bold' }}>
                                {Number(loss) > 0 ? '-' : ''}{Math.abs(Number(loss))} kg
                            </Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                        <Text style={{ fontSize: 12, color: theme.colors.textPrimary }}>Protein: {Math.round(s.weeklyTotal.p * durationWeeks)}g</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textPrimary }}>Carbs: {Math.round(s.weeklyTotal.c * durationWeeks)}g</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.textPrimary }}>Fats: {Math.round(s.weeklyTotal.f * durationWeeks)}g</Text>
                    </View>

                    {s.replacedJunkCalories > 200 && (
                        <View style={{ marginTop: 12, padding: 8, backgroundColor: theme.colors.error + '20', borderRadius: 6 }}>
                            <Text style={{ fontSize: 11, color: theme.colors.error }}>
                                <Feather name="alert-circle" size={10} /> Replaced {Math.round(s.replacedJunkCalories * durationWeeks)}kcal of processed food with healthy staples.
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const getCategoryColor = (cat: string, theme: any) => {
        switch (cat) {
            case 'protein': return theme.colors.primary;
            case 'fiber': return theme.colors.success;
            case 'carbs': return theme.colors.warning;
            case 'fats': return '#EAB308';
            default: return theme.colors.textSecondary;
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Grocery Suggestions</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Analyzing your nutrition...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Grocery Suggestions</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.center}>
                    <Feather name="alert-circle" size={48} color={theme.colors.error} />
                    <Text style={[styles.errorText, { color: theme.colors.textPrimary }]}>{error}</Text>
                    <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={loadData}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Grocery Suggestions</Text>
                <View style={{ width: 40 }}>
                    <TouchableOpacity onPress={handleExportPDF} disabled={isExporting}>
                        {isExporting ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                            <Feather name="upload" size={24} color={theme.colors.primary} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>

                {/* Duration Selector */}
                <View style={styles.durationSelector}>
                    <TouchableOpacity
                        style={[styles.durationOption, durationWeeks === 1 && { backgroundColor: theme.colors.primary }]}
                        onPress={() => setDurationWeeks(1)}
                    >
                        <Text style={[styles.durationText, durationWeeks === 1 && { color: 'white' }]}>1 Week</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.durationOption, durationWeeks === 2 && { backgroundColor: theme.colors.primary }]}
                        onPress={() => setDurationWeeks(2)}
                    >
                        <Text style={[styles.durationText, durationWeeks === 2 && { color: 'white' }]}>2 Weeks</Text>
                    </TouchableOpacity>
                </View>

                {/* AI Insight Header */}
                {explanation && (
                    <View style={[styles.insightCard, { backgroundColor: theme.colors.primary + '10' }]}>
                        <View style={styles.insightHeaderRow}>
                            <Feather name="zap" size={16} color={theme.colors.primary} />
                            <Text style={[styles.insightTitle, { color: theme.colors.primary }]}>{explanation.title}</Text>
                        </View>
                        <Text style={[styles.insightSummary, { color: theme.colors.textPrimary }]}>
                            {explanation.summary}
                        </Text>
                    </View>
                )}

                {/* Primary Focus Banner (Deterministic fallback if AI fails, or supplementary) */}
                {!explanation && groceryData && (
                    <View style={[styles.insightCard, { backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.insightTitle, { color: theme.colors.primary }]}>{groceryData.primaryFocus}</Text>
                    </View>
                )}

                {/* List */}
                {renderGroupedItems()}

                {/* Summary Footer */}
                {renderSummaryFooter()}

                {/* Disclaimer */}
                <Text style={[styles.disclaimer, { color: theme.colors.textTertiary }]}>
                    These suggestions are generated based on your nutrition data and are for informational purposes only.
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
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: Typography.fontWeight.semiBold,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    loadingText: {
        marginTop: 12,
        fontSize: Typography.fontSize.md,
    },
    errorText: {
        marginTop: 12,
        fontSize: Typography.fontSize.md,
        textAlign: 'center',
        marginBottom: 20
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8
    },
    retryText: {
        color: '#fff',
        fontWeight: '600'
    },
    insightCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    insightHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    insightTitle: {
        fontSize: Typography.fontSize.md,
        fontWeight: Typography.fontWeight.bold,
    },
    insightSummary: {
        fontSize: Typography.fontSize.md,
        lineHeight: 22
    },
    sectionContainer: {
        marginBottom: 20
    },
    categoryHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8
    },
    categoryDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    categoryTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: Typography.fontWeight.semiBold,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden'
    },
    itemRow: {
        padding: 12,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4
    },
    itemName: {
        fontSize: Typography.fontSize.md,
        fontWeight: Typography.fontWeight.medium
    },
    aiReason: {
        fontSize: Typography.fontSize.xs,
        fontStyle: 'italic',
        lineHeight: 18
    },
    disclaimer: {
        textAlign: 'center',
        fontSize: Typography.fontSize.xs,
        marginTop: 20,
        fontStyle: 'italic'
    },
    durationSelector: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 4,
        marginBottom: 20,
        alignSelf: 'center'
    },
    durationOption: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 6,
        minWidth: 80,
        alignItems: 'center'
    },
    durationText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666'
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '500'
    }
});
