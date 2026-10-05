import { Router, Response } from 'express';
import { supabaseAdmin } from '../supabaseClient';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 3.3.1 Submit Adoption Application (Adopter)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { pet_id, living_condition, has_other_pets, reason_for_adoption } = req.body;

  if (!pet_id || !living_condition || !reason_for_adoption) {
    return res.status(400).json({
      error: 'pet_id, living_condition, and reason_for_adoption are required fields',
    });
  }

  // Check if pet is AVAILABLE
  const { data: pet, error: petErr } = await supabaseAdmin
    .from('pets')
    .select('id, name, status')
    .eq('id', pet_id)
    .single();

  if (petErr || !pet) {
    return res.status(404).json({ error: 'Pet not found' });
  }

  if (pet.status !== 'AVAILABLE') {
    return res.status(400).json({ error: `Pet ${pet.name} is currently ${pet.status} and not available for adoption.` });
  }

  const { data, error } = await supabaseAdmin
    .from('adoption_applications')
    .insert([
      {
        pet_id,
        applicant_id: req.user?.id,
        living_condition,
        has_other_pets: !!has_other_pets,
        reason_for_adoption,
        status: 'SUBMITTED',
      },
    ])
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({
    message: 'Adoption application submitted successfully',
    data,
  });
});

// 3.3.2 List Applications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  let query = supabaseAdmin
    .from('adoption_applications')
    .select(`
      *,
      pet:pets(id, name, breed, image_url, status),
      applicant:profiles(id, email, first_name, last_name, phone)
    `)
    .order('created_at', { ascending: false });

  // If regular user (ADOPTER), only show own applications
  if (req.user?.role === 'ADOPTER') {
    query = query.eq('applicant_id', req.user.id);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data });
});

// 3.3.3 Get Application by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('adoption_applications')
    .select(`
      *,
      pet:pets(id, name, breed, image_url, status),
      applicant:profiles(id, email, first_name, last_name, phone)
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Security check: only own application or staff/admin
  if (req.user?.role === 'ADOPTER' && data.applicant_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to view this application' });
  }

  return res.json({ data });
});

// 3.3.4 Review Application / Update Status (Staff or Admin)
router.patch('/:id/status', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const { status, review_notes } = req.body;

  const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  const { data: application, error: appErr } = await supabaseAdmin
    .from('adoption_applications')
    .update({
      status,
      review_notes: review_notes || null,
      reviewed_by: req.user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (appErr || !application) {
    return res.status(400).json({ error: appErr?.message || 'Update failed' });
  }

  // If approved, update pet status to ADOPTED
  if (status === 'APPROVED') {
    await supabaseAdmin
      .from('pets')
      .update({ status: 'ADOPTED' })
      .eq('id', application.pet_id);
  } else if (status === 'UNDER_REVIEW') {
    await supabaseAdmin
      .from('pets')
      .update({ status: 'PENDING' })
      .eq('id', application.pet_id);
  }

  return res.json({
    message: `Application status updated to ${status}`,
    data: application,
  });
});

export default router;
