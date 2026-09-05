import 'package:flutter/material.dart';
import '../main.dart';
import '../screens/login_screen.dart';
import 'users_screen.dart';
import 'reports_screen.dart';
import 'announcements_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;
  Map<String, int> _stats = {};
  bool _loadingStats = true;
  bool _maintenanceEnabled = false;
  String _maintenanceMessage = '';

  @override
  void initState() {
    super.initState();
    _loadStats();
    _loadMaintenance();
  }

  Future<void> _loadMaintenance() async {
    try {
      final data = await adminClient.from('system_config').select('value').eq('key', 'maintenance').single();
      final val = data['value'] as Map<String, dynamic>;
      setState(() {
        _maintenanceEnabled = val['enabled'] == true;
        _maintenanceMessage = val['message'] ?? '';
      });
    } catch (_) {}
  }

  Future<void> _toggleMaintenance() async {
    if (!_maintenanceEnabled) {
      final msgCtrl = TextEditingController(text: 'Hệ thống đang bảo trì, vui lòng quay lại sau.');
      final timeCtrl = TextEditingController(text: '30 phút');
      final confirm = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: const Color(0xFF1A1A2E),
          title: const Text('🔧 Bật chế độ bảo trì', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Người dùng sẽ không thể sử dụng app cho đến khi bạn tắt bảo trì.', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
            const SizedBox(height: 16),
            TextField(controller: msgCtrl, style: const TextStyle(color: Colors.white), maxLines: 3,
              decoration: const InputDecoration(labelText: 'Thông báo cho người dùng *', hintText: 'VD: Hệ thống đang bảo trì...', hintStyle: TextStyle(color: Color(0xFF9CA3AF)), alignLabelWithHint: true)),
            const SizedBox(height: 12),
            TextField(controller: timeCtrl, style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Thời gian ước tính', hintText: 'VD: 30 phút, 1 giờ...', hintStyle: TextStyle(color: Color(0xFF9CA3AF)))),
          ])),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
            ElevatedButton(onPressed: () => Navigator.pop(context, true), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B)),
              child: const Text('Bật bảo trì', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
          ],
        ),
      );
      if (confirm == true) {
        try {
          await adminClient.from('system_config').update({'value': {'enabled': true, 'message': msgCtrl.text.trim(), 'estimated_time': timeCtrl.text.trim()}, 'updated_at': DateTime.now().toIso8601String()}).eq('key', 'maintenance');
          setState(() { _maintenanceEnabled = true; _maintenanceMessage = msgCtrl.text.trim(); });
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('🔧 Đã bật chế độ bảo trì'), backgroundColor: Color(0xFFF59E0B)));
        } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red)); }
      }
    } else {
      final confirm = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text('Tắt chế độ bảo trì?', style: TextStyle(color: Colors.white)),
        content: const Text('Người dùng sẽ có thể sử dụng app bình thường trở lại.', style: TextStyle(color: Color(0xFF9CA3AF))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            child: const Text('Tắt bảo trì', style: TextStyle(color: Colors.white))),
        ],
      ));
      if (confirm == true) {
        try {
          await adminClient.from('system_config').update({'value': {'enabled': false, 'message': '', 'estimated_time': ''}, 'updated_at': DateTime.now().toIso8601String()}).eq('key', 'maintenance');
          setState(() { _maintenanceEnabled = false; _maintenanceMessage = ''; });
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Đã tắt chế độ bảo trì'), backgroundColor: Colors.green));
        } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red)); }
      }
    }
  }

  Future<void> _loadStats() async {
    try {
      final userRes = await adminClient.from('users').select('id');
      final pendingRes = await adminClient.from('reports').select('id').eq('status', 'pending');
      final totalRes = await adminClient.from('reports').select('id');

      setState(() {
        _stats = {
          'users': (userRes as List).length,
          'pending_reports': (pendingRes as List).length,
          'total_reports': (totalRes as List).length,
        };
        _loadingStats = false;
      });
    } catch (e) {
      setState(() => _loadingStats = false);
    }
  }

  Future<void> _logout() async {
    await supabase.auth.signOut();
    if (mounted) {
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  Widget _buildDashboardHome() {
    return RefreshIndicator(
      onRefresh: () async { await _loadStats(); await _loadMaintenance(); },
      color: const Color(0xFF6366F1),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  const Icon(Icons.admin_panel_settings_rounded, color: Colors.white, size: 36),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Tibro Admin Panel', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                      Text(supabase.auth.currentUser?.email ?? '', style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            const Text('Tổng quan', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),

            // Stats grid
            if (_loadingStats)
              const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
            else
              Row(
                children: [
                  Expanded(child: _StatCard(icon: Icons.people_rounded, label: 'Người dùng', value: _stats['users'] ?? 0, color: const Color(0xFF6366F1))),
                  const SizedBox(width: 12),
                  Expanded(child: _StatCard(icon: Icons.flag_rounded, label: 'Kiếu nại chờ', value: _stats['pending_reports'] ?? 0, color: const Color(0xFFEF4444))),
                ],
              ),
            const SizedBox(height: 12),
            _StatCardWide(icon: Icons.report_rounded, label: 'Tổng kiếu nại', value: _stats['total_reports'] ?? 0, color: const Color(0xFFF59E0B)),

            const SizedBox(height: 28),
            const Text('Truy cập nhanh', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),

            //  Nút Bảo trì hệ thống
            GestureDetector(
              onTap: _toggleMaintenance,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _maintenanceEnabled ? const Color(0xFFF59E0B).withOpacity(0.12) : const Color(0xFF1A1A2E),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _maintenanceEnabled ? const Color(0xFFF59E0B) : const Color(0xFF2D2D4E)),
                ),
                child: Row(children: [
                  Container(width: 44, height: 44, decoration: BoxDecoration(color: _maintenanceEnabled ? const Color(0xFFF59E0B).withOpacity(0.2) : const Color(0xFF6366F1).withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
                    child: Icon(_maintenanceEnabled ? Icons.build_circle_rounded : Icons.build_rounded, color: _maintenanceEnabled ? const Color(0xFFF59E0B) : const Color(0xFF6366F1), size: 24)),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_maintenanceEnabled ? 'Đang bảo trì' : 'Bảo trì hệ thống', style: TextStyle(color: _maintenanceEnabled ? const Color(0xFFF59E0B) : Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(_maintenanceEnabled ? 'Nhấn để tắt chế độ bảo trì' : 'Nhấn để bật chế độ bảo trì', style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                  ])),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: _maintenanceEnabled ? const Color(0xFFF59E0B).withOpacity(0.2) : Colors.green.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                    child: Text(_maintenanceEnabled ? 'BẬT' : 'TẮT', style: TextStyle(color: _maintenanceEnabled ? const Color(0xFFF59E0B) : Colors.green, fontSize: 11, fontWeight: FontWeight.w800))),
                ]),
              ),
            ),
            const SizedBox(height: 12),

            _QuickAction(
              icon: Icons.manage_accounts_rounded,
              title: 'Quản lý người dùng',
              subtitle: 'Xem, chỉnh sửa, xóa tài khoản',
              color: const Color(0xFF6366F1),
              onTap: () => setState(() => _currentIndex = 1),
            ),
            const SizedBox(height: 12),
            _QuickAction(
              icon: Icons.flag_rounded,
              title: 'Duyệt kiếu nại',
              subtitle: '${_stats['pending_reports'] ?? 0} đang chờ xử lý',
              color: const Color(0xFFEF4444),
              onTap: () => setState(() => _currentIndex = 2),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      _buildDashboardHome(),
      const UsersScreen(),
      const ReportsScreen(),
      const AnnouncementsScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _currentIndex == 0 ? 'Dashboard' : _currentIndex == 1 ? 'Người dùng' : _currentIndex == 2 ? 'Kiếu nại' : 'Thông báo',
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
        ),
        actions: [
          if (_currentIndex == 0)
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: _loadStats,
            ),
          PopupMenuButton(
            icon: const Icon(Icons.more_vert),
            itemBuilder: (_) => [
              PopupMenuItem(value: 'logout', child: Row(
                children: const [Icon(Icons.logout, size: 18, color: Colors.red), SizedBox(width: 8), Text('Đăng xuất', style: TextStyle(color: Colors.red))],
              )),
            ],
            onSelected: (v) { if (v == 'logout') _logout(); },
          ),
        ],
      ),
      body: IndexedStack(index: _currentIndex, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) {
          setState(() => _currentIndex = i);
          // Tự động tải lại thống kê khi chuyển qua lại các tab
          if (i == 0 || i == 2) _loadStats();
        },
        backgroundColor: const Color(0xFF1A1A2E),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded), label: 'Dashboard'),
          const NavigationDestination(icon: Icon(Icons.people_outline_rounded), selectedIcon: Icon(Icons.people_rounded), label: 'Người dùng'),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: (_stats['pending_reports'] ?? 0) > 0,
              label: Text('${_stats['pending_reports'] ?? 0}'),
              child: const Icon(Icons.flag_outlined),
            ),
            selectedIcon: const Icon(Icons.flag_rounded),
            label: 'Kiếu nại',
          ),
          const NavigationDestination(icon: Icon(Icons.campaign_outlined), selectedIcon: Icon(Icons.campaign_rounded), label: 'Thông báo'),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final int value;
  final Color color;
  const _StatCard({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 10),
            Text('$value', style: TextStyle(color: color, fontSize: 28, fontWeight: FontWeight.w800)),
            Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _StatCardWide extends StatelessWidget {
  final IconData icon;
  final String label;
  final int value;
  final Color color;
  const _StatCardWide({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(width: 14),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('$value', style: TextStyle(color: color, fontSize: 26, fontWeight: FontWeight.w800)),
              Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
            ]),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.title, required this.subtitle, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        onTap: onTap,
        leading: Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: color, size: 24),
        ),
        title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15)),
        subtitle: Text(subtitle, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
        trailing: const Icon(Icons.chevron_right_rounded, color: Color(0xFF9CA3AF)),
      ),
    );
  }
}
