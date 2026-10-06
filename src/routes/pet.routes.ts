import { Router, Response } from 'express';
import * as dbClient from '../supabaseClient';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 3.3.1 Get all Pets (with filtering)
router.get('/', async (req, res: Response) => {
  const { category_id, shelter_id, status, gender, size, search } = req.query;

  let query = dbClient.supabaseAdmin
    .from('pets')
    .select(`
      *,
      category:categories(id, name),
      shelter:shelters(id, name, location)
    `)
    .order('created_at', { ascending: false });

  if (category_id) {
    query = query.eq('category_id', category_id as string);
  }
  if (shelter_id) {
    query = query.eq('shelter_id', shelter_id as string);
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
  if (search && typeof search === 'string' && search.trim()) {
    const cleanSearch = search.trim().replace(/[,()]/g, '');
    if (cleanSearch) {
      query = query.or(`name.ilike.%${cleanSearch}%,breed.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%`);
    }
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data });
});

// 3.3.2 Get Pet by ID
router.get('/:id', async (req, res: Response) => {
  const { data, error } = await dbClient.supabaseAdmin
    .from('pets')
    .select(`
      *,
      category:categories(id, name, description),
      shelter:shelters(id, name, location, contact_phone),
      inquiries:pet_inquiries(id, message, created_at, user:profiles(id, first_name, last_name))
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Pet not found' });
  }

  return res.json({ data });
});

// 3.3.3 Create Pet (Staff or Admin)
router.post('/', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const {
    name,
    category_id,
    shelter_id,
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

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanCategory = typeof category_id === 'string' ? category_id.trim() : '';
  const cleanBreed = typeof breed === 'string' ? breed.trim() : '';

  if (!cleanName || !cleanCategory || !cleanBreed) {
    return res.status(400).json({ error: 'name, category_id, and breed are required non-empty fields' });
  }

  let cleanAge = 0;
  if (age_months !== undefined) {
    const parsed = Number(age_months);
    if (isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'age_months must be a non-negative number' });
    }
    cleanAge = Math.floor(parsed);
  }

  const cleanShelterId = (typeof shelter_id === 'string' && shelter_id.trim().length > 0) ? shelter_id.trim() : null;

  // Validate category exists
  const { data: catExists } = await dbClient.supabaseAdmin
    .from('categories')
    .select('id')
    .eq('id', cleanCategory)
    .single();

  if (!catExists) {
    return res.status(400).json({ error: `Category with ID '${cleanCategory}' does not exist` });
  }

  // Validate shelter exists if provided
  if (cleanShelterId) {
    const { data: shelterExists } = await dbClient.supabaseAdmin
      .from('shelters')
      .select('id')
      .eq('id', cleanShelterId)
      .single();

    if (!shelterExists) {
      return res.status(400).json({ error: `Shelter with ID '${cleanShelterId}' does not exist` });
    }
  }

  const validStatuses = ['AVAILABLE', 'PENDING', 'ADOPTED'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const validGenders = ['MALE', 'FEMALE', 'UNKNOWN'];
  if (gender && !validGenders.includes(gender)) {
    return res.status(400).json({ error: `Invalid gender. Must be one of: ${validGenders.join(', ')}` });
  }

  const validSizes = ['SMALL', 'MEDIUM', 'LARGE'];
  if (size && !validSizes.includes(size)) {
    return res.status(400).json({ error: `Invalid size. Must be one of: ${validSizes.join(', ')}` });
  }

  const { data, error } = await dbClient.supabaseAdmin
    .from('pets')
    .insert([
      {
        name: cleanName,
        category_id: cleanCategory,
        shelter_id: cleanShelterId,
        breed: cleanBreed,
        age_months: cleanAge,
        gender: gender || 'UNKNOWN',
        size: size || 'MEDIUM',
        status: status || 'AVAILABLE',
        description: description || null,
        medical_history: medical_history || null,
        vaccinated: !!vaccinated,
        spayed_neutered: !!spayed_neutered,
        image_url: image_url || null,
        shelter_staff_id: req.user?.id || null,
      },
    ])
    .select(`
      *,
      category:categories(id, name),
      shelter:shelters(id, name)
    `)
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ message: 'Pet created successfully', data });
});

// 3.3.4 Update Pet (Staff or Admin)
const updatePetHandler = async (req: AuthRequest, res: Response) => {
  const { data: existingPet, error: findError } = await dbClient.supabaseAdmin
    .from('pets')
    .select('id, name')
    .eq('id', req.params.id)
    .single();

  if (findError || !existingPet) {
    return res.status(404).json({ error: 'Pet not found' });
  }

  const {
    name,
    category_id,
    shelter_id,
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

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Pet name cannot be empty' });
    }
    updates.name = name.trim();
  }

  if (breed !== undefined) {
    if (typeof breed !== 'string' || !breed.trim()) {
      return res.status(400).json({ error: 'Breed cannot be empty' });
    }
    updates.breed = breed.trim();
  }

  if (age_months !== undefined) {
    const parsed = Number(age_months);
    if (isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'age_months must be a non-negative number' });
    }
    updates.age_months = Math.floor(parsed);
  }

  if (description !== undefined) updates.description = description;
  if (medical_history !== undefined) updates.medical_history = medical_history;
  if (vaccinated !== undefined) updates.vaccinated = !!vaccinated;
  if (spayed_neutered !== undefined) updates.spayed_neutered = !!spayed_neutered;
  if (image_url !== undefined) updates.image_url = image_url;

  if (category_id !== undefined) {
    const cleanCat = typeof category_id === 'string' ? category_id.trim() : '';
    const { data: catExists } = await dbClient.supabaseAdmin
      .from('categories')
      .select('id')
      .eq('id', cleanCat)
      .single();
    if (!catExists) {
      return res.status(400).json({ error: `Category with ID '${category_id}' does not exist` });
    }
    updates.category_id = cleanCat;
  }

  if (shelter_id !== undefined) {
    const cleanShelterId = (typeof shelter_id === 'string' && shelter_id.trim().length > 0) ? shelter_id.trim() : null;
    if (cleanShelterId) {
      const { data: shelterExists } = await dbClient.supabaseAdmin
        .from('shelters')
        .select('id')
        .eq('id', cleanShelterId)
        .single();
      if (!shelterExists) {
        return res.status(400).json({ error: `Shelter with ID '${cleanShelterId}' does not exist` });
      }
      updates.shelter_id = cleanShelterId;
    } else {
      updates.shelter_id = null;
    }
  }

  if (status !== undefined) {
    const validStatuses = ['AVAILABLE', 'PENDING', 'ADOPTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    updates.status = status;
  }

  if (gender !== undefined) {
    const validGenders = ['MALE', 'FEMALE', 'UNKNOWN'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({ error: `Invalid gender. Must be one of: ${validGenders.join(', ')}` });
    }
    updates.gender = gender;
  }

  if (size !== undefined) {
    const validSizes = ['SMALL', 'MEDIUM', 'LARGE'];
    if (!validSizes.includes(size)) {
      return res.status(400).json({ error: `Invalid size. Must be one of: ${validSizes.join(', ')}` });
    }
    updates.size = size;
  }

  const { data, error } = await dbClient.supabaseAdmin
    .from('pets')
    .update(updates)
    .eq('id', req.params.id)
    .select(`
      *,
      category:categories(id, name),
      shelter:shelters(id, name)
    `)
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Pet updated successfully', data });
};

router.put('/:id', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), updatePetHandler);
router.patch('/:id', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), updatePetHandler);

// 3.3.5 Delete Pet (Staff or Admin)
router.delete('/:id', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const { data: pet, error: findError } = await dbClient.supabaseAdmin
    .from('pets')
    .select('id, name')
    .eq('id', req.params.id)
    .single();

  if (findError || !pet) {
    return res.status(404).json({ error: 'Pet not found' });
  }

  // Check if pet has active applications (APPROVED or UNDER_REVIEW)
  const { data: activeApps } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .select('id, status')
    .eq('pet_id', req.params.id)
    .in('status', ['APPROVED', 'UNDER_REVIEW']);

  if (activeApps && activeApps.length > 0) {
    return res.status(400).json({
      error: `Cannot delete pet '${pet.name}' because it has active adoption applications (${activeApps[0].status}). Please resolve applications first.`,
    });
  }

  const { error } = await dbClient.supabaseAdmin
    .from('pets')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({ message: 'Pet deleted successfully' });
});

// 3.3.6 Add Pet Inquiry / Question
router.post('/:id/inquiries', authenticate, async (req: AuthRequest, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const { data: pet, error: petErr } = await dbClient.supabaseAdmin
    .from('pets')
    .select('id')
    .eq('id', req.params.id)
    .single();

  if (petErr || !pet) {
    return res.status(404).json({ error: 'Pet not found' });
  }

  const { data, error } = await dbClient.supabaseAdmin
    .from('pet_inquiries')
    .insert([
      {
        pet_id: req.params.id,
        user_id: req.user?.id,
        message: message.trim(),
      },
    ])
    .select(`
      *,
      user:profiles(id, first_name, last_name)
    `)
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({ message: 'Inquiry submitted successfully', data });
});

export default router;
