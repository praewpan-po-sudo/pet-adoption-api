import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 1. List all shelters
router.get('/', async (_req, res: Response) => {
  const { data, error } = await supabase
    .from('shelters')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data });
});

// 2. Get shelter by ID
router.get('/:id', async (req, res: Response) => {
  const { data, error } = await supabase
    .from('shelters')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Shelter not found' });
  }

  return res.json({ data });
});

// 3. Create shelter (Admin only)
router.post('/', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { name, location, contact_phone, email } = req.body;

  if (!name || !location) {
    return res.status(400).json({ error: 'name and location are required' });
  }

  const { data, error } = await supabaseAdmin
    .from('shelters')
    .insert([{ name, location, contact_phone, email }])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ message: 'Shelter created successfully', data });
});

// 4. Update shelter (Admin only)
router.put('/:id', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { name, location, contact_phone, email } = req.body;

  const { data, error } = await supabaseAdmin
    .from('shelters')
    .update({
      name,
      location,
      contact_phone,
      email,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Shelter updated successfully', data });
});

// 5. Delete shelter (Admin only)
router.delete('/:id', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('shelters')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Shelter deleted successfully' });
});

export default router;
