import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/theme';
import { Typography } from '../constants/typography';
import { Colors } from '../constants/colors';

interface AboutScreenProps {
  onBack: () => void;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ onBack }) => {
  const theme = useTheme();

  const handleLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#14B8A6" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>About</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      >
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.appName, { color: theme.colors.textPrimary }]}>TrackKal</Text>
          <Text style={[styles.version, { color: theme.colors.textSecondary }]}>Version 1.0.0</Text>
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>TrackKal helps you log meals, track macros and weight, and visualize your nutrition trends with clean, smooth charts.</Text>
        </View>

        <View style={[styles.section, { borderColor: theme.colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Links</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => handleLink('https://example.com/privacy')}>
            <Feather name="shield" size={18} color="#14B8A6" />
            <Text style={[styles.linkText, { color: theme.colors.textPrimary }]}>Privacy Policy</Text>
            <Feather name="external-link" size={16} color={theme.colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => handleLink('https://example.com/terms')}>
            <Feather name="file-text" size={18} color="#14B8A6" />
            <Text style={[styles.linkText, { color: theme.colors.textPrimary }]}>Terms of Service</Text>
            <Feather name="external-link" size={16} color={theme.colors.textTertiary} />
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




