// =========================================================
// services/nearbyService.ts
// Lấy danh sách người lạ ở gần (Radar) bằng GPS và Haversine
// =========================================================
import { supabase } from './supabaseConfig';
import { UserLocation } from './locationService';
import { getPublicProfiles } from './profileDirectoryService';

export type NearbyUser = UserLocation & {
  distanceMeters: number;
};

type NearbyLocationRow = UserLocation & {
  distance_meters: number;
};

/**
 * Tìm người lạ đang ở gần. Việc tính khoảng cách và loại bạn bè diễn ra
 * trong database để client không thể tải toàn bộ vị trí đang chia sẻ.
 * @param myLat Vĩ độ hiện tại
 * @param myLng Kinh độ hiện tại
 * @param radiusInMeters Bán kính tìm kiếm (mét)
 */
export const findNearbyStrangers = async (
  myLat: number,
  myLng: number,
  radiusInMeters: number = 20
): Promise<NearbyUser[]> => {
  const { data: locations, error } = await supabase
    .rpc('find_nearby_users', {
      p_latitude: myLat,
      p_longitude: myLng,
      p_radius_meters: radiusInMeters,
    });

  if (error) {
    console.error('[NearbyService] Lỗi khi lấy vị trí:', error.message);
    throw error;
  }

  if (!locations || locations.length === 0) return [];

  const nearbyUsers = ((locations ?? []) as NearbyLocationRow[]).map(location => ({
    user_id: location.user_id,
    latitude: location.latitude,
    longitude: location.longitude,
    is_sharing: location.is_sharing,
    updated_at: location.updated_at,
    distanceMeters: location.distance_meters,
  })) as NearbyUser[];
  if (nearbyUsers.length === 0) return nearbyUsers;

  const users = await getPublicProfiles(nearbyUsers.map(user => user.user_id));

  // Map thông tin user vào danh sách trả về
  nearbyUsers.forEach(nu => {
    const u = users.find(u => u.id === nu.user_id);
    if (u) {
      nu.user = { name: u.name, avatar: u.avatar };
    }
  });

  // Trả về danh sách được sắp xếp từ gần đến xa
  return nearbyUsers.sort((a, b) => a.distanceMeters - b.distanceMeters);
};
