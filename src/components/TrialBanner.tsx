import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { TrialState, trialLabel } from '../utils/trial';

const LIFTS_PACKAGE = 'com.tracklifts.app';
// Agreed with the Lifts side. Until their build ships with it, openURL simply
// throws and we fall through to the store, which is the correct answer for
// someone who does not have the app anyway.
const LIFTS_SCHEME = 'tracklifts://';

/**
 * Installed, open it. Not installed, send them to the store to get it.
 *
 * canOpenURL is deliberately not used: on Android 11+ it returns false for any
 * scheme not declared in the manifest's <queries>, and on iOS for any scheme
 * not in LSApplicationQueriesSchemes. Both would make an installed app look
 * absent. Attempting the open and catching the failure asks the real question.
 */
export const openTrackLifts = async () => {
  const web = `https://play.google.com/store/apps/details?id=${LIFTS_PACKAGE}`;
  try {
    await Linking.openURL(LIFTS_SCHEME);
    return;
  } catch { /* not installed, or no scheme in their build yet */ }

  try {
    await Linking.openURL(`market://details?id=${LIFTS_PACKAGE}`);
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
