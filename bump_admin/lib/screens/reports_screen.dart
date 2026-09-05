import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../main.dart';
import 'report_detail_screen.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _all = [];
  bool _loading = true;

  dynamic _subscription;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _tabCtrl.addListener(() => setState(() {}));
    _loadReports();

    // Lắng nghe realtime khi có report mới (cú pháp chuẩn Flutter v2)
    _subscription = supabase
        .channel('public:reports')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'reports',
          callback: (payload) {
            _loadReports();
          },
        )
        .subscribe();
  }

  @override
  void dispose() {
    _subscription?.unsubscribe();
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadReports() async {
    setState(() => _loading = true);
    try {
      final data = await supabase
          .from('reports')
          .select('*, reporter:users!reporter_id(id, name, avatar), reported_user:users!reported_user_id(id, name, avatar)')
          .order('created_at', ascending: false);
      setState(() {
        _all = List<Map<String, dynamic>>.from(data);
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi tải kiếu nại: $e'), backgroundColor: Colors.red),
      );
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_tabCtrl.index == 0) return _all;
    if (_tabCtrl.index == 1) return _all.where((r) => r['status'] == 'pending').toList();
    return _all.where((r) => r['status'] != 'pending').toList();
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
      case 'rejected': return 'Đã từ chối';
      default: return s ?? 'Không rõ';
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
    return Column(
      children: [
        // Tabs
        Container(
          color: const Color(0xFF1A1A2E),
          child: TabBar(
            controller: _tabCtrl,
            labelColor: const Color(0xFF6366F1),
            unselectedLabelColor: const Color(0xFF9CA3AF),
            indicatorColor: const Color(0xFF6366F1),
            labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            tabs: [
              Tab(text: 'Tất cả (${_all.length})'),
              Tab(text: 'Chờ duyệt (${_all.where((r) => r['status'] == 'pending').length})'),
              Tab(text: 'Đã xử lý (${_all.where((r) => r['status'] != 'pending').length})'),
            ],
          ),
        ),

        // Refresh row
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Row(
            children: [
              Text('${_filtered.length} kiếu nại', style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
              const Spacer(),
              TextButton.icon(
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Tải lại'),
                onPressed: _loadReports,
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF6366F1)),
              ),
            ],
          ),
        ),

        // List
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
              : _filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text('🎉', style: TextStyle(fontSize: 48)),
                          const SizedBox(height: 12),
                          Text(
                            _tabCtrl.index == 1 ? 'Không có kiếu nại chờ duyệt' : 'Chưa có kiếu nại nào',
                            style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 15),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadReports,
                      color: const Color(0xFF6366F1),
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        itemCount: _filtered.length,
                        itemBuilder: (_, i) {
                          final r = _filtered[i];
                          final reporter = r['reporter'] as Map<String, dynamic>?;
                          final reported = r['reported_user'] as Map<String, dynamic>?;
                          final status = r['status'] as String?;
                          final isPending = status == 'pending';

                          return Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: () async {
                                final changed = await Navigator.push<bool>(
                                  context,
                                  MaterialPageRoute(builder: (_) => ReportDetailScreen(report: r)),
                                );
                                if (changed == true) _loadReports();
                              },
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Header: status + time
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: _statusColor(status).withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Icon(
                                                isPending ? Icons.hourglass_empty_rounded : status == 'approved' ? Icons.check_circle_rounded : Icons.cancel_rounded,
                                                size: 12,
                                                color: _statusColor(status),
                                              ),
                                              const SizedBox(width: 4),
                                              Text(_statusLabel(status), style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w700)),
                                            ],
                                          ),
                                        ),
                                        const Spacer(),
                                        Text(_formatDate(r['created_at']), style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11)),
                                        if (isPending) ...[
                                          const SizedBox(width: 6),
                                          Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFFF59E0B), shape: BoxShape.circle)),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 10),

                                    // Reason
                                    Text(
                                      r['reason'] ?? 'Không có lý do',
                                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    if ((r['description'] ?? '').isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(r['description'], style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
                                    ],
                                    const SizedBox(height: 10),

                                    // Reporter → Reported
                                    Row(
                                      children: [
                                        _MiniUser(label: 'Người gửi', user: reporter),
                                        const Padding(
                                          padding: EdgeInsets.symmetric(horizontal: 8),
                                          child: Icon(Icons.arrow_forward_rounded, color: Color(0xFF6366F1), size: 16),
                                        ),
                                        _MiniUser(label: 'Bị kiếu nại', user: reported, danger: true),
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
    );
  }
}

class _MiniUser extends StatelessWidget {
  final String label;
  final Map<String, dynamic>? user;
  final bool danger;
  const _MiniUser({required this.label, this.user, this.danger = false});

  @override
  Widget build(BuildContext context) {
    final name = user?['name'] ?? 'Không rõ';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    final color = danger ? const Color(0xFFEF4444) : const Color(0xFF6366F1);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 14,
          backgroundColor: color.withOpacity(0.2),
          child: Text(initial, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 10)),
            Text(name, style: TextStyle(color: danger ? const Color(0xFFEF4444) : Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ],
    );
  }
}
