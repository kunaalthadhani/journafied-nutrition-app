import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useTheme } from '../constants/theme';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hour: number, minute: number) => void;
  initialHour?: number;
  initialMinute?: number;
  title?: string;
}

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  onClose,
  onConfirm,
  initialHour = 8,
  initialMinute = 0,
  title = 'Select Time',
}) => {
  const theme = useTheme();
  const [selectedHour, setSelectedHour] = useState(initialHour);
  const [selectedMinute, setSelectedMinute] = useState(initialMinute);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  };

  const handleConfirm = () => {
    onConfirm(selectedHour, selectedMinute);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <SafeAreaView edges={['bottom']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
                {title}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Time Display */}
            <View style={styles.timeDisplay}>
              <Text style={[styles.timeDisplayText, { color: theme.colors.textPrimary }]}>
                {formatTime(selectedHour, selectedMinute)}
              </Text>
            </View>

            {/* Picker */}
            <View style={styles.pickerContainer}>
              {/* Hours */}
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: theme.colors.textSecondary }]}>
                  Hour
                </Text>
                <ScrollView
                  style={styles.scrollView}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={50}
                  decelerationRate="fast"
                >
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.pickerItem,
                        selectedHour === hour && {
                          backgroundColor: '#14B8A6',
                        },
                      ]}
                      onPress={() => setSelectedHour(hour)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          {
                            color:
                              selectedHour === hour
                                ? Colors.white
                                : theme.colors.textPrimary,
                            fontWeight:
                              selectedHour === hour
                                ? Typography.fontWeight.semiBold
                                : Typography.fontWeight.normal,
                          },
                        ]}
                      >
                        {hour.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Minutes */}
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerLabel, { color: theme.colors.textSecondary }]}>
                  Minute
                </Text>
                <ScrollView
                  style={styles.scrollView}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={50}
                  decelerationRate="fast"
                >
                  {minutes.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.pickerItem,
                        selectedMinute === minute && {
                          backgroundColor: '#14B8A6',
                        },
                      ]}
                      onPress={() => setSelectedMinute(minute)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          {
                            color:
                              selectedMinute === minute
                                ? Colors.white
                                : theme.colors.textPrimary,
                            fontWeight:
                              selectedMinute === minute
                                ? Typography.fontWeight.semiBold
                                : Typography.fontWeight.normal,
                          },
                        ]}
                      >
                        {minute.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Actions */}
            <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semiBold,
  },
  closeButton: {
    padding: 4,
  },
  timeDisplay: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  timeDisplayText: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.bold,
  },
  pickerContainer: {
    flexDirection: 'row',
    height: 200,
    paddingHorizontal: 20,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 8,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  pickerItem: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  pickerItemText: {
    fontSize: Typography.fontSize.lg,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.white,
  },
});





