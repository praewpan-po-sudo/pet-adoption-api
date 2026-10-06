import { Router, Response } from 'express';
import * as dbClient from '../supabaseClient';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 3.2.1 List all Categories (Public or Authenticated)
router.get('/', async (_req, res: Response) => {
  const { data, error } = await dbClient.supabaseAdmin
    .from('categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data });
});

// 3.2.2 Get Category by ID
router.get('/:id', async (req, res: Response) => {
  const { data, error } = await dbClient.supabaseAdmin
    .from('categories')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Category not found' });
  }

  return res.json({ data });
});

// 3.2.3 Create Category (Admin / Shelter Staff)
router.post('/', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const { name, description, icon_url } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const { data, error } = await dbClient.supabaseAdmin
    .from('categories')
    .insert([{ name: name.trim(), description: description || null, icon_url: icon_url || null }])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ message: 'Category created successfully', data });
});

// 3.2.4 Update Category (Admin / Shelter Staff)
const updateCategoryHandler = async (req: AuthRequest, res: Response) => {
  const { name, description, icon_url } = req.body;

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name cannot be empty' });
    }
    updatePayload.name = name.trim();
  }
  if (description !== undefined) {
    updatePayload.description = description;
  }
  if (icon_url !== undefined) {
    updatePayload.icon_url = icon_url;
  }

  const { data, error } = await dbClient.supabaseAdmin
    .from('categories')
    .update(updatePayload)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Category not found' });
    }
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Category updated successfully', data });
};

router.put('/:id', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), updateCategoryHandler);
router.patch('/:id', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), updateCategoryHandler);

// 3.2.5 Delete Category (Admin Only)
router.delete('/:id', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { data: category, error: findError } = await dbClient.supabaseAdmin
    .from('categories')
    .select('id, name')
    .eq('id', req.params.id)
    .single();

  if (findError || !category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const { error } = await dbClient.supabaseAdmin
    .from('categories')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Category deleted successfully' });
});

export default router;
