import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 3.2.1 Get all Pets (with filtering)
router.get('/', async (req, res: Response) => {
  const { category_id, status, gender, size, search } = req.query;

  let query = supabase
    .from('pets')
    .select(`
      *,
      category:categories(id, name)
    `)
    .order('created_at', { ascending: false });

  if (category_id) {
    query = query.eq('category_id', category_id as string);
  }
  if (status) {
    query = query.eq('status', status as string);
  }
  if (gender) {
    query = query.eq('gender', gender as string);
  }
  if (size) {
    query = query.eq('size', size as string);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,breed.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data });
});

// 3.2.2 Get Pet by ID
router.get('/:id', async (req, res: Response) => {
  const { data, error } = await supabase
    .from('pets')
    .select(`
      *,
      category:categories(id, name, description),
      inquiries:pet_inquiries(id, message, created_at, user:profiles(first_name, last_name))
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Pet not found' });
  }

  return res.json({ data });
});

// 3.2.3 Create Pet (Staff or Admin)
router.post('/', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const {
    name,
    category_id,
    breed,
    age_months,
    gender,
    size,
    status,
    description,
    medical_history,
    vaccinated,
    spayed_neutered,
    image_url,
  } = req.body;

  if (!name || !category_id || !breed) {
    return res.status(400).json({ error: 'name, category_id, and breed are required fields' });
  }

  const { data, error } = await supabaseAdmin
    .from('pets')
    .insert([
      {
        name,
        category_id,
        breed,
        age_months: age_months || 0,
        gender: gender || 'UNKNOWN',
        size: size || 'MEDIUM',
        status: status || 'AVAILABLE',
        description,
        medical_history,
        vaccinated: !!vaccinated,
        spayed_neutered: !!spayed_neutered,
        image_url,
        shelter_staff_id: req.user?.id,
      },
    ])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ message: 'Pet created successfully', data });
});

// 3.2.4 Update Pet (Staff or Admin)
router.put('/:id', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const updates = {
    ...req.body,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('pets')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Pet updated successfully', data });
});

// 3.2.5 Delete Pet (Staff or Admin)
router.delete('/:id', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('pets')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Pet deleted successfully' });
});

// 3.2.6 Add Pet Inquiry / Question
router.post('/:id/inquiries', authenticate, async (req: AuthRequest, res: Response) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const { data, error } = await supabaseAdmin
    .from('pet_inquiries')
    .insert([
      {
        pet_id: req.params.id,
        user_id: req.user?.id,
        message,
      },
    ])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ message: 'Inquiry submitted successfully', data });
});

export default router;
