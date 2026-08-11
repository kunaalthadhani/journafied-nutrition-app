import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import {
  BillingCycle,
  PRICES,
  ANNUAL_SAVING_PERCENT,
  formatPrice,
  priceOf,
  secondAppDelta,
} from '../config/pricing';

interface SubscriptionScreenProps {
  onBack: () => void;
  onRestore?: () => void;
}

const KCAL_FEATURES = [
  'Log a meal by typing, by photo, or by voice',
  'The calorie bank, one weekly budget instead of seven daily ones',
  'Insights and pattern detection over your own logs',
  'The weekly action plan',
  'Every device in step, your food history follows the account',
];

const PLUS_FEATURES = [
  'Everything in TrackLifts',
  'An AI training coach that writes each week from what you actually lifted',
  'Race prep programs',
  'One account, one body: weigh in anywhere and both apps already know',
];

// Purchases arrive with the store release. Until then this screen sells the
// plan and says so plainly rather than pretending to take money.
const STORE_NOTE = 'Buying arrives with the app store release. Everything premium is free until then.';

const FeatureRow = ({ text }: { text: string }) => (
  <View style={st.featureRow}>
    <Feather name="check" size={14} color={Acid.tx3} style={{ marginTop: 3 }} />
    <Text style={st.featureText}>{text}</Text>
  </View>
);

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ onBack, onRestore }) => {
  const [cycle, setCycle] = useState<BillingCycle>('annual');

  const per = cycle === 'annual' ? 'a year' : 'a month';
  const showStoreNote = () => Alert.alert('Not yet', STORE_NOTE);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={Acid.tx2} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Track Plus</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={st.content} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text style={st.hero}>Your food knows your training. Your training knows your food.</Text>

        {/* Billing toggle */}
        <View style={st.toggleRow}>
          <TouchableOpacity onPress={() => setCycle('monthly')} style={st.toggleItem} activeOpacity={0.7}>
            <Text style={[st.toggleText, cycle === 'monthly' && st.toggleTextOn]}>MONTHLY</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCycle('annual')} style={st.toggleItem} activeOpacity={0.7}>
            <Text style={[st.toggleText, cycle === 'annual' && st.toggleTextOn]}>
              {`ANNUAL · SAVE ${ANNUAL_SAVING_PERCENT}%`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Track Plus, the anchor */}
        <View style={st.block}>
          <View style={st.blockHead}>
            <Text style={st.bestValue}>BEST VALUE</Text>
            <Text style={st.blockMeta}>BOTH APPS</Text>
          </View>

          <Text style={st.planName}>Track Plus</Text>
          <View style={st.priceRow}>
            <Text style={st.price}>{formatPrice(priceOf('trackPlus', cycle))}</Text>
            <Text style={st.priceUnit}>{` ${per}`}</Text>
          </View>
          <Text style={st.planLine}>
            {`TrackKcal and TrackLifts together. The second app costs ${formatPrice(secondAppDelta(cycle))} more, about half its own price.`}
          </Text>

          <TouchableOpacity style={st.primaryButton} onPress={showStoreNote} activeOpacity={0.85}>
            <Text style={st.primaryButtonText}>GET TRACK PLUS</Text>
          </TouchableOpacity>
        </View>

        {/* TrackKcal alone */}
        <View style={st.block}>
          <View style={st.blockHead}>
            <Text style={st.blockMeta}>THIS APP ONLY</Text>
          </View>

          <Text style={st.planName}>TrackKcal Premium</Text>
          <View style={st.priceRow}>
            <Text style={st.price}>{formatPrice(priceOf('kcal', cycle))}</Text>
            <Text style={st.priceUnit}>{` ${per}`}</Text>
          </View>
          <Text style={st.planLine}>Everything below, food only.</Text>

          <TouchableOpacity onPress={showStoreNote} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.secondaryAction}>GET TRACKKCAL PREMIUM</Text>
          </TouchableOpacity>
        </View>

        <Text style={st.storeNote}>{STORE_NOTE}</Text>

        {/* What the money buys */}
        <Text style={st.sectionLabel}>WHAT TRACKKCAL PREMIUM GIVES YOU</Text>
        <View style={st.featureList}>
          {KCAL_FEATURES.map(f => <FeatureRow key={f} text={f} />)}
        </View>

        <Text style={st.sectionLabel}>WHAT TRACK PLUS ADDS</Text>
        <View style={st.featureList}>
          {PLUS_FEATURES.map(f => <FeatureRow key={f} text={f} />)}
        </View>

        <Text style={st.finePrint}>
          {`Prices in ${PRICES.currency}. Cancel any time. Your premium comes from your Track account, so it follows you to every device you sign in on.`}
        </Text>

        {onRestore && (
          <TouchableOpacity onPress={onRestore} style={{ alignSelf: 'flex-start', marginTop: 20 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.restore}>RESTORE PURCHASES</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Acid.moss },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  back: { padding: 4 },
  headerTitle: { fontFamily: Acid.serifItalic, fontSize: 19, color: Acid.tx },
  content: { flex: 1, paddingHorizontal: 20 },

  hero: {
    fontFamily: Acid.serifItalic,
    fontSize: 22,
    lineHeight: 31,
    color: Acid.tx,
    marginTop: 12,
    marginBottom: 24,
  },

  toggleRow: {
    flexDirection: 'row',
    gap: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Acid.hair,
  },
  toggleItem: {},
  toggleText: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', color: Acid.tx3 },
  toggleTextOn: { color: Acid.lime },

  block: {
    paddingTop: 20,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Acid.hair,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  bestValue: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', color: Acid.lime },
  blockMeta: { fontSize: 10, letterSpacing: 1.2, color: Acid.tx3, marginLeft: 'auto' },

  planName: { fontFamily: Acid.serifItalic, fontSize: 17, color: Acid.tx },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  price: { fontFamily: Acid.serif, fontSize: 34, color: Acid.tx },
  priceUnit: { fontSize: 13, color: Acid.tx3 },
  planLine: { fontSize: 13, lineHeight: 19, color: Acid.tx2, marginTop: 8 },

  primaryButton: {
    marginTop: 16,
    backgroundColor: Acid.lime,
    borderRadius: 26,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 12, letterSpacing: 1.5, fontWeight: '700', color: Acid.moss },
  secondaryAction: {
    marginTop: 16,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: Acid.tx,
    textDecorationLine: 'underline',
  },

  storeNote: { fontSize: 12, lineHeight: 18, color: Acid.tx3, marginTop: 16 },

  sectionLabel: { fontSize: 10, letterSpacing: 1.5, color: Acid.tx3, marginTop: 30, marginBottom: 12 },
  featureList: { gap: 12 },
  featureRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  featureText: { flex: 1, fontSize: 14, lineHeight: 20, color: Acid.tx },

  finePrint: { fontSize: 12, lineHeight: 18, color: Acid.tx3, marginTop: 30 },
  restore: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', color: Acid.tx3, textDecorationLine: 'underline' },
});
