import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Acid } from '../constants/acid';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';

interface AboutScreenProps {
  onBack: () => void;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ onBack }) => {
  const handleLink = (url: string) => {
    Linking.openURL(url).catch(() => { });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Acid.moss }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Acid.hair }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Acid.tx} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Acid.tx }]}>About</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      >
        <View style={[styles.card, { backgroundColor: Acid.mossDeep, borderColor: Acid.hair }]}>
          <Text style={[styles.appName, { color: Acid.tx }]}>TrackKcal</Text>
          <Text style={[styles.version, { color: Acid.tx2 }]}>Version 1.0.0</Text>
          <Text style={[styles.description, { color: Acid.tx2 }]}>TrackKcal helps you log meals, track macros and weight, and visualize your nutrition trends with clean, smooth charts.</Text>
        </View>

        <View style={[styles.section, { borderColor: Acid.hair }]}>
          <Text style={[styles.sectionTitle, { color: Acid.tx2 }]}>Links</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => handleLink('https://trackkcal.com/privacy.html')}>
            <Feather name="shield" size={18} color={Acid.tx} />
            <Text style={[styles.linkText, { color: Acid.tx }]}>Privacy Policy</Text>
            <Feather name="external-link" size={16} color={Acid.tx3} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => handleLink('https://trackkcal.com/terms.html')}>
            <Feather name="file-text" size={18} color={Acid.tx} />
            <Text style={[styles.linkText, { color: Acid.tx }]}>Terms of Service</Text>
            <Feather name="external-link" size={16} color={Acid.tx3} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  appName: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: 4,
  },
  version: {
    fontSize: Typography.fontSize.sm,
    marginBottom: 12,
  },
  description: {
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  section: {
    borderTopWidth: 1,
    marginTop: 24,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semiBold,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  linkText: {
    flex: 1,
    marginLeft: 8,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  bottomSpacer: {
    height: 24,
  },
});





