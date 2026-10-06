import { Router, Response } from 'express';
import * as dbClient from '../supabaseClient';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 1. List all shelters
router.get('/', async (_req, res: Response) => {
  const { data, error } = await dbClient.supabaseAdmin
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
  const { data, error } = await dbClient.supabaseAdmin
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

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanLoc = typeof location === 'string' ? location.trim() : '';

  if (!cleanName || !cleanLoc) {
    return res.status(400).json({ error: 'name and location are required non-empty fields' });
  }

  const { data, error } = await dbClient.supabaseAdmin
    .from('shelters')
    .insert([{
      name: cleanName,
      location: cleanLoc,
      contact_phone: contact_phone ? String(contact_phone).trim() : null,
      email: email ? String(email).trim() : null,
    }])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ message: 'Shelter created successfully', data });
});

// 4. Update shelter (Admin only - PUT / PATCH)
const updateShelterHandler = async (req: AuthRequest, res: Response) => {
  const { data: existingShelter, error: findError } = await dbClient.supabaseAdmin
    .from('shelters')
    .select('id')
    .eq('id', req.params.id)
    .single();

  if (findError || !existingShelter) {
    return res.status(404).json({ error: 'Shelter not found' });
  }

  const { name, location, contact_phone, email } = req.body;

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Shelter name cannot be empty' });
    }
    updates.name = name.trim();
  }

  if (location !== undefined) {
    if (typeof location !== 'string' || !location.trim()) {
      return res.status(400).json({ error: 'Location cannot be empty' });
    }
    updates.location = location.trim();
  }

  if (contact_phone !== undefined) {
    updates.contact_phone = contact_phone ? String(contact_phone).trim() : null;
  }

  if (email !== undefined) {
    updates.email = email ? String(email).trim() : null;
  }

  const { data, error } = await dbClient.supabaseAdmin
    .from('shelters')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Shelter updated successfully', data });
};

router.put('/:id', authenticate, requireRole(['ADMIN']), updateShelterHandler);
router.patch('/:id', authenticate, requireRole(['ADMIN']), updateShelterHandler);

// 5. Delete shelter (Admin only)
router.delete('/:id', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { data: shelter, error: findError } = await dbClient.supabaseAdmin
    .from('shelters')
    .select('id, name')
    .eq('id', req.params.id)
    .single();

  if (findError || !shelter) {
    return res.status(404).json({ error: 'Shelter not found' });
  }

  const { error } = await dbClient.supabaseAdmin
    .from('shelters')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Shelter deleted successfully' });
});

export default router;
