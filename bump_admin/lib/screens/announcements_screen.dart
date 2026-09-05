import 'package:flutter/material.dart';
import '../main.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});
  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  List<Map<String, dynamic>> _announcements = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadAnnouncements();
  }

  Future<void> _loadAnnouncements() async {
    setState(() => _loading = true);
    try {
      final data = await adminClient
          .from('system_announcements')
          .select('*, creator:created_by(id, name)')
          .order('created_at', ascending: false);
      setState(() {
        _announcements = List<Map<String, dynamic>>.from(data);
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _deleteAnnouncement(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text('Xóa thông báo', style: TextStyle(color: Colors.white)),
        content: const Text('Bạn có chắc muốn xóa thông báo này?', style: TextStyle(color: Color(0xFF9CA3AF))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Xóa', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await adminClient.from('system_announcements').delete().eq('id', id);
        _loadAnnouncements();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Đã xóa thông báo'), backgroundColor: Colors.green),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _toggleActive(String id, bool currentActive) async {
    try {
      await adminClient.from('system_announcements').update({'is_active': !currentActive}).eq('id', id);
      _loadAnnouncements();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showCreateDialog() {
    final titleCtrl = TextEditingController();
    final messageCtrl = TextEditingController();
    String selectedType = 'info';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF1A1A2E),
          title: const Text('📢 Gửi thông báo mới', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Type selector
                const Text('Loại thông báo', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    _TypeChip(label: 'ℹ️ Thông tin', value: 'info', selected: selectedType == 'info',
                        onTap: () => setDialogState(() => selectedType = 'info')),
                    _TypeChip(label: '⚠️ Cảnh báo', value: 'warning', selected: selectedType == 'warning',
                        onTap: () => setDialogState(() => selectedType = 'warning')),
                    _TypeChip(label: '🔄 Cập nhật', value: 'update', selected: selectedType == 'update',
                        onTap: () => setDialogState(() => selectedType = 'update')),
                    _TypeChip(label: '🎉 Sự kiện', value: 'event', selected: selectedType == 'event',
                        onTap: () => setDialogState(() => selectedType = 'event')),
                  ],
                ),
                const SizedBox(height: 16),

                // Title
                TextField(
                  controller: titleCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    labelText: 'Tiêu đề *',
                    hintText: 'VD: Bảo trì hệ thống...',
                    hintStyle: TextStyle(color: Color(0xFF9CA3AF)),
                  ),
                ),
                const SizedBox(height: 12),

                // Message
                TextField(
                  controller: messageCtrl,
                  style: const TextStyle(color: Colors.white),
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Nội dung *',
                    hintText: 'Nhập nội dung thông báo...',
                    hintStyle: TextStyle(color: Color(0xFF9CA3AF)),
                    alignLabelWithHint: true,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Hủy'),
            ),
            ElevatedButton.icon(
              onPressed: () async {
                if (titleCtrl.text.trim().isEmpty || messageCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Vui lòng nhập đủ tiêu đề và nội dung'), backgroundColor: Colors.orange),
                  );
                  return;
                }

                try {
                  final currentUser = supabase.auth.currentUser;
                  await adminClient.from('system_announcements').insert({
                    'title': titleCtrl.text.trim(),
                    'message': messageCtrl.text.trim(),
                    'type': selectedType,
                    'created_by': currentUser?.id,
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  _loadAnnouncements();
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('📢 Đã gửi thông báo đến tất cả người dùng!'), backgroundColor: Colors.green),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red),
                    );
                  }
                }
              },
              icon: const Icon(Icons.send_rounded),
              label: const Text('Gửi', style: TextStyle(fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _typeIcon(String? type) {
    switch (type) {
      case 'warning': return Icons.warning_amber_rounded;
      case 'update': return Icons.system_update_rounded;
      case 'event': return Icons.celebration_rounded;
      default: return Icons.info_outline_rounded;
    }
  }

  Color _typeColor(String? type) {
    switch (type) {
      case 'warning': return const Color(0xFFF59E0B);
      case 'update': return const Color(0xFF3B82F6);
      case 'event': return const Color(0xFF10B981);
      default: return const Color(0xFF6366F1);
    }
  }

  String _typeLabel(String? type) {
    switch (type) {
      case 'warning': return 'Cảnh báo';
      case 'update': return 'Cập nhật';
      case 'event': return 'Sự kiện';
      default: return 'Thông tin';
    }
  }

  String _formatDate(String? iso) {
    if (iso == null) return '';
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    return '${d.day}/${d.month}/${d.year} ${d.hour}:${d.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
          children: [
            // Header row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Text('${_announcements.length} thông báo', style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
                  const Spacer(),
                  TextButton.icon(
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('Tải lại'),
                    onPressed: _loadAnnouncements,
                    style: TextButton.styleFrom(foregroundColor: const Color(0xFF6366F1)),
                  ),
                ],
              ),
            ),

            // List
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
                  : _announcements.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text('📢', style: TextStyle(fontSize: 48)),
                              const SizedBox(height: 12),
                              const Text('Chưa có thông báo nào', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 15)),
                              const SizedBox(height: 8),
                              const Text('Nhấn nút + để tạo thông báo mới', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _loadAnnouncements,
                          color: const Color(0xFF6366F1),
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                            itemCount: _announcements.length,
                            itemBuilder: (_, i) {
                              final a = _announcements[i];
                              final type = a['type'] as String?;
                              final isActive = a['is_active'] == true;
                              final creator = a['creator'] as Map<String, dynamic>?;

                              return Card(
                                margin: const EdgeInsets.only(bottom: 10),
                                child: Opacity(
                                  opacity: isActive ? 1.0 : 0.5,
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        // Header
                                        Row(
                                          children: [
                                            Container(
                                              width: 36, height: 36,
                                              decoration: BoxDecoration(
                                                color: _typeColor(type).withOpacity(0.15),
                                                borderRadius: BorderRadius.circular(10),
                                              ),
                                              child: Icon(_typeIcon(type), color: _typeColor(type), size: 20),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    a['title'] ?? '',
                                                    style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Row(
                                                    children: [
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                                        decoration: BoxDecoration(
                                                          color: _typeColor(type).withOpacity(0.15),
                                                          borderRadius: BorderRadius.circular(6),
                                                        ),
                                                        child: Text(_typeLabel(type), style: TextStyle(color: _typeColor(type), fontSize: 10, fontWeight: FontWeight.w700)),
                                                      ),
                                                      const SizedBox(width: 6),
                                                      if (!isActive)
                                                        Container(
                                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                                          decoration: BoxDecoration(
                                                            color: Colors.grey.withOpacity(0.15),
                                                            borderRadius: BorderRadius.circular(6),
                                                          ),
                                                          child: const Text('Đã ẩn', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.w700)),
                                                        ),
                                                      const Spacer(),
                                                      Text(_formatDate(a['created_at']), style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 10)),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 10),

                                        // Message
                                        Text(
                                          a['message'] ?? '',
                                          style: const TextStyle(color: Color(0xFFD1D5DB), fontSize: 13, height: 1.5),
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                        ),

                                        // Footer
                                        const SizedBox(height: 10),
                                        Row(
                                          children: [
                                            if (creator != null)
                                              Text('bởi ${creator['name'] ?? 'Admin'}', style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11)),
                                            const Spacer(),
                                            // Toggle active
                                            IconButton(
                                              icon: Icon(
                                                isActive ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                                                size: 18,
                                                color: isActive ? const Color(0xFF10B981) : Colors.grey,
                                              ),
                                              onPressed: () => _toggleActive(a['id'], isActive),
                                              tooltip: isActive ? 'Ẩn thông báo' : 'Hiện thông báo',
                                              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                                            ),
                                            // Delete
                                            IconButton(
                                              icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
                                              onPressed: () => _deleteAnnouncement(a['id']),
                                              tooltip: 'Xóa thông báo',
                                              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),

        // FAB
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton(
            onPressed: _showCreateDialog,
            backgroundColor: const Color(0xFF6366F1),
            child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
          ),
        ),
      ],
    );
  }
}

class _TypeChip extends StatelessWidget {
  final String label;
  final String value;
  final bool selected;
  final VoidCallback onTap;
  const _TypeChip({required this.label, required this.value, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: selected ? const Color(0xFF6366F1).withOpacity(0.2) : Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: selected ? const Color(0xFF6366F1) : const Color(0xFF2D2D4E)),
      ),
      child: Text(label, style: TextStyle(color: selected ? const Color(0xFF6366F1) : const Color(0xFF9CA3AF), fontSize: 12, fontWeight: FontWeight.w600)),
    ),
  );
}
