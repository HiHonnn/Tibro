const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!configuredApiUrl) {
  throw new Error(
    'Thiếu EXPO_PUBLIC_API_URL. Hãy sao chép .env.example thành .env.',
  );
}

export const API_BASE_URL = configuredApiUrl.replace(/\/$/, '');
