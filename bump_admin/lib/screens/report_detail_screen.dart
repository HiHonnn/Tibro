import 'package:flutter/material.dart';
import '../main.dart';

class ReportDetailScreen extends StatefulWidget {
  final Map<String, dynamic> report;
  const ReportDetailScreen({super.key, required this.report});
  @override
  State<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends State<ReportDetailScreen> {
  bool _processing = false;
  late String _status;
  String? _adminNote;
  final _noteCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _status = widget.report['status'] ?? 'pending';
    _adminNote = widget.report['admin_note'];
    _noteCtrl.text = _adminNote ?? '';
  }

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _updateStatus(String newStatus) async {
    setState(() => _processing = true);
    try {
      // Cập nhật trạng thái report
      await adminClient.from('reports').update({
        'status': newStatus,
        'admin_note': _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
        'resolved_at': DateTime.now().toIso8601String(),
      }).eq('id', widget.report['id']);

      // ✅ Nếu DUYỆT → BAN người bị báo cáo
      if (newStatus == 'approved') {
        final reportedUserId = widget.report['reported_user_id'];
        if (reportedUserId != null) {
          await adminClient.from('users').update({
            'is_banned': true,
          }).eq('id', reportedUserId);
        }
      }

      setState(() { _status = newStatus; _processing = false; });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(newStatus == 'approved'
              ? '✅ Đã duyệt — Người dùng bị báo cáo đã bị BAN'
              : '❌ Đã từ chối kiếu nại'),
          backgroundColor: newStatus == 'approved' ? Colors.green : Colors.red,
        ));
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _processing = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red));
    }
  }

  String _formatDate(String? iso) {
    if (iso == null) return 'Không rõ';
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    return '${d.day}/${d.month}/${d.year}  ${d.hour}:${d.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final reporter = widget.report['reporter'] as Map<String, dynamic>?;
    final reported = widget.report['reported_user'] as Map<String, dynamic>?;
    final isPending = _status == 'pending';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết kiếu nại', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _statusColor(_status).withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(_statusLabel(_status), style: TextStyle(color: _statusColor(_status), fontWeight: FontWeight.w700, fontSize: 13)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Người liên quan
            _SectionTitle('Người liên quan'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _UserCard(title: '👤 Người gửi kiếu nại', user: reporter)),
                const SizedBox(width: 10),
                Expanded(child: _UserCard(title: '⚠️ Bị kiếu nại', user: reported, danger: true)),
              ],
            ),
            const SizedBox(height: 20),

            // Nội dung kiếu nại
            _SectionTitle('Nội dung kiếu nại'),
            const SizedBox(height: 12),
            _InfoBox(label: 'Lý do', value: widget.report['reason'] ?? 'Không có lý do'),
            if ((widget.report['description'] ?? '').isNotEmpty)
              _InfoBox(label: 'Mô tả chi tiết', value: widget.report['description']),
            _InfoBox(label: 'Ngày gửi', value: _formatDate(widget.report['created_at'])),
            if (widget.report['resolved_at'] != null)
              _InfoBox(label: 'Ngày xử lý', value: _formatDate(widget.report['resolved_at'])),

            // Admin note
            const SizedBox(height: 20),
            _SectionTitle('Ghi chú của admin'),
            const SizedBox(height: 12),
            TextField(
              controller: _noteCtrl,
              enabled: isPending,
              maxLines: 4,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: isPending ? 'Nhập ghi chú xử lý...' : (_adminNote ?? 'Không có ghi chú'),
                hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                alignLabelWithHint: true,
              ),
            ),

            // Actions
            if (isPending) ...[
              const SizedBox(height: 28),
              _SectionTitle('Hành động'),
              const SizedBox(height: 12),
              Row(
                children: [
                  // Approve
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _processing ? null : () => _confirmAction('approved'),
                      icon: _processing
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.check_circle_rounded),
                      label: const Text('Duyệt', style: TextStyle(fontWeight: FontWeight.w700)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Reject
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _processing ? null : () => _confirmAction('rejected'),
                      icon: const Icon(Icons.cancel_rounded),
                      label: const Text('Từ chối', style: TextStyle(fontWeight: FontWeight.w700)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEF4444),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ] else ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _statusColor(_status).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _statusColor(_status).withOpacity(0.25)),
                ),
                child: Row(
                  children: [
                    Icon(_status == 'approved' ? Icons.check_circle_rounded : Icons.cancel_rounded, color: _statusColor(_status)),
                    const SizedBox(width: 10),
                    Text(
                      _status == 'approved' ? 'Kiếu nại đã được duyệt' : 'Kiếu nại đã bị từ chối',
                      style: TextStyle(color: _statusColor(_status), fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmAction(String action) async {
    final label = action == 'approved' ? 'duyệt' : 'từ chối';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: Text('Xác nhận $label kiếu nại', style: const TextStyle(color: Colors.white)),
        content: Text('Bạn có chắc muốn $label kiếu nại này?', style: const TextStyle(color: Color(0xFF9CA3AF))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: action == 'approved' ? const Color(0xFF10B981) : const Color(0xFFEF4444),
            ),
            child: Text(action == 'approved' ? 'Duyệt' : 'Từ chối', style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm == true) _updateStatus(action);
  }

  Color _statusColor(String? s) {
    switch (s) {
      case 'pending': return const Color(0xFFF59E0B);
      case 'approved': return const Color(0xFF10B981);
      case 'rejected': return const Color(0xFFEF4444);
      default: return Colors.grey;
    }
  }

  String _statusLabel(String? s) {
    switch (s) {
      case 'pending': return 'Chờ duyệt';
      case 'approved': return 'Đã duyệt';
      case 'rejected': return 'Từ chối';
      default: return s ?? '';
    }
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);
  @override
  Widget build(BuildContext context) => Text(text, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700));
}

class _UserCard extends StatelessWidget {
  final String title;
  final Map<String, dynamic>? user;
  final bool danger;
  const _UserCard({required this.title, this.user, this.danger = false});

  @override
  Widget build(BuildContext context) {
    final name = user?['name'] ?? 'Không rõ';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    final color = danger ? const Color(0xFFEF4444) : const Color(0xFF6366F1);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11)),
            const SizedBox(height: 8),
            CircleAvatar(radius: 22, backgroundColor: color.withOpacity(0.2),
              child: Text(initial, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 18)),
            ),
            const SizedBox(height: 6),
            Text(name, style: TextStyle(color: danger ? const Color(0xFFEF4444) : Colors.white, fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

class _InfoBox extends StatelessWidget {
  final String label;
  final String value;
  const _InfoBox({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFF1A1A2E),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFF2D2D4E)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11, fontWeight: FontWeight.w600)),
      const SizedBox(height: 4),
      Text(value, style: const TextStyle(color: Colors.white, fontSize: 14)),
    ]),
  );
}
