import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import * as dotenv from 'dotenv';

if (!globalThis.WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Warning: SUPABASE_URL or SUPABASE_ANON_KEY is missing in environment variables.');
}

// Client for general authenticated/public requests
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for backend operations requiring elevated permissions (bypassing RLS when necessary)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase;
