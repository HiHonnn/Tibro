require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const { AccessToken } = require('livekit-server-sdk');

const requiredEnv = (name, value) => {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const PORT = process.env.PORT || 3000;
const GMAIL_USER = requiredEnv('GMAIL_USER', process.env.GMAIL_USER);
const GMAIL_APP_PASSWORD = requiredEnv('GMAIL_APP_PASSWORD', process.env.GMAIL_APP_PASSWORD);
const SUPABASE_URL = requiredEnv('SUPABASE_URL', process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = requiredEnv(
  'SUPABASE_SERVICE_ROLE_KEY',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const OTP_SECRET = requiredEnv('OTP_SECRET', process.env.OTP_SECRET);
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.set('trust proxy', 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed'));
    },
  }),
);
app.use(express.json({ limit: '10kb' }));

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

const rateLimitBuckets = new Map();
const rateLimit = ({ windowMs, max }) => (req, res, next) => {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (current.count >= max) {
    return res.status(429).json({ error: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.' });
  }

  current.count += 1;
  return next();
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidOtpType = (value) => value === 'signup' || value === 'recovery';
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashOtp = (email, type, otp) =>
  crypto.createHmac('sha256', OTP_SECRET).update(`${email}:${type}:${otp}`).digest('hex');
const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

const requireAuth = async (req, res, next) => {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập.' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });

  req.authUser = data.user;
  return next();
};

const getCallSession = async (callId) => {
  const { data, error } = await supabaseAdmin
    .from('call_sessions')
    .select('*')
    .eq('id', callId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const isCallParticipant = (call, userId) =>
  call?.caller_id === userId || call?.receiver_id === userId;

const areAcceptedFriends = async (firstUserId, secondUserId) => {
  const { data, error } = await supabaseAdmin
    .from('friends')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${firstUserId},receiver_id.eq.${secondUserId}),`
      + `and(requester_id.eq.${secondUserId},receiver_id.eq.${firstUserId})`,
    )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};

const buildEmailHtml = (otp, type) => {
  const title = type === 'recovery' ? 'Đặt lại mật khẩu' : 'Xác nhận đăng ký';
  const subtitle =
    type === 'recovery'
      ? 'Dưới đây là mã OTP để đặt lại mật khẩu tài khoản Tibro của bạn:'
      : 'Dưới đây là mã OTP để hoàn tất đăng ký tài khoản Tibro:';

  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;text-align:center;padding:30px;border:1px solid #e5e7eb;border-radius:16px">
      <h1 style="font-size:28px;color:#111827">Tibro</h1>
      <h2 style="font-size:18px;color:#10B981">${title}</h2>
      <p style="font-size:15px;color:#6B7280">${subtitle}</p>
      <div style="background:#F3F4F6;display:inline-block;padding:16px 32px;border-radius:12px">
        <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1F2937">${otp}</span>
      </div>
      <p style="font-size:13px;color:#9CA3AF">Mã này có hiệu lực trong 5 phút.</p>
    </div>
  `;
};

const findUserByEmail = async (email) => {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  return error ? null : data?.user || null;
};

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'tibro-api',
    version: '1.3.0',
    calling: Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET),
  });
});

