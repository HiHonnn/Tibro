import { API_BASE_URL } from './apiConfig';
import { supabase } from './supabaseConfig';

export type CallStatus =
  | 'ringing'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'ended'
  | 'missed';

export type CallSession = {
  id: string;
  conversation_id: string;
  caller_id: string;
  receiver_id: string;
  room_name: string;
  is_video: boolean;
  status: CallStatus;
  created_at: string;
  answered_at?: string | null;
  ended_at?: string | null;
  updated_at: string;
};

export type CallCredentials = {
  server_url: string;
  participant_token: string;
};

const request = async <T>(path: string, body?: Record<string, unknown>): Promise<T> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Không thể kết nối dịch vụ cuộc gọi.');
    return payload as T;
  } catch (requestError: any) {
    if (requestError?.name === 'AbortError') {
      throw new Error('Dịch vụ cuộc gọi phản hồi quá chậm. Vui lòng thử lại.');
    }
    throw requestError;
  } finally {
    clearTimeout(timeout);
  }
};

export const createCall = async (conversationId: string, isVideo: boolean): Promise<CallSession> => {
  const result = await request<{ call: CallSession }>('/calls', { conversationId, isVideo });
  return result.call;
};

export const respondToCall = async (callId: string, accept: boolean): Promise<CallSession> => {
  const result = await request<{ call: CallSession }>(`/calls/${callId}/respond`, { accept });
  return result.call;
};

export const endCall = async (callId: string, reason?: 'cancelled' | 'missed'): Promise<CallSession> => {
  const result = await request<{ call: CallSession }>(`/calls/${callId}/end`, { reason });
  return result.call;
};

export const getCallCredentials = (callId: string): Promise<CallCredentials> =>
  request<CallCredentials>(`/calls/${callId}/token`);

export const getPendingIncomingCall = async (userId: string): Promise<CallSession | null> => {
  const { data, error } = await supabase
    .from('call_sessions')
    .select('*')
    .eq('receiver_id', userId)
    .eq('status', 'ringing')
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as CallSession | null;
};

export const subscribeToIncomingCalls = (
  userId: string,
  onIncoming: (call: CallSession) => void,
) => {
  const channel = supabase
    .channel(`incoming-calls-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_sessions',
        filter: `receiver_id=eq.${userId}`,
      },
      payload => onIncoming(payload.new as CallSession),
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
};

export const subscribeToCall = (
  callId: string,
  onChange: (call: CallSession) => void,
) => {
  const channel = supabase
    .channel(`call-${callId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_sessions',
        filter: `id=eq.${callId}`,
      },
      payload => onChange(payload.new as CallSession),
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
};
