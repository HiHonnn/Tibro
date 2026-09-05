import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../main.dart';

class UserDetailScreen extends StatefulWidget {
  final String userId;
  final Map<String, dynamic> userData;
  const UserDetailScreen({super.key, required this.userId, required this.userData});

  @override
  State<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends State<UserDetailScreen> {
  late TextEditingController _nameCtrl;
  late TextEditingController _emailCtrl;
  bool _saving = false;
  bool _modified = false;
  Map<String, dynamic> _user = {};

  // --- Activity data ---
  bool _loadingActivity = true;
  int _totalMessages = 0;
  int _totalConversations = 0;
  int _totalFriends = 0;
  int _totalReports = 0;        // Số lần bị báo cáo
  int _totalReportsSent = 0;    // Số lần gửi báo cáo
  List<Map<String, dynamic>> _recentReports = [];
  String? _lastOnline;

  @override
  void initState() {
    super.initState();
    _user = Map.from(widget.userData);
    _nameCtrl = TextEditingController(text: _user['name'] ?? '');
    _emailCtrl = TextEditingController(text: _user['email'] ?? '');
    _nameCtrl.addListener(() => setState(() => _modified = true));
    _loadActivityData();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadActivityData() async {
    try {
      final uid = widget.userId;

      // Tổng tin nhắn đã gửi
      final msgs = await adminClient.from('messages').select('id').eq('sender_id', uid);
      _totalMessages = (msgs as List).length;

      // Tổng cuộc trò chuyện tham gia
      final convs = await adminClient.from('conversations').select('id').or('user1_id.eq.$uid,user2_id.eq.$uid');
      _totalConversations = (convs as List).length;

      // Tổng bạn bè
      final friends = await adminClient
          .from('friends')
          .select('id')
          .or('requester_id.eq.$uid,receiver_id.eq.$uid')
          .eq('status', 'accepted');
      _totalFriends = (friends as List).length;

      // Số lần bị người khác báo cáo
      final reported = await adminClient.from('reports').select('id').eq('reported_user_id', uid);
      _totalReports = (reported as List).length;

      // Số lần tự gửi báo cáo
      final sentReports = await adminClient.from('reports').select('id').eq('reporter_id', uid);
      _totalReportsSent = (sentReports as List).length;

      // Các báo cáo gần đây (bị báo cáo)
      final recentRep = await adminClient
          .from('reports')
          .select('id, reason, description, status, created_at, reporter_id')
          .eq('reported_user_id', uid)
          .order('created_at', ascending: false)
          .limit(5);
      _recentReports = List<Map<String, dynamic>>.from(recentRep);

      // Online cuối
      _lastOnline = _user['online_at'] as String?;

      if (mounted) setState(() => _loadingActivity = false);
    } catch (e) {
      debugPrint('Load activity error: $e');
      if (mounted) setState(() => _loadingActivity = false);
    }
  }

  Future<void> _saveChanges() async {
    setState(() => _saving = true);
    try {
      await adminClient.from('users').update({'name': _nameCtrl.text.trim()}).eq('id', widget.userId);
      setState(() { _modified = false; _saving = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Đã lưu thay đổi'), backgroundColor: Colors.green));
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red));
    }
  }

  String _formatDate(String? iso) {
    if (iso == null) return 'Không rõ';
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    return '${d.day}/${d.month}/${d.year}';
  }

  String _formatDateTime(String? iso) {
    if (iso == null) return 'Chưa bao giờ';
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  String _timeAgo(String? iso) {
    if (iso == null) return 'Chưa bao giờ';
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 5) return 'Đang online';
    if (diff.inMinutes < 60) return '${diff.inMinutes} phút trước';
    if (diff.inHours < 24) return '${diff.inHours} giờ trước';
    if (diff.inDays < 30) return '${diff.inDays} ngày trước';
    return _formatDate(iso);
  }

  Future<void> _toggleBan() async {
    final isBanned = _user['is_banned'] == true;
    final action = isBanned ? 'gỡ BAN' : 'BAN';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: Text('Xác nhận $action', style: const TextStyle(color: Colors.white)),
        content: Text('Bạn có chắc muốn $action người dùng "${_user['name']}"?', style: const TextStyle(color: Color(0xFF9CA3AF))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: isBanned ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
            child: Text(action, style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await adminClient.from('users').update({'is_banned': !isBanned}).eq('id', widget.userId);
        setState(() => _user['is_banned'] = !isBanned);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(isBanned ? '✅ Đã gỡ BAN người dùng' : '🚫 Đã BAN người dùng'),
            backgroundColor: isBanned ? Colors.green : Colors.red,
          ));
        }
      } catch (e) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = _user['name'] ?? 'Không tên';
    final avatar = _user['avatar'] as String?;
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết người dùng', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          if (_modified)
            TextButton.icon(
              icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check_rounded),
              label: const Text('Lưu'),
              onPressed: _saving ? null : _saveChanges,
              style: TextButton.styleFrom(foregroundColor: Colors.white),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ========== AVATAR + BASIC INFO ==========
            Center(
              child: Column(children: [
                CircleAvatar(
                  radius: 48,
                  backgroundColor: const Color(0xFF6366F1).withOpacity(0.2),
                  backgroundImage: avatar != null ? CachedNetworkImageProvider(avatar) : null,
                  child: avatar == null ? Text(initial, style: const TextStyle(color: Color(0xFF6366F1), fontSize: 32, fontWeight: FontWeight.w800)) : null,
                ),
                const SizedBox(height: 14),
                Text(name, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                Text(_user['email'] ?? '', style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14)),
                const SizedBox(height: 8),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  _InfoChip(label: '📅 Tham gia ${_formatDate(_user['created_at'])}'),
                  if (_user['is_banned'] == true) ...[
                    const SizedBox(width: 6),
                    const _InfoChip(label: '🚫 BAN', color: Colors.red),
                  ],
                ]),
                const SizedBox(height: 4),
                _InfoChip(
                  label: '🟢 ${_timeAgo(_lastOnline ?? _user['online_at'])}',
                  color: _timeAgo(_lastOnline ?? _user['online_at']) == 'Đang online' ? Colors.green : const Color(0xFF9CA3AF),
                ),
              ]),
            ),
            const SizedBox(height: 24),

            // ========== ACTIVITY STATS ==========
            const _SectionTitle('📊 Thống kê hoạt động'),
            const SizedBox(height: 12),
            if (_loadingActivity)
              const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: Color(0xFF6366F1))))
            else ...[
              Row(children: [
                Expanded(child: _ActivityCard(icon: Icons.chat_bubble_outline, label: 'Tin nhắn', value: '$_totalMessages', color: const Color(0xFF6366F1))),
                const SizedBox(width: 10),
                Expanded(child: _ActivityCard(icon: Icons.forum_outlined, label: 'Đoạn chat', value: '$_totalConversations', color: const Color(0xFF3B82F6))),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: _ActivityCard(icon: Icons.people_outline, label: 'Bạn bè', value: '$_totalFriends', color: const Color(0xFF10B981))),
                const SizedBox(width: 10),
                Expanded(child: _ActivityCard(icon: Icons.flag_outlined, label: 'Bị báo cáo', value: '$_totalReports', color: _totalReports > 0 ? const Color(0xFFEF4444) : const Color(0xFF9CA3AF))),
              ]),
              const SizedBox(height: 10),
              _ActivityCard(icon: Icons.send_outlined, label: 'Đã gửi báo cáo', value: '$_totalReportsSent', color: const Color(0xFFF59E0B)),
            ],
            const SizedBox(height: 24),

            // ========== RISK ASSESSMENT ==========
            const _SectionTitle('⚠️ Đánh giá rủi ro'),
            const SizedBox(height: 12),
            _buildRiskCard(),
            const SizedBox(height: 24),

            // ========== RECENT REPORTS ==========
            if (_recentReports.isNotEmpty) ...[
              const _SectionTitle('🚩 Báo cáo gần đây'),
              const SizedBox(height: 12),
              ..._recentReports.map((r) => _buildReportItem(r)),
              const SizedBox(height: 24),
            ],

            // ========== BAN / UNBAN ==========
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: () => _toggleBan(),
                icon: Icon(_user['is_banned'] == true ? Icons.lock_open_rounded : Icons.block_rounded),
                label: Text(
                  _user['is_banned'] == true ? 'Gỡ BAN người dùng' : 'BAN người dùng này',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _user['is_banned'] == true ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ========== EDIT SECTION ==========
            const _SectionTitle('✏️ Chỉnh sửa thông tin'),
            const SizedBox(height: 12),
            const _FieldLabel('Tên hiển thị'),
            TextField(
              controller: _nameCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(hintText: 'Nhập tên mới...', hintStyle: TextStyle(color: Color(0xFF9CA3AF)), prefixIcon: Icon(Icons.person_outline, color: Color(0xFF6366F1))),
            ),
            const SizedBox(height: 12),
            const _FieldLabel('Email (chỉ đọc)'),
            TextField(
              controller: _emailCtrl,
              enabled: false,
              style: const TextStyle(color: Color(0xFF9CA3AF)),
              decoration: const InputDecoration(prefixIcon: Icon(Icons.email_outlined, color: Color(0xFF9CA3AF))),
            ),
            const SizedBox(height: 24),

            // ========== SYSTEM INFO ==========
            const _SectionTitle('🔧 Thông tin hệ thống'),
            const SizedBox(height: 12),
            _InfoRow(label: 'User ID', value: widget.userId),
            _InfoRow(label: 'Ngày tạo', value: _formatDate(_user['created_at'])),
            _InfoRow(label: 'Online lần cuối', value: _formatDateTime(_user['online_at'])),
            const SizedBox(height: 24),

            // Save button
            if (_modified)
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _saving ? null : _saveChanges,
                  icon: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.save_rounded),
                  label: const Text('Lưu thay đổi', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ========== RISK ASSESSMENT CARD ==========
  Widget _buildRiskCard() {
    String level;
    Color color;
    String desc;
    IconData icon;

    if (_totalReports >= 5) {
      level = 'CAO';
      color = const Color(0xFFEF4444);
      desc = 'Người dùng bị báo cáo nhiều lần. Cân nhắc BAN.';
      icon = Icons.dangerous_rounded;
    } else if (_totalReports >= 2) {
      level = 'TRUNG BÌNH';
      color = const Color(0xFFF59E0B);
      desc = 'Cần theo dõi thêm trước khi ra quyết định.';
      icon = Icons.warning_amber_rounded;
    } else {
      level = 'THẤP';
      color = const Color(0xFF10B981);
      desc = 'Không có dấu hiệu vi phạm nghiêm trọng.';
      icon = Icons.verified_user_rounded;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(14)),
          child: Icon(icon, color: color, size: 28),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('Mức rủi ro: ', style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: color.withOpacity(0.2), borderRadius: BorderRadius.circular(6)),
              child: Text(level, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w800)),
            ),
          ]),
          const SizedBox(height: 4),
          Text(desc, style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
        ])),
      ]),
    );
  }

  // ========== REPORT ITEM ==========
  Widget _buildReportItem(Map<String, dynamic> report) {
    final status = report['status'] ?? 'pending';
    Color statusColor;
    String statusLabel;
    if (status == 'resolved') {
      statusColor = const Color(0xFF10B981);
      statusLabel = 'Đã xử lý';
    } else if (status == 'dismissed') {
      statusColor = const Color(0xFF9CA3AF);
      statusLabel = 'Bỏ qua';
    } else {
      statusColor = const Color(0xFFF59E0B);
      statusLabel = 'Đang chờ';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2D2D4E)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.flag_rounded, color: Color(0xFFEF4444), size: 16),
          const SizedBox(width: 6),
          Expanded(child: Text(report['reason'] ?? 'Không rõ', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
            child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        ]),
        if (report['description'] != null && (report['description'] as String).isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(report['description'], style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
        const SizedBox(height: 4),
        Text(_formatDateTime(report['created_at']), style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 11)),
      ]),
    );
  }
}

// ========== REUSABLE WIDGETS ==========

class _ActivityCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  const _ActivityCard({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF2D2D4E)),
      ),
      child: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.w800)),
          Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11)),
        ]),
      ]),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);
  @override
  Widget build(BuildContext context) => Text(text, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700));
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(text, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
  );
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: const Color(0xFF1A1A2E),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: const Color(0xFF2D2D4E)),
    ),
    child: Row(children: [
      Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
      const Spacer(),
      Flexible(child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 13), overflow: TextOverflow.ellipsis)),
    ]),
  );
}

class _InfoChip extends StatelessWidget {
  final String label;
  final Color color;
  const _InfoChip({required this.label, this.color = const Color(0xFF6366F1)});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 4),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: color.withOpacity(0.12),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
  );
}