// Create secure call signalling. Only a conversation participant can call the
// other participant; the native client never receives the LiveKit API secret.
app.post(
  '/calls',
  requireAuth,
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  async (req, res) => {
    const conversationId = String(req.body.conversationId || '');
    const isVideo = req.body.isVideo === true;

    if (!isUuid(conversationId)) {
      return res.status(400).json({ error: 'Cuộc trò chuyện không hợp lệ.' });
    }
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: 'Dịch vụ cuộc gọi chưa được cấu hình.' });
    }

    try {
      const { data: conversation, error: conversationError } = await supabaseAdmin
        .from('conversations')
        .select('id, user1_id, user2_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (conversationError) throw conversationError;
      if (!conversation || ![conversation.user1_id, conversation.user2_id].includes(req.authUser.id)) {
        return res.status(404).json({ error: 'Không tìm thấy cuộc trò chuyện.' });
      }

      const callerId = req.authUser.id;
      const receiverId = conversation.user1_id === callerId
        ? conversation.user2_id
        : conversation.user1_id;
      if (!(await areAcceptedFriends(callerId, receiverId))) {
        return res.status(403).json({ error: 'Chỉ bạn bè mới có thể gọi cho nhau.' });
      }

      // Release stale rows for either participant so an interrupted client
      // cannot leave the account permanently busy in another conversation.
      const participantFilter = [callerId, receiverId]
        .flatMap(id => [`caller_id.eq.${id}`, `receiver_id.eq.${id}`])
        .join(',');
      await supabaseAdmin
        .from('call_sessions')
        .update({ status: 'missed', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .or(participantFilter)
        .eq('status', 'ringing')
        .lt('created_at', new Date(Date.now() - 60 * 1000).toISOString());
      await supabaseAdmin
        .from('call_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .or(participantFilter)
        .eq('status', 'accepted')
        .lt('answered_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

      const { data: call, error: insertError } = await supabaseAdmin
        .from('call_sessions')
        .insert({
          conversation_id: conversationId,
          caller_id: callerId,
          receiver_id: receiverId,
          room_name: `tibro-${crypto.randomUUID()}`,
          is_video: isVideo,
        })
        .select('*')
        .single();

      if (insertError?.code === '23505') {
        return res.status(409).json({ error: 'Bạn hoặc người nhận đang có một cuộc gọi khác.' });
      }
      if (insertError) throw insertError;

      return res.status(201).json({ call });
    } catch (error) {
      console.error('[calls:create] Failed:', error?.message || error);
      return res.status(500).json({ error: 'Không thể bắt đầu cuộc gọi.' });
    }
  },
);

app.post(
  '/calls/:callId/respond',
  requireAuth,
  rateLimit({ windowMs: 60 * 1000, max: 20 }),
  async (req, res) => {
    const callId = String(req.params.callId || '');
    if (!isUuid(callId) || typeof req.body.accept !== 'boolean') {
      return res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
    }

    try {
      const call = await getCallSession(callId);
      if (!call || call.receiver_id !== req.authUser.id) {
        return res.status(404).json({ error: 'Không tìm thấy cuộc gọi.' });
      }
      if (call.status !== 'ringing') {
        return res.status(409).json({ error: 'Cuộc gọi không còn chờ phản hồi.' });
      }
      if (Date.now() - new Date(call.created_at).getTime() > 60 * 1000) {
        const now = new Date().toISOString();
        await supabaseAdmin
          .from('call_sessions')
          .update({ status: 'missed', ended_at: now, updated_at: now })
          .eq('id', callId)
          .eq('status', 'ringing');
        return res.status(409).json({ error: 'Cuộc gọi đã quá thời gian chờ.' });
      }

      const now = new Date().toISOString();
      const status = req.body.accept ? 'accepted' : 'declined';
      const changes = req.body.accept
        ? { status, answered_at: now, updated_at: now }
        : { status, ended_at: now, updated_at: now };
      const { data: updated, error } = await supabaseAdmin
        .from('call_sessions')
        .update(changes)
        .eq('id', callId)
        .eq('status', 'ringing')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!updated) return res.status(409).json({ error: 'Cuộc gọi đã được xử lý.' });
      return res.status(200).json({ call: updated });
    } catch (error) {
      console.error('[calls:respond] Failed:', error?.message || error);
      return res.status(500).json({ error: 'Không thể phản hồi cuộc gọi.' });
    }
  },
);

app.post(
  '/calls/:callId/end',
  requireAuth,
  rateLimit({ windowMs: 60 * 1000, max: 30 }),
  async (req, res) => {
    const callId = String(req.params.callId || '');
    if (!isUuid(callId)) return res.status(400).json({ error: 'Cuộc gọi không hợp lệ.' });

    try {
      const call = await getCallSession(callId);
      if (!call || !isCallParticipant(call, req.authUser.id)) {
        return res.status(404).json({ error: 'Không tìm thấy cuộc gọi.' });
      }
      if (!['ringing', 'accepted'].includes(call.status)) {
        return res.status(200).json({ call });
      }

      let status = 'ended';
      if (call.status === 'ringing') {
        if (req.authUser.id === call.receiver_id) status = 'declined';
        else status = req.body.reason === 'missed' ? 'missed' : 'cancelled';
      }

      const now = new Date().toISOString();
      const { data: updated, error } = await supabaseAdmin
        .from('call_sessions')
        .update({ status, ended_at: now, updated_at: now })
        .eq('id', callId)
        .in('status', ['ringing', 'accepted'])
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return res.status(200).json({ call: updated || call });
    } catch (error) {
      console.error('[calls:end] Failed:', error?.message || error);
      return res.status(500).json({ error: 'Không thể kết thúc cuộc gọi.' });
    }
  },
);

app.post(
  '/calls/:callId/token',
  requireAuth,
  rateLimit({ windowMs: 60 * 1000, max: 20 }),
  async (req, res) => {
    const callId = String(req.params.callId || '');
    if (!isUuid(callId)) return res.status(400).json({ error: 'Cuộc gọi không hợp lệ.' });
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: 'Dịch vụ cuộc gọi chưa được cấu hình.' });
    }

    try {
      const call = await getCallSession(callId);
      if (!call || !isCallParticipant(call, req.authUser.id)) {
        return res.status(404).json({ error: 'Không tìm thấy cuộc gọi.' });
      }
      const ringingExpired = call.status === 'ringing'
        && Date.now() - new Date(call.created_at).getTime() > 60 * 1000;
      const acceptedExpired = call.status === 'accepted'
        && (!call.answered_at || Date.now() - new Date(call.answered_at).getTime() > 2 * 60 * 60 * 1000);
      if (ringingExpired || acceptedExpired) {
        const now = new Date().toISOString();
        await supabaseAdmin
          .from('call_sessions')
          .update({
            status: ringingExpired ? 'missed' : 'ended',
            ended_at: now,
            updated_at: now,
          })
          .eq('id', callId)
          .in('status', ['ringing', 'accepted']);
        return res.status(409).json({ error: 'Phiên cuộc gọi đã hết hạn.' });
      }
      const callerCanJoin = call.caller_id === req.authUser.id && ['ringing', 'accepted'].includes(call.status);
      const receiverCanJoin = call.receiver_id === req.authUser.id && call.status === 'accepted';
      if (!callerCanJoin && !receiverCanJoin) {
        return res.status(409).json({ error: 'Cuộc gọi chưa được chấp nhận hoặc đã kết thúc.' });
      }

      const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: req.authUser.id,
        name: String(req.authUser.user_metadata?.username || req.authUser.email || 'Tibro user'),
        ttl: '10m',
      });
      token.addGrant({
        roomJoin: true,
        room: call.room_name,
        canPublish: true,
        canSubscribe: true,
      });

      return res.status(200).json({
        server_url: LIVEKIT_URL,
        participant_token: await token.toJwt(),
      });
    } catch (error) {
      console.error('[calls:token] Failed:', error?.message || error);
      return res.status(500).json({ error: 'Không thể kết nối cuộc gọi.' });
    }
  },
);

