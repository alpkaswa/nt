import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';

const SUPABASE_CONFIG_KEY = 'boarding_school_supabase_config';

// Biến môi trường mặc định nếu được cung cấp qua .env
const ENV_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const ENV_SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export class SupabaseClientService {
  /**
   * Lấy cấu hình Supabase hiện tại (kết hợp .env và cấu hình đã lưu trong app)
   */
  static getConfig(): SupabaseConfig {
    try {
      const stored = localStorage.getItem(SUPABASE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          url: parsed.url || ENV_SUPABASE_URL,
          anonKey: parsed.anonKey || ENV_SUPABASE_ANON_KEY,
          isConnected: parsed.isConnected ?? false,
          lastPing: parsed.lastPing,
          error: parsed.error,
        };
      }
    } catch {
      // ignore
    }

    return {
      url: ENV_SUPABASE_URL,
      anonKey: ENV_SUPABASE_ANON_KEY,
      isConnected: false,
    };
  }

  /**
   * Lưu cấu hình Supabase vào bộ nhớ máy
   */
  static saveConfig(config: SupabaseConfig) {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
    // Đặt lại client cached để khởi tạo lại
    cachedClient = null;
    cachedUrl = '';
    cachedKey = '';
  }

  /**
   * Kiểm tra xem cấu hình Supabase đã được cung cấp hay chưa
   */
  static hasValidConfig(): boolean {
    const config = this.getConfig();
    return Boolean(config.url && config.url.startsWith('https://') && config.anonKey);
  }

  /**
   * Khởi tạo hoặc lấy Supabase Client hiện tại
   */
  static getClient(): SupabaseClient | null {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) {
      return null;
    }

    if (cachedClient && cachedUrl === config.url && cachedKey === config.anonKey) {
      return cachedClient;
    }

    try {
      cachedClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      cachedUrl = config.url;
      cachedKey = config.anonKey;
      return cachedClient;
    } catch (err) {
      console.error('Không thể tạo Supabase Client:', err);
      return null;
    }
  }

  /**
   * Kiểm tra kết nối thực tế tới Supabase PostgreSQL (Ping DB)
   */
  static async testConnection(url?: string, anonKey?: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const targetUrl = url || this.getConfig().url;
    const targetKey = anonKey || this.getConfig().anonKey;

    if (!targetUrl || !targetKey) {
      return {
        success: false,
        latencyMs: 0,
        message: 'Chưa nhập URL Dự án hoặc Khóa Anon Key của Supabase.',
      };
    }

    const startTime = performance.now();
    try {
      const tempClient = createClient(targetUrl, targetKey);
      // Thực hiện truy vấn nhẹ nhàng lên Supabase để kiểm tra kết nối
      const { error } = await tempClient
        .from('employees')
        .select('id')
        .limit(1);

      const latencyMs = Math.round(performance.now() - startTime);

      if (error && error.code !== 'PGRST116') {
        // Nếu mã lỗi là bảng chưa tồn tại (relation does not exist - 42P01)
        if (error.message.includes('relation "public.employees" does not exist') || error.code === '42P01') {
          return {
            success: true,
            latencyMs,
            message: `Kết nối thành công (${latencyMs}ms), nhưng chưa tạo bảng. Vui lòng chạy file script supabase-schema.sql trên Supabase SQL Editor.`,
          };
        }
        return {
          success: false,
          latencyMs,
          message: `Lỗi kết nối Supabase: ${error.message}`,
        };
      }

      // Lưu trạng thái thành công
      const currentConfig = this.getConfig();
      this.saveConfig({
        ...currentConfig,
        url: targetUrl,
        anonKey: targetKey,
        isConnected: true,
        lastPing: new Date().toISOString(),
        error: undefined,
      });

      return {
        success: true,
        latencyMs,
        message: `Kết nối Supabase PostgreSQL thành công (${latencyMs}ms). Dữ liệu sẵn sàng đồng bộ Realtime.`,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs,
        message: `Lỗi kết nối mạng: ${err?.message || 'Không thể gửi yêu cầu tới Supabase'}`,
      };
    }
  }
}
