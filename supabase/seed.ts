import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

try {
  if (typeof globalThis.WebSocket === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ws = require('ws');
    (globalThis as any).WebSocket = ws.default || ws.WebSocket || ws;
  }
} catch {}

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seed() {
  console.log('🌱 Starting Pet Adoption API Seed Process...');

  // 1. Create Default Users via Supabase Admin Auth
  const defaultUsers = [
    {
      email: process.env.ADMIN_EMAIL || 'admin@petadoption.local',
      password: process.env.ADMIN_PASSWORD || 'Password123!',
      role: 'ADMIN',
      firstName: process.env.ADMIN_FIRSTNAME || 'Super',
      lastName: process.env.ADMIN_LASTNAME || 'Admin',
      phone: '0800000001',
    },
    {
      email: process.env.STAFF_EMAIL || 'staff@petadoption.local',
      password: process.env.STAFF_PASSWORD || 'Password123!',
      role: 'SHELTER_STAFF',
      firstName: process.env.STAFF_FIRSTNAME || 'Shelter',
      lastName: process.env.STAFF_LASTNAME || 'Staff',
      phone: '0800000002',
    },
    {
      email: process.env.USER_EMAIL || 'adopter1@petadoption.local',
      password: process.env.USER_PASSWORD || 'Password123!',
      role: 'ADOPTER',
      firstName: process.env.USER_FIRSTNAME || 'Somchai',
      lastName: process.env.USER_LASTNAME || 'Jaidee',
      phone: process.env.USER_PHONE || '0812345678',
    },
  ];

  for (const user of defaultUsers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        phone: user.phone,
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`ℹ️ User already exists: ${user.email}`);
      } else {
        console.warn(`⚠️ Warning creating user ${user.email}:`, error.message);
      }
    } else {
      console.log(`✅ Created ${user.role} user: ${user.email} (${data.user.id})`);
    }

    if (data?.user?.id) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        phone: user.phone,
      });
      if (profileError) {
        console.warn(`⚠️ Warning updating profile for ${user.email}:`, profileError.message);
      }
    }
  }

  // 2. Categories
  const categories = [
    { name: 'Dog', description: 'Canine companions' },
    { name: 'Cat', description: 'Feline friends' },
    { name: 'Rabbit', description: 'Gentle bunnies' },
    { name: 'Bird', description: 'Feathered pals' },
  ];

  for (const cat of categories) {
    const { error } = await supabase
      .from('categories')
      .upsert(cat, { onConflict: 'name' });
    if (error) console.error(`Error inserting category ${cat.name}:`, error.message);
  }
  console.log('✅ Categories seeded successfully.');

  console.log('🎉 Seed complete! You can now test the API using api.http.simple');
}

seed().catch(console.error);
