import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../main.dart';
import 'user_detail_screen.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});
  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  List<Map<String, dynamic>> _users = [];
  List<Map<String, dynamic>> _filtered = [];
  bool _loading = true;
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadUsers();
    _searchCtrl.addListener(_onSearch);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    setState(() => _loading = true);
    try {
      final data = await supabase
          .from('users')
          .select('id, name, email, avatar, username, online_at, is_banned, created_at')
          .order('created_at', ascending: false);
      setState(() {
        _users = List<Map<String, dynamic>>.from(data);
        _filtered = _users;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red));
      }
    }
  }

  void _onSearch() {
    final q = _searchCtrl.text.toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? _users
          : _users.where((u) =>
              (u['name'] ?? '').toLowerCase().contains(q) ||
              (u['email'] ?? '').toLowerCase().contains(q)).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            controller: _searchCtrl,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Tìm kiếm theo tên, email...',
              hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
              prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF6366F1)),
              suffixIcon: _searchCtrl.text.isNotEmpty
                  ? IconButton(icon: const Icon(Icons.clear, color: Colors.grey), onPressed: () { _searchCtrl.clear(); })
                  : null,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),

        // Count
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(
            children: [
              Text('${_filtered.length} người dùng', style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
              const Spacer(),
              TextButton.icon(
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Tải lại'),
                onPressed: _loadUsers,
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
                  ? const Center(child: Text('Không tìm thấy người dùng', style: TextStyle(color: Color(0xFF9CA3AF))))
                  : RefreshIndicator(
                      onRefresh: _loadUsers,
                      color: const Color(0xFF6366F1),
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        itemCount: _filtered.length,
                        itemBuilder: (_, i) {
                          final user = _filtered[i];
                          return _UserTile(
                            user: user,
                            onTap: () async {
                              final updated = await Navigator.push<bool>(
                                context,
                                MaterialPageRoute(builder: (_) => UserDetailScreen(userId: user['id'], userData: user)),
                              );
                              if (updated == true) _loadUsers();
                            },
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}

class _UserTile extends StatelessWidget {
  final Map<String, dynamic> user;
  final VoidCallback onTap;
  const _UserTile({required this.user, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final name = user['name'] ?? 'Không tên';
    final email = user['email'] ?? '';
    final avatar = user['avatar'] as String?;
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    final isOnline = user['online_at'] != null && DateTime.now().difference(DateTime.parse(user['online_at'])).inMinutes < 5;
    final isBanned = user['is_banned'] == true;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: CircleAvatar(
          radius: 24,
          backgroundColor: isBanned ? Colors.red.withOpacity(0.2) : const Color(0xFF6366F1).withOpacity(0.2),
          backgroundImage: avatar != null ? CachedNetworkImageProvider(avatar) : null,
          child: avatar == null ? Text(initial, style: TextStyle(color: isBanned ? Colors.red : const Color(0xFF6366F1), fontWeight: FontWeight.w700)) : null,
        ),
        title: Row(
          children: [
            Expanded(child: Text(name, style: TextStyle(color: isBanned ? Colors.red.withOpacity(0.6) : Colors.white, fontWeight: FontWeight.w600, fontSize: 15, decoration: isBanned ? TextDecoration.lineThrough : null))),
            if (isBanned)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.red.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
                child: const Text('🚫 BAN', style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            if (isOnline && !isBanned)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.green.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
                child: const Text('🟢 Online', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
          ],
        ),
        subtitle: Text(email, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
        trailing: const Icon(Icons.chevron_right, color: Color(0xFF9CA3AF)),
      ),
    );
  }
}
