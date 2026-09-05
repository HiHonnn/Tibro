import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';

const String _adminSupabaseUrl = String.fromEnvironment('SUPABASE_URL');
const String _appSupabaseUrl = String.fromEnvironment('EXPO_PUBLIC_SUPABASE_URL');
final String supabaseUrl =
    _adminSupabaseUrl.isNotEmpty ? _adminSupabaseUrl : _appSupabaseUrl;

const String _adminSupabaseKey = String.fromEnvironment('SUPABASE_ANON_KEY');
const String _appSupabaseKey =
    String.fromEnvironment('EXPO_PUBLIC_SUPABASE_ANON_KEY');
final String supabaseKey =
    _adminSupabaseKey.isNotEmpty ? _adminSupabaseKey : _appSupabaseKey;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (supabaseUrl.isEmpty || supabaseKey.isEmpty) {
    runApp(
      const AdminStartupErrorApp(
        message:
            'Thiếu cấu hình Supabase. Hãy chạy lại bằng --dart-define-from-file=../.env',
      ),
    );
    return;
  }
  try {
    await Supabase.initialize(url: supabaseUrl, anonKey: supabaseKey);
  } catch (error) {
    runApp(AdminStartupErrorApp(message: 'Không thể khởi tạo Supabase: $error'));
    return;
  }
  runApp(const BumpAdminApp());
}

class AdminStartupErrorApp extends StatelessWidget {
  const AdminStartupErrorApp({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFF0F0F1A),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    color: Colors.amber, size: 48),
                const SizedBox(height: 16),
                const Text(
                  'Tibro Admin chưa thể khởi động',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  style: const TextStyle(color: Color(0xFFCBD5E1)),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Cả xác thực và thao tác quản trị đều chạy bằng JWT của admin.
// Quyền quản trị phải được kiểm tra bằng RLS/backend, không ship service_role key.
final supabase = Supabase.instance.client;
final adminClient = supabase;

class BumpAdminApp extends StatelessWidget {
  const BumpAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Bump Admin',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1),
          brightness: Brightness.dark,
          background: const Color(0xFF0F0F1A),
          surface: const Color(0xFF1A1A2E),
          primary: const Color(0xFF6366F1),
        ),
        useMaterial3: true,
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        scaffoldBackgroundColor: const Color(0xFF0F0F1A),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1A1A2E),
          foregroundColor: Colors.white,
          elevation: 0,
          centerTitle: false,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1A1A2E),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF2D2D4E), width: 1),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1A1A2E),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF2D2D4E)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF2D2D4E)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF6366F1), width: 2),
          ),
          labelStyle: const TextStyle(color: Color(0xFF9CA3AF)),
        ),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});
  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _checking = true;
  bool _isAdmin = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkSession());
  }

  Future<void> _checkSession() async {
    if (mounted) {
      setState(() {
        _checking = true;
        _error = null;
      });
    }

    var isAdmin = false;
    try {
      final session = supabase.auth.currentSession;
      if (session != null) {
        final admin = await supabase
            .from('admins')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle()
            .timeout(const Duration(seconds: 15));
        isAdmin = admin != null;
        if (!isAdmin) await supabase.auth.signOut();
      }
    } catch (error, stackTrace) {
      debugPrint('[admin] Cannot restore session: $error');
      debugPrintStack(stackTrace: stackTrace);
      try {
        await supabase.auth.signOut();
      } catch (_) {}
      if (mounted) {
        setState(() => _error = 'Không thể kiểm tra phiên đăng nhập. Hãy thử lại.');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isAdmin = isAdmin;
          _checking = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.redAccent, size: 42),
              const SizedBox(height: 12),
              Text(_error!),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _checkSession,
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    return _isAdmin ? const DashboardScreen() : const LoginScreen();
  }
}
