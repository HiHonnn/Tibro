// =========================================================
// app/(tabs)/profile.tsx
// Xem & cập nhật hồ sơ, đổi avatar, toggle vị trí
// =========================================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useLocation } from '../../hooks/useLocation';
import { updateProfile, uploadAvatar } from '../../services/profileService';
import { logoutUser } from '../../services/authService';
import { useRouter } from 'expo-router';
import { Colors } from '../../styles/colors';
import { FontSize } from '../../styles/globalStyles';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';

export default function ProfileScreen() {
  const { currentUser, refetch } = useCurrentUser();
  const { isSharing, setIsSharing } = useLocation();
  const router = useRouter();

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');

  // Sync data to form when enter edit mode
  const handleEditToggle = () => {
    if (!editMode && currentUser) {
      setName(currentUser.name || '');
      setUsername(currentUser.username || '');
      setGender(currentUser.gender || '');
      setBirthday(currentUser.birthday || '');
    }
    setEditMode(!editMode);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Lỗi', 'Tên không được để trống');
    if (name.trim().length > 80) return Alert.alert('Lỗi', 'Tên hiển thị tối đa 80 ký tự');
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username.trim())) {
      return Alert.alert('Lỗi', 'Username phải có 3–30 ký tự và chỉ gồm chữ, số, dấu chấm hoặc gạch dưới');
    }
    if (birthday.trim() && !/^\d{2}\/\d{2}\/\d{4}$/.test(birthday.trim())) {
      return Alert.alert('Lỗi', 'Ngày sinh phải theo định dạng DD/MM/YYYY');
    }
    setSaving(true);
    try {
      await updateProfile({ 
        name: name.trim(), 
        username: username.trim(),
        gender: gender.trim(),
        birthday: birthday.trim()
      });
      await refetch();
      setEditMode(false);
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể cập nhật hồ sơ');
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Cần quyền truy cập ảnh',
          'Hãy cho phép Tibro truy cập thư viện ảnh trong Cài đặt để đổi ảnh đại diện.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setUploadingAvatar(true);
        await uploadAvatar(result.assets[0].uri);
        await refetch();
      }
    } catch (e: any) {
      Alert.alert('Không thể đổi ảnh đại diện', e.message || 'Không thể tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: async () => {
        await logoutUser();
        router.replace('/login' as any);
      }}
    ]);
  };

  if (!currentUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hồ sơ</Text>
          <TouchableOpacity onPress={handleEditToggle} style={styles.editBtn}>
            <Feather name={editMode ? "x" : "edit-2"} size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* --- Avatar --- */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar}>
            <View style={styles.avatarWrapper}>
              {currentUser.avatar ? (
                <Image source={{ uri: currentUser.avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>{currentUser.name?.charAt(0).toUpperCase() || '?'}</Text>
                </View>
              )}
              
              <View style={styles.cameraIconBadge}>
                <Feather name="camera" size={14} color={Colors.white} />
              </View>

              {uploadingAvatar && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color={Colors.white} />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.emailText}>{currentUser.email}</Text>
          {currentUser.username && !editMode && <Text style={styles.usernameText}>@{currentUser.username}</Text>}
        </View>

        {/* --- Form Edit / Display --- */}
        <View style={styles.infoSection}>
          {editMode ? (
            <View style={styles.formCard}>
              <CustomInput label="Họ và tên" value={name} onChangeText={setName} accentColor={Colors.primary} />
              <CustomInput label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" accentColor={Colors.primary} />
              <CustomInput label="Giới tính" value={gender} onChangeText={setGender} placeholder="Ví dụ: Nam, Nữ..." accentColor={Colors.primary} />
              <CustomInput label="Ngày sinh" value={birthday} onChangeText={setBirthday} placeholder="DD/MM/YYYY" accentColor={Colors.primary} />
              <CustomButton label="Lưu thay đổi" onPress={handleSave} loading={saving} color={Colors.primary} style={{ marginTop: 16 }} />
            </View>
          ) : (
            <View style={styles.displayCard}>
              <View style={styles.infoRow}>
                <Feather name="user" size={18} color={Colors.textMuted} />
                <View style={styles.infoTexts}>
                  <Text style={styles.infoLabel}>Tên hiển thị</Text>
                  <Text style={styles.infoValue}>{currentUser.name}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Feather name="users" size={18} color={Colors.textMuted} />
                <View style={styles.infoTexts}>
                  <Text style={styles.infoLabel}>Giới tính</Text>
                  <Text style={[styles.infoValue, !currentUser.gender && styles.emptyValue]}>
                    {currentUser.gender || 'Chưa cập nhật'}
                  </Text>
                </View>
              </View>

              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Feather name="calendar" size={18} color={Colors.textMuted} />
                <View style={styles.infoTexts}>
                  <Text style={styles.infoLabel}>Ngày sinh</Text>
                  <Text style={[styles.infoValue, !currentUser.birthday && styles.emptyValue]}>
                    {currentUser.birthday || 'Chưa cập nhật'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* --- Settings --- */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Cài đặt</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextRow}>
              <View style={[styles.settingIconBox, { backgroundColor: Colors.primaryLight }]}>
                <Feather name="map-pin" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.settingLabel}>Chia sẻ vị trí với bạn bè</Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setIsSharing(!isSharing).catch((error: any) => {
                  Alert.alert('Không thể cập nhật', error?.message || 'Vui lòng kiểm tra kết nối mạng.');
                });
              }}
              style={[styles.toggleWrap, isSharing ? styles.toggleOn : styles.toggleOff]}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleCircle, isSharing ? styles.toggleCircleOn : styles.toggleCircleOff]} />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
            <Feather name="log-out" size={20} color={Colors.error} />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.black },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  editBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarWrapper: { position: 'relative', width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  avatarImg: { width: '100%', height: '100%', borderRadius: 50 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { fontSize: 40, fontWeight: 'bold', color: Colors.gray500 },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.black },
  uploadingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  emailText: { fontSize: FontSize.sm, color: Colors.textMuted },
  usernameText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.primary, marginTop: 4 },

  infoSection: { paddingHorizontal: 20, marginTop: 10 },
  formCard: { backgroundColor: Colors.cardBg, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 },
  displayCard: { backgroundColor: Colors.cardBg, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 },
  
  statsGrid: { display: 'none' },
  statBox: { display: 'none' },
  statDivider: { display: 'none' },
  statNumber: { display: 'none' },
  statLabel: { display: 'none' },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  infoTexts: { marginLeft: 16 },
  infoLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  emptyValue: { color: Colors.textMuted, fontStyle: 'italic', fontWeight: '400' },

  settingsSection: { paddingHorizontal: 20, marginTop: 32 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.cardBg, padding: 16, borderRadius: 16, marginBottom: 12 },
  settingTextRow: { flexDirection: 'row', alignItems: 'center' },
  settingIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  settingLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  
  toggleWrap: { width: 50, height: 30, borderRadius: 15, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: Colors.primaryLight },
  toggleOff: { backgroundColor: 'rgba(255,255,255,0.2)' },
  toggleCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  toggleCircleOn: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  toggleCircleOff: { alignSelf: 'flex-start' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 24 },
  logoutText: { marginLeft: 8, fontSize: FontSize.md, fontWeight: '700', color: Colors.error },
});
