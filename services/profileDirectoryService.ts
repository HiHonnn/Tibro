import { supabase } from './supabaseConfig';

export type PublicProfile = {
  id: string;
  name: string;
  avatar: string;
  username?: string;
  online_at?: string;
  gender?: string;
  birthday?: string;
};

export const getPublicProfiles = async (userIds: string[]): Promise<PublicProfile[]> => {
  if (userIds.length === 0) return [];

  const { data, error } = await supabase.rpc('get_public_profiles', {
    p_user_ids: [...new Set(userIds)],
    p_query: null,
    p_limit: Math.min(userIds.length, 100),
  });

  if (error) throw error;
  return (data ?? []) as PublicProfile[];
};

export const searchPublicProfiles = async (
  query: string,
  limit = 20,
): Promise<PublicProfile[]> => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const { data, error } = await supabase.rpc('get_public_profiles', {
    p_user_ids: null,
    p_query: normalizedQuery,
    p_limit: Math.min(Math.max(limit, 1), 100),
  });

  if (error) throw error;
  return (data ?? []) as PublicProfile[];
};
