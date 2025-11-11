import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';

type Plan = 'annual' | 'monthly';

interface SubscriptionScreenProps {
  onBack: () => void;
  onSubscribe: (plan: Plan) => void;
  onRestore?: () => void;
}

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ onBack, onSubscribe, onRestore }) => {
  const theme = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#14B8A6" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Premium</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Intro Card */}
        <View style={[styles.introCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Unlock Journafied Premium</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Ad-free. Unlimited entries. Cancel anytime.</Text>

          <View style={styles.features}>
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={18} color="#14B8A6" />
              <Text style={[styles.featureText, { color: theme.colors.textPrimary }]}>Ad-Free Experience</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={18} color="#14B8A6" />
              <Text style={[styles.featureText, { color: theme.colors.textPrimary }]}>Unlimited Entries & History</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={18} color="#14B8A6" />
              <Text style={[styles.featureText, { color: theme.colors.textPrimary }]}>Priority Features & Updates</Text>
            </View>
          </View>
        </View>

        {/* Plan Selector */}
        <View style={styles.planGroup}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setSelectedPlan('annual')}
            style={[styles.planOption, { borderColor: selectedPlan === 'annual' ? '#14B8A6' : theme.colors.border, backgroundColor: theme.colors.card }]}
          >
            <View style={styles.planHeaderRow}>
              <View style={[styles.radio, { borderColor: selectedPlan === 'annual' ? '#14B8A6' : theme.colors.border, backgroundColor: selectedPlan === 'annual' ? '#14B8A6' : 'transparent' }]} />
              <Text style={[styles.planTitle, { color: theme.colors.textPrimary }]}>Annual</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Best Value</Text>
              </View>
            </View>
            <Text style={[styles.planPrice, { color: theme.colors.textPrimary }]}>AED7.50/mo</Text>
            <Text style={[styles.planSubText, { color: theme.colors.textSecondary }]}>Billed AED89.99 annually</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setSelectedPlan('monthly')}
            style={[styles.planOption, { borderColor: selectedPlan === 'monthly' ? '#14B8A6' : theme.colors.border, backgroundColor: theme.colors.card }]}
          >
            <View style={styles.planHeaderRow}>
              <View style={[styles.radio, { borderColor: selectedPlan === 'monthly' ? '#14B8A6' : theme.colors.border, backgroundColor: selectedPlan === 'monthly' ? '#14B8A6' : 'transparent' }]} />
              <Text style={[styles.planTitle, { color: theme.colors.textPrimary }]}>Monthly</Text>
            </View>
            <Text style={[styles.planPrice, { color: theme.colors.textPrimary }]}>AED24.99/mo</Text>
            <Text style={[styles.planSubText, { color: theme.colors.textSecondary }]}>Billed monthly</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky bottom actions */}
      <View style={[styles.stickyFooter, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.9} onPress={() => onSubscribe(selectedPlan)}>
          <Text style={styles.ctaText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.restoreButton} onPress={onRestore}>
          <Text style={[styles.restoreText, { color: theme.colors.textSecondary }]}>Restore purchases</Text>
        </TouchableOpacity>
      </View>
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
  content: { paddingHorizontal: 16 },
  introCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 16 },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semiBold },
  subtitle: { marginTop: 4, fontSize: Typography.fontSize.sm },
  features: { gap: 10, marginTop: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: Typography.fontSize.md },
  planGroup: { marginTop: 16, gap: 12 },
  planOption: { borderWidth: 1, borderRadius: 12, padding: 14 },
  planHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semiBold },
  planPrice: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.semiBold, marginTop: 4 },
  planSubText: { fontSize: Typography.fontSize.xs },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  badge: { marginLeft: 'auto', backgroundColor: '#14B8A6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: Colors.white, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semiBold },
  stickyFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, borderTopWidth: 1 },
  ctaButton: { backgroundColor: '#14B8A6', borderRadius: 12, alignItems: 'center', paddingVertical: 14 },
  ctaText: { color: Colors.white, fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.semiBold },
  restoreButton: { alignItems: 'center', marginTop: 10 },
  restoreText: { fontSize: Typography.fontSize.sm },
});
