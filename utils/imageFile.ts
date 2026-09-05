// Chuyển URI ảnh cục bộ của Expo thành dữ liệu mà Supabase Storage
// có thể upload ổn định trên React Native.
export const readImageAsArrayBuffer = async (uri: string): Promise<ArrayBuffer> => {
  try {
    const response = await fetch(uri);
    const fileData = await response.arrayBuffer();

    if (fileData.byteLength === 0) {
      throw new Error('Ảnh không có dữ liệu');
    }

    return fileData;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`Không thể đọc ảnh trên thiết bị${detail}`);
  }
};
