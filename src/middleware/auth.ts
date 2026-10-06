import { Request, Response, NextFunction } from 'express';
import * as dbClient from '../supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
  };
  token?: string;
  supabaseUser?: SupabaseClient; // Client ภายใต้สิทธิ์ RLS ของ User คนนั้น
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Bearer token is required in Authorization header',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await dbClient.supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error?.message || 'Invalid or expired token',
      });
    }

    // ดึง Role จากโปรไฟล์
    const { data: profile } = await dbClient.supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    req.token = token;
    try {
      req.supabaseUser = dbClient.createScopedClient(token);
    } catch {
      // In mock/test environments
      req.supabaseUser = dbClient.supabase;
    }
    req.user = {
      id: user.id,
      email: user.email || '',
      role: profile?.role || user.user_metadata?.role || 'ADOPTER',
      firstName: profile?.first_name || user.user_metadata?.first_name || '',
      lastName: profile?.last_name || user.user_metadata?.last_name || '',
    };

    next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}. Current role: ${req.user.role}`,
      });
    }

    next();
  };
};