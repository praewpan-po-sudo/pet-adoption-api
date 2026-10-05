import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 3.1.1 List all Categories (Public or Authenticated)
router.get('/', async (_req, res: Response) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data });
});

// 3.1.2 Get Category by ID
router.get('/:id', async (req, res: Response) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Category not found' });
  }

  return res.json({ data });
});

// 3.1.3 Create Category (Admin / Shelter Staff)
router.post('/', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const { name, description, icon_url } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert([{ name, description, icon_url }])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ message: 'Category created successfully', data });
});

// 3.1.4 Update Category (Admin / Shelter Staff)
router.put('/:id', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const { name, description, icon_url } = req.body;

  const { data, error } = await supabaseAdmin
    .from('categories')
    .update({ name, description, icon_url, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Category updated successfully', data });
});

// 3.1.5 Delete Category (Admin Only)
router.delete('/:id', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('categories')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Category deleted successfully' });
});

export default router;
