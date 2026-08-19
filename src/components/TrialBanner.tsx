import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { TrialState, trialLabel } from '../utils/trial';

// TrackLifts has no custom scheme yet, so the store listing is the reliable
// door. Play shows Open rather than Install when the app is already there.
const LIFTS_PACKAGE = 'com.tracklifts.app';

export const openTrackLifts = async () => {
  const store = `market://details?id=${LIFTS_PACKAGE}`;
  const web = `https://play.google.com/store/apps/details?id=${LIFTS_PACKAGE}`;
  try {
    const canStore = await Linking.canOpenURL(store);
    await Linking.openURL(canStore ? store : web);
  } catch {
    Linking.openURL(web).catch(() =>
      Alert.alert('Could not open the store', 'Search for TrackLifts in Google Play.')
    );
  }
};

interface TrialBannerProps {
  trial: TrialState;
  /** Hidden for anyone who actually pays. A subscriber is not on a trial. */
  isSubscriber: boolean;
  onSeePlans: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ trial, isSubscriber, onSeePlans }) => {
  if (isSubscriber) return null;

  // Ended. One quiet line, not a wall.
  if (trial.expired) {
    return (
      <TouchableOpacity style={styles.container} activeOpacity={0.9} onPress={onSeePlans}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: Acid.hair2 }]}>
            <Feather name="clock" size={15} color={Acid.tx2} />
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>Your three weeks are up</Text>
            <Text style={styles.sub}>Keep everything on in both apps</Text>
          </View>
          <Text style={styles.cta}>SEE PLANS</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (!trial.active) return null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: Acid.lime }]}>
          <Feather name="unlock" size={15} color={Acid.moss} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Everything is on. {trialLabel(trial)}.</Text>
          <Text style={styles.sub}>Your trial runs in TrackLifts at the same time</Text>
        </View>
      </View>
      <TouchableOpacity onPress={openTrackLifts} style={styles.liftsRow} activeOpacity={0.7}>
        <Feather name="activity" size={13} color={Acid.lime} />
        <Text style={styles.liftsText}>Open TrackLifts, it is already unlocked</Text>
        <Feather name="arrow-up-right" size={13} color={Acid.lime} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Acid.hair2,
    backgroundColor: Acid.limeSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: {
    fontFamily: Acid.serifItalic,
    fontSize: 15,
    color: Acid.tx,
  },
  sub: {
    fontSize: Typography.fontSize.xs,
    color: Acid.tx2,
  },
  cta: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Acid.lime,
  },
  liftsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Acid.hair2,
  },
  liftsText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Acid.lime,
  },
});
