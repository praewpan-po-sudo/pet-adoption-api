import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// รองรับ WebSocket อัตโนมัติ (Node 22+ มี Native WebSocket, Node 20 โหลด ws ปลอดภัย)
try {
  if (typeof globalThis.WebSocket === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ws = require('ws');
    (globalThis as any).WebSocket = ws.default || ws.WebSocket || ws;
  }
} catch {
  // ละเว้นหากเป็น Node รุ่นใหม่ที่มี Native WebSocket
}

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Warning: SUPABASE_URL or SUPABASE_ANON_KEY is missing in environment variables.');
}

// 1. Client ทั่วไปสำหรับคำขอสาธารณะ
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Client ประจำตัวผู้ใช้ (สร้างพร้อมแนบ JWT Token ของ User เพื่อให้ RLS ตรวจสอบสิทธิ์ auth.uid() ได้)
export const createScopedClient = (token: string): SupabaseClient => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
    },
  });
};

// 3. Admin Client (ใช้ Service Role Key สำหรับงานระบบหลังบ้านที่ต้องข้าม RLS)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase;

// 4. ชื่อ Storage Bucket สำหรับจัดเก็บภาพสัตว์เลี้ยง
export const PET_STORAGE_BUCKET = process.env.PET_STORAGE_BUCKET || 'pet-images';
