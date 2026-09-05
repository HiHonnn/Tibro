// =========================================================
// components/ReportModal.tsx
// Modal báo cáo người dùng vi phạm
// =========================================================

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../styles/colors';
import { sendReport } from '../services/reportService';

// Danh sách lý do mẫu
const REASONS = [
  'Ngôn từ không phù hợp',
  'Spam / Quấy rối',
  'Nội dung phản cảm',
  'Mạo danh / Giả mạo',
  'Khác',
];

interface Props {
  visible: boolean;
  reportedUserId: string;
  reportedUserName: string;
  onClose: () => void;
}

export default function ReportModal({ visible, reportedUserId, reportedUserName, onClose }: Props) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Thông báo', 'Vui lòng chọn lý do báo cáo');
      return;
    }

    setLoading(true);
    try {
      await sendReport(reportedUserId, selectedReason, description);
      Alert.alert(
        '✅ Đã gửi báo cáo',
        `Báo cáo về "${reportedUserName}" đã được gửi đến quản trị viên. Chúng tôi sẽ xem xét sớm nhất.`,
        [{ text: 'OK', onPress: onClose }]
      );
      // Reset form
      setSelectedReason(null);
      setDescription('');
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể gửi báo cáo, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.handle} />
          <Text style={styles.title}>⚠️ Báo cáo người dùng</Text>
          <Text style={styles.subtitle}>
            Báo cáo <Text style={styles.reportedName}>{reportedUserName}</Text>
          </Text>

          {/* Reason chips */}
          <Text style={styles.sectionLabel}>Chọn lý do *</Text>
          <View style={styles.reasonContainer}>
            {REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonChip,
                  selectedReason === reason && styles.reasonChipSelected,
                ]}
                onPress={() => setSelectedReason(reason)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextSelected,
                  ]}
                >
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>Mô tả chi tiết (tùy chọn)</Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập mô tả chi tiết về vi phạm..."
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, !selectedReason && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selectedReason || loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Gửi báo cáo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  reportedName: {
    color: '#EF4444',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  reasonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reasonChipSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  reasonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  reasonTextSelected: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