app.post(
  '/sendOtp',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
  async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const type = req.body.type || 'signup';

    if (!isValidEmail(email) || !isValidOtpType(type)) {
      return res.status(400).json({ error: 'Dữ liệu yêu cầu không hợp lệ.' });
    }

    try {
      const user = await findUserByEmail(email);
      const shouldSend = type === 'recovery' ? Boolean(user) : !user;

      if (!shouldSend) {
        return res.status(200).json({ success: true, message: 'Nếu email hợp lệ, mã OTP sẽ được gửi.' });
      }

      const otp = generateOtp();
      const otpHash = hashOtp(email, type, otp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: dbError } = await supabaseAdmin
        .from('otp_tokens')
        .upsert([{ email, otp: otpHash, type, expires_at: expiresAt }], {
          onConflict: 'email,type',
        });

      if (dbError) throw dbError;

      await transporter.sendMail({
        from: `"Tibro App" <${GMAIL_USER}>`,
        to: email,
        subject: type === 'recovery' ? 'Đặt lại mật khẩu Tibro' : 'Xác nhận đăng ký Tibro',
        html: buildEmailHtml(otp, type),
      });

      return res.status(200).json({ success: true, message: 'Nếu email hợp lệ, mã OTP sẽ được gửi.' });
    } catch (error) {
      console.error('[sendOtp] Failed:', error?.message || error);
      return res.status(500).json({ error: 'Không thể gửi OTP. Vui lòng thử lại sau.' });
    }
  },
);

