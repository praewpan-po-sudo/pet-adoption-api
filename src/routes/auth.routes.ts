import { Router, Response } from 'express';
import * as dbClient from '../supabaseClient';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// ==========================================
// 1. Admin Endpoints
// ==========================================

// 1.1 Admin Login
router.post('/admin/login', async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
  }

  const { data, error } = await dbClient.supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return res.status(401).json({ error: 'Unauthorized', message: error?.message || 'Login failed' });
  }

  // Verify Admin role
  const { data: profile } = await dbClient.supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profile?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden', message: 'User is not an administrator' });
  }

  return res.json({
    message: 'Admin login successful',
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: profile.role,
      firstName: profile.first_name,
      lastName: profile.last_name,
    },
  });
});

// 1.2 Admin Profile
router.get('/admin/users/me', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  return res.json({
    message: 'Admin profile fetched successfully',
    admin: req.user,
  });
});

// ==========================================
// 2. User / Adopter Endpoints
// ==========================================

// 2.1 User Register
router.post('/api/auth/register', async (req: AuthRequest, res: Response) => {
  const { email, password, firstName, lastName, phone, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
  }

  const assignedRole = (role === 'ADMIN' || role === 'SHELTER_STAFF') ? role : 'ADOPTER';

  const { data, error } = await dbClient.supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName || '',
        last_name: lastName || '',
        role: assignedRole,
        phone: phone || '',
      },
    },
  });

  if (error) {
    const errorMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
    return res.status(400).json({ error: 'Registration failed', message: errorMsg });
  }

  if (data?.user?.id) {
    try {
      await dbClient.supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        email,
        first_name: firstName || '',
        last_name: lastName || '',
        role: assignedRole,
        phone: phone || '',
      });
    } catch {}
  }

  return res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: data.user?.id,
      email: data.user?.email,
      role: assignedRole,
    },
  });
});

// 2.2 User Login
router.post('/api/auth/login', async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
  }

  const { data, error } = await dbClient.supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return res.status(401).json({ error: 'Unauthorized', message: error?.message || 'Invalid credentials' });
  }

  const { data: profile } = await dbClient.supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  return res.json({
    message: 'User login successful',
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: profile?.role || 'ADOPTER',
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
    },
  });
});

// 2.3 User Forgot Password
router.post('/api/auth/forgot-password', async (req: AuthRequest, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email is required' });
  }

  const { error } = await dbClient.supabase.auth.resetPasswordForEmail(email);

  if (error) {
    return res.status(400).json({ error: 'Reset failed', message: error.message });
  }

  return res.json({ message: 'Password reset link sent if account exists' });
});

// 2.4 User Profile
router.get('/api/users/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { data: profile } = await dbClient.supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user?.id)
    .single();

  return res.json({
    message: 'Profile retrieved successfully',
    user: profile || req.user,
  });
});

export default router;
