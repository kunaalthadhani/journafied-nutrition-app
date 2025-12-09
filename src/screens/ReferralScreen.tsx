import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { ReferralRedemption, ReferralReward, dataStorage } from '../services/dataStorage';

interface ReferralScreenProps {
  isLoggedIn: boolean;
  userEmail: string | null;
  referralCode: string | null;
  totalEarnedEntriesFromReferrals: number;
  remainingEntries: number | null;
  onBack: () => void;
  onLoginPress: () => void;
}

export const ReferralScreen: React.FC<ReferralScreenProps> = ({
  isLoggedIn,
  userEmail,
  referralCode,
  totalEarnedEntriesFromReferrals,
  remainingEntries,
  onBack,
  onLoginPress,
}) => {
  const theme = useTheme();
  const [redemptions, setRedemptions] = useState<ReferralRedemption[]>([]);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadReferralData = async () => {
      if (!isLoggedIn || !userEmail) return;
      setIsLoading(true);
      try {
        const [referrerRedemptions, refereeRedemptions, allRewards] = await Promise.all([
          dataStorage.getReferralRedemptionsForUser(userEmail, 'referrer'),
          dataStorage.getReferralRedemptionsForUser(userEmail, 'referee'),
          dataStorage.getReferralRewardsForUser(userEmail),
        ]);
        const combinedRedemptions = [...referrerRedemptions, ...refereeRedemptions];
        combinedRedemptions.sort(
          (a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime()
        );
        setRedemptions(combinedRedemptions);
        setRewards(allRewards);
      } catch (error) {
        console.error('Error loading referral history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReferralData();
  }, [isLoggedIn, userEmail]);

  const rows = useMemo(() => {
    if (!redemptions.length) return [];
    return redemptions.map((r) => {
      const earnedForThis =
        rewards
          .filter((rw) => rw.relatedRedemptionId === r.id)
          .reduce((sum, rw) => sum + (rw.entriesAwarded || 0), 0) || 0;
      return {
        id: r.id,
        friendName: r.refereeName || r.refereeEmail || 'friend',
        entries: earnedForThis,
        status: r.status,
      };
    });
  }, [redemptions, rewards]);

  const handleCopyCode = () => {
    if (!referralCode) return;
    Clipboard.setStringAsync(referralCode)
      .then(() => {
        Alert.alert('Copied', 'Referral code copied to clipboard');
      })
      .catch(() => { });
  };

  const handleShareWhatsApp = () => {
    if (!referralCode) return;
    const message = `Join me on TrackKcal use my referral code ${referralCode} to get free extra entries`;
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp not available', 'Install WhatsApp to share your code');
    });
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Referral</Text>
        <View style={styles.headerRight} />
      </View>

      {!isLoggedIn || !userEmail ? (
        <View style={styles.centerContent}>
          <Text style={[styles.loginTitle, { color: theme.colors.textPrimary }]}>
            You need to be logged in to view your referral code
          </Text>
          <Text style={[styles.loginSubtitle, { color: theme.colors.textSecondary }]}>
            log in to get your code and free entries when friends join
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={onLoginPress}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, { color: theme.colors.primaryForeground }]}>Log in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        >
          <View
            style={[
              styles.card,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Your referral code
            </Text>
            <Text style={[styles.codeText, { color: theme.colors.textPrimary }]}>
              {referralCode || 'loading'}
            </Text>
            <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
              share this with friends each friend who logs meals unlocks free entries for both of you
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleShareWhatsApp}
                activeOpacity={0.85}
              >
                <Feather name="message-circle" size={16} color={theme.colors.primaryForeground} />
                <Text style={[styles.actionButtonText, { color: theme.colors.primaryForeground }]}>Share on WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.colors.input }]}
                onPress={handleCopyCode}
              >
                <Feather name="copy" size={16} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Free entries
            </Text>
            <View style={styles.freeRow}>
              <View>
                <Text style={[styles.freeLabel, { color: theme.colors.textSecondary }]}>
                  From referrals
                </Text>
                <Text style={[styles.freeValue, { color: theme.colors.primary }]}>
                  +{totalEarnedEntriesFromReferrals}
                </Text>
              </View>
              {remainingEntries !== null && (
                <View style={styles.freeRight}>
                  <Text style={[styles.freeLabel, { color: theme.colors.textSecondary }]}>
                    Remaining entries
                  </Text>
                  <Text style={[styles.freeValue, { color: theme.colors.textPrimary }]}>
                    {remainingEntries}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View
            style={[
              styles.card,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Referral history
            </Text>
            {isLoading ? (
              <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
                loading history
              </Text>
            ) : rows.length === 0 ? (
              <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
                no referrals yet share your code to start earning entries
              </Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { color: theme.colors.textSecondary }]}>
                    Friend
                  </Text>
                  <Text style={[styles.tableHeaderText, { color: theme.colors.textSecondary }]}>
                    Entries
                  </Text>
                </View>
                {rows.map((row) => (
                  <View key={row.id} style={styles.tableRow}>
                    <Text style={[styles.tableCellText, { color: theme.colors.textPrimary }]}>
                      {row.friendName}
                    </Text>
                    <Text style={[styles.tableCellText, { color: theme.colors.primary }]}>
                      {row.entries > 0 ? `+${row.entries}` : '+0'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
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
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 8,
  },
  codeText: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 4,
    marginBottom: 8,
  },
  helper: {
    fontSize: Typography.fontSize.sm,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  freeLabel: {
    fontSize: Typography.fontSize.sm,
  },
  freeValue: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 4,
  },
  freeRight: {
    alignItems: 'flex-end',
  },
  table: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  tableCellText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
  },
  bottomSpacer: {
    height: 32,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loginTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    textAlign: 'center',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: 'transparent', // overridden
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
  },
});

export default ReferralScreen;








