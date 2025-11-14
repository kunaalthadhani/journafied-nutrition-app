import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';
import { dataStorage, ReferralCode, ReferralRedemption } from '../services/dataStorage';
import { referralService } from '../services/referralService';
import { analyticsService } from '../services/analyticsService';
import { format } from 'date-fns';
import * as Clipboard from 'expo-clipboard';

interface ReferralScreenProps {
  onBack: () => void;
}

export const ReferralScreen: React.FC<ReferralScreenProps> = ({ onBack }) => {
  const theme = useTheme();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [redemptions, setRedemptions] = useState<ReferralRedemption[]>([]);
  const [totalEarnedEntries, setTotalEarnedEntries] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      setIsLoading(true);
      const accountInfo = await dataStorage.loadAccountInfo();
      if (!accountInfo?.email) {
        Alert.alert('Error', 'Please log in to view your referral code.');
        onBack();
        return;
      }

      // Load user's referral code
      const code = await dataStorage.getReferralCode(accountInfo.email);
      setReferralCode(code);

      // Load user's redemptions (as referrer)
      const userRedemptions = await dataStorage.getReferralRedemptionsForUser(
        accountInfo.email,
        'referrer'
      );
      setRedemptions(userRedemptions);

      // Load total earned entries
      const earned = await dataStorage.getTotalEarnedEntriesFromReferrals(accountInfo.email);
      setTotalEarnedEntries(earned);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareCode = async () => {
    if (!referralCode) return;

    try {
      const accountInfo = await dataStorage.loadAccountInfo();
      const shareMessage = `Join me on TrackKal! Use my referral code ${referralCode.code} to get +10 free entries after logging 5 meals. Download the app and enter the code when you sign up!`;

      await Share.share({
        message: shareMessage,
        title: 'Join TrackKal with my referral code',
      });

      // Track share event
      if (accountInfo?.email) {
        await analyticsService.trackReferralCodeShared(accountInfo.email, 'share');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;

    try {
      await Clipboard.setStringAsync(referralCode.code);
      Alert.alert('Copied!', `Referral code ${referralCode.code} copied to clipboard.`);

      const accountInfo = await dataStorage.loadAccountInfo();
      if (accountInfo?.email) {
        await analyticsService.trackReferralCodeShared(accountInfo.email, 'copy');
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy code to clipboard.');
    }
  };

  const successfulReferrals = redemptions.filter((r) => r.status === 'completed');
  const pendingReferrals = redemptions.filter((r) => r.status === 'pending');

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#14B8A6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#14B8A6" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
          Invite Friends
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Referral Code Card */}
        <View
          style={[
            styles.codeCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Your Referral Code
          </Text>
          <View style={styles.codeContainer}>
            <Text style={[styles.codeText, { color: theme.colors.textPrimary }]}>
              {referralCode?.code || 'Loading...'}
            </Text>
            <TouchableOpacity
              style={[styles.copyButton, { backgroundColor: theme.colors.input }]}
              onPress={handleCopyCode}
            >
              <Feather name="copy" size={18} color="#14B8A6" />
              <Text style={[styles.copyButtonText, { color: '#14B8A6' }]}>Copy</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: '#14B8A6' }]}
            onPress={handleShareCode}
          >
            <Feather name="share-2" size={18} color={Colors.white} />
            <Text style={styles.shareButtonText}>Share Referral Code</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Card */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            Your Stats
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
                {successfulReferrals.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Friends Joined
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
                +{totalEarnedEntries}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Entries Earned
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>
                {pendingReferrals.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Pending
              </Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View
          style={[
            styles.instructionsCard,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Feather name="info" size={20} color="#14B8A6" />
          <Text style={[styles.instructionsText, { color: theme.colors.textSecondary }]}>
            Share your code with friends. When they sign up and log 5 meals, you both get +10 free
            entries!
          </Text>
        </View>

        {/* Referrals List */}
        {redemptions.length > 0 && (
          <View
            style={[
              styles.referralsCard,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
              Your Referrals
            </Text>
            {redemptions.map((redemption) => (
              <View
                key={redemption.id}
                style={[styles.referralItem, { borderBottomColor: theme.colors.border }]}
              >
                <View style={styles.referralItemHeader}>
                  <Text style={[styles.referralName, { color: theme.colors.textPrimary }]}>
                    {redemption.refereeName}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          redemption.status === 'completed'
                            ? '#22C55E'
                            : redemption.status === 'pending'
                            ? '#F59E0B'
                            : theme.colors.input,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            redemption.status === 'completed'
                              ? Colors.white
                              : theme.colors.textSecondary,
                        },
                      ]}
                    >
                      {redemption.status === 'completed'
                        ? 'Completed'
                        : redemption.status === 'pending'
                        ? `${redemption.mealsLogged}/5 meals`
                        : 'Failed'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.referralDate, { color: theme.colors.textTertiary }]}>
                  Joined {format(new Date(redemption.redeemedAt), 'MMM d, yyyy')}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  codeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  codeText: {
    fontSize: 32,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 4,
    flex: 1,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  copyButtonText: {
    marginLeft: 6,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
  },
  shareButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    marginLeft: 8,
  },
  statsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  instructionsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  instructionsText: {
    flex: 1,
    marginLeft: 12,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  referralsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  referralItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  referralItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  referralName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  referralDate: {
    fontSize: Typography.fontSize.xs,
  },
  bottomSpacer: {
    height: 32,
  },
});