app.post(
  '/register',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
  async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const password = String(req.body.password || '');
    const username = String(req.body.username || '').trim();

    if (
      !isValidEmail(email)
      || !/^\d{6}$/.test(otp)
      || password.length < 8
      || password.length > 128
      || username.length < 3
      || username.length > 30
      || !/^[a-zA-Z0-9_.]+$/.test(username)
    ) {
      return res.status(400).json({ error: 'Dữ liệu đăng ký không hợp lệ.' });
    }

    const otpHash = hashOtp(email, 'signup', otp);
    const { data: validOtp, error: otpError } = await supabaseAdmin
      .from('otp_tokens')
      .select('email')
      .eq('email', email)
      .eq('otp', otpHash)
      .eq('type', 'signup')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (otpError || !validOtp) {
      return res.status(400).json({ error: 'Mã OTP không đúng hoặc đã hết hạn.' });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (authError || !authData.user) {
      const alreadyExists = /already|registered|exists/i.test(authError?.message || '');
      return res.status(alreadyExists ? 409 : 500).json({
        error: alreadyExists
          ? 'Email này đã được đăng ký.'
          : 'Không thể tạo tài khoản. Vui lòng thử lại.',
      });
    }

    const userId = authData.user.id;
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: userId,
      username,
      name: username,
      email,
      avatar: '',
    });

    if (profileError) {
      const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (rollbackError) {
        console.error('[register] Failed to roll back Auth user:', rollbackError.message);
      }

      const usernameTaken = profileError.code === '23505';
      return res.status(usernameTaken ? 409 : 500).json({
        error: usernameTaken
          ? 'Tên đăng nhập đã tồn tại.'
          : 'Không thể tạo hồ sơ người dùng. Vui lòng thử lại.',
      });
    }

    const { error: consumeError } = await supabaseAdmin
      .from('otp_tokens')
      .delete()
      .eq('email', email)
      .eq('otp', otpHash)
      .eq('type', 'signup');

    if (consumeError) {
      console.error('[register] Failed to consume OTP:', consumeError.message);
    }

    return res.status(201).json({ success: true, userId });
  },
);

app.post(
  '/verifyOtp',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
  async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const type = req.body.type || 'signup';

    if (!isValidEmail(email) || !/^\d{6}$/.test(otp) || !isValidOtpType(type)) {
      return res.status(400).json({ verified: false, error: 'Dữ liệu yêu cầu không hợp lệ.' });
    }

    const otpHash = hashOtp(email, type, otp);
    const { data, error } = await supabaseAdmin
      .from('otp_tokens')
      .select('email, expires_at')
      .eq('email', email)
      .eq('otp', otpHash)
      .eq('type', type)
      .maybeSingle();

    if (error || !data || new Date(data.expires_at).getTime() <= Date.now()) {
      return res.status(200).json({ verified: false, error: 'Mã OTP không đúng hoặc đã hết hạn.' });
    }

    return res.status(200).json({ verified: true });
  },
);

app.post(
  '/resetPassword',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }),
  async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)
      || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'Dữ liệu yêu cầu không hợp lệ.' });
    }

    const otpHash = hashOtp(email, 'recovery', otp);
    const { data: consumedOtp, error: consumeError } = await supabaseAdmin
      .from('otp_tokens')
      .delete()
      .eq('email', email)
      .eq('otp', otpHash)
      .eq('type', 'recovery')
      .gt('expires_at', new Date().toISOString())
      .select('email, expires_at')
      .maybeSingle();

    if (consumeError || !consumedOtp) {
      return res.status(400).json({ error: 'Mã OTP không đúng hoặc đã hết hạn.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Không thể đặt lại mật khẩu.' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('[resetPassword] Failed:', updateError.message);
      // A transient provider failure should not force the user to request a
      // second OTP. Restore the same still-unexpired hash for one retry.
      if (new Date(consumedOtp.expires_at).getTime() > Date.now()) {
        const { error: restoreError } = await supabaseAdmin.from('otp_tokens').upsert({
          email,
          otp: otpHash,
          type: 'recovery',
          expires_at: consumedOtp.expires_at,
        }, { onConflict: 'email,type' });
        if (restoreError) console.error('[resetPassword] Failed to restore OTP:', restoreError.message);
      }
      return res.status(500).json({ error: 'Không thể đặt lại mật khẩu.' });
    }

    return res.status(200).json({ success: true });
  },
);

if (require.main === module) {
  app.listen(PORT, () => console.log(`Tibro auth service listening on port ${PORT}`));
}

module.exports = app;
