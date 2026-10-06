import { Router, Response } from 'express';
import * as dbClient from '../supabaseClient';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to recalculate and update pet status based on active applications
async function syncPetStatus(petId: string) {
  // Check if any application for this pet is APPROVED
  const { data: approvedApps } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .select('id')
    .eq('pet_id', petId)
    .eq('status', 'APPROVED')
    .limit(1);

  if (approvedApps && approvedApps.length > 0) {
    await dbClient.supabaseAdmin
      .from('pets')
      .update({ status: 'ADOPTED', updated_at: new Date().toISOString() })
      .eq('id', petId);
    return 'ADOPTED';
  }

  // Check if any application is UNDER_REVIEW
  const { data: underReviewApps } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .select('id')
    .eq('pet_id', petId)
    .eq('status', 'UNDER_REVIEW')
    .limit(1);

  if (underReviewApps && underReviewApps.length > 0) {
    await dbClient.supabaseAdmin
      .from('pets')
      .update({ status: 'PENDING', updated_at: new Date().toISOString() })
      .eq('id', petId);
    return 'PENDING';
  }

  // Otherwise, pet is AVAILABLE
  await dbClient.supabaseAdmin
    .from('pets')
    .update({ status: 'AVAILABLE', updated_at: new Date().toISOString() })
    .eq('id', petId);
  return 'AVAILABLE';
}

// 3.4.1 Submit Adoption Application (Adopter)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { pet_id, living_condition, has_other_pets, reason_for_adoption } = req.body;

  const cleanLiving = typeof living_condition === 'string' ? living_condition.trim() : '';
  const cleanReason = typeof reason_for_adoption === 'string' ? reason_for_adoption.trim() : '';
  const cleanPetId = typeof pet_id === 'string' ? pet_id.trim() : '';

  if (!cleanPetId || !cleanLiving || !cleanReason) {
    return res.status(400).json({
      error: 'pet_id, living_condition, and reason_for_adoption are required non-empty fields',
    });
  }

  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
  }

  // Check if pet exists and check its status
  const { data: pet, error: petErr } = await dbClient.supabaseAdmin
    .from('pets')
    .select('id, name, status')
    .eq('id', cleanPetId)
    .single();

  if (petErr || !pet) {
    return res.status(404).json({ error: 'Pet not found' });
  }

  if (pet.status !== 'AVAILABLE') {
    return res.status(400).json({
      error: `Pet ${pet.name} is currently ${pet.status} and not available for adoption.`,
    });
  }

  // Check if applicant already submitted an active application for this pet
  const { data: existingApp } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .select('id, status')
    .eq('pet_id', cleanPetId)
    .eq('applicant_id', req.user.id)
    .in('status', ['SUBMITTED', 'UNDER_REVIEW'])
    .maybeSingle();

  if (existingApp) {
    return res.status(400).json({
      error: `You already have an active application (${existingApp.status}) for this pet.`,
    });
  }

  const { data, error } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .insert([
      {
        pet_id: cleanPetId,
        applicant_id: req.user.id,
        living_condition: cleanLiving,
        has_other_pets: !!has_other_pets,
        reason_for_adoption: cleanReason,
        status: 'SUBMITTED',
      },
    ])
    .select(`
      *,
      pet:pets(id, name, breed, status),
      applicant:profiles!applicant_id(id, email, first_name, last_name)
    `)
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({
    message: 'Adoption application submitted successfully',
    data,
  });
});

// 3.4.2 List Applications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { status, pet_id, applicant_id } = req.query;

  let query = dbClient.supabaseAdmin
    .from('adoption_applications')
    .select(`
      *,
      pet:pets(id, name, breed, image_url, status),
      applicant:profiles!applicant_id(id, email, first_name, last_name, phone)
    `)
    .order('created_at', { ascending: false });

  const isStaffOrAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SHELTER_STAFF';

  // Only STAFF and ADMIN can view all or search by applicant_id; others can only see own applications
  if (!isStaffOrAdmin) {
    query = query.eq('applicant_id', req.user?.id);
  } else if (applicant_id) {
    query = query.eq('applicant_id', applicant_id as string);
  }

  if (status) {
    query = query.eq('status', status as string);
  }
  if (pet_id) {
    query = query.eq('pet_id', pet_id as string);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data: data || [] });
});

// 3.4.3 Get Application by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { data, error } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .select(`
      *,
      pet:pets(id, name, breed, image_url, status),
      applicant:profiles!applicant_id(id, email, first_name, last_name, phone)
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const isStaffOrAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SHELTER_STAFF';

  // Non-staff/admin can ONLY view their own application
  if (!isStaffOrAdmin && data.applicant_id !== req.user?.id) {
    return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to view this application' });
  }

  return res.json({ data });
});

// 3.4.4 Update Application Details (Adopter can update own SUBMITTED app; Staff/Admin can update any)
const updateApplicationHandler = async (req: AuthRequest, res: Response) => {
  const { data: application, error: appErr } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (appErr || !application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const isOwner = application.applicant_id === req.user?.id;
  const isStaffOrAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SHELTER_STAFF';

  if (!isOwner && !isStaffOrAdmin) {
    return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to edit this application' });
  }

  // Adopter can only edit while application is still SUBMITTED
  if (isOwner && !isStaffOrAdmin && application.status !== 'SUBMITTED') {
    return res.status(400).json({
      error: `Cannot modify application that has already been ${application.status.toLowerCase()}`,
    });
  }

  const { living_condition, has_other_pets, reason_for_adoption, review_notes } = req.body;

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (living_condition !== undefined) {
    if (typeof living_condition !== 'string' || !living_condition.trim()) {
      return res.status(400).json({ error: 'living_condition cannot be empty' });
    }
    updates.living_condition = living_condition.trim();
  }

  if (has_other_pets !== undefined) {
    updates.has_other_pets = !!has_other_pets;
  }

  if (reason_for_adoption !== undefined) {
    if (typeof reason_for_adoption !== 'string' || !reason_for_adoption.trim()) {
      return res.status(400).json({ error: 'reason_for_adoption cannot be empty' });
    }
    updates.reason_for_adoption = reason_for_adoption.trim();
  }

  if (isStaffOrAdmin && review_notes !== undefined) {
    updates.review_notes = review_notes;
  }

  const { data: updatedApp, error: updateErr } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .update(updates)
    .eq('id', req.params.id)
    .select(`
      *,
      pet:pets(id, name, breed, status),
      applicant:profiles!applicant_id(id, email, first_name, last_name)
    `)
    .single();

  if (updateErr) {
    return res.status(400).json({ error: updateErr.message });
  }

  return res.json({
    message: 'Application updated successfully',
    data: updatedApp,
  });
};

router.put('/:id', authenticate, updateApplicationHandler);
router.patch('/:id', authenticate, updateApplicationHandler);

// 3.4.5 Review Application / Update Status (Staff or Admin)
// Business Logic: Automatically update pet status when application is APPROVED, UNDER_REVIEW, REJECTED, or CANCELLED
router.patch('/:id/status', authenticate, requireRole(['ADMIN', 'SHELTER_STAFF']), async (req: AuthRequest, res: Response) => {
  const { status, review_notes } = req.body;

  const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  const { data: application, error: appErr } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (appErr || !application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Fetch pet directly to get the current real-time status
  const { data: pet } = await dbClient.supabaseAdmin
    .from('pets')
    .select('id, name, status')
    .eq('id', application.pet_id)
    .single();

  if (!pet) {
    return res.status(404).json({ error: 'Pet associated with this application not found' });
  }

  // Business Logic: If approving or reviewing, verify that pet is not already adopted by another applicant
  if (status === 'APPROVED' || status === 'UNDER_REVIEW') {
    if (pet.status === 'ADOPTED' && application.status !== 'APPROVED') {
      return res.status(400).json({
        error: `Pet ${pet.name || ''} is already adopted and cannot be reviewed or approved for another application.`,
      });
    }
  }

  const { data: updatedApp, error: updateErr } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .update({
      status,
      review_notes: review_notes !== undefined ? review_notes : application.review_notes,
      reviewed_by: req.user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (updateErr || !updatedApp) {
    return res.status(400).json({ error: updateErr?.message || 'Update failed' });
  }

  // Core Business Logic: Synchronize Pet Status based on adoption status
  let newPetStatus: string;
  if (status === 'APPROVED') {
    await dbClient.supabaseAdmin
      .from('pets')
      .update({ status: 'ADOPTED', updated_at: new Date().toISOString() })
      .eq('id', application.pet_id);
    newPetStatus = 'ADOPTED';
  } else if (status === 'UNDER_REVIEW') {
    if (pet.status !== 'ADOPTED') {
      await dbClient.supabaseAdmin
        .from('pets')
        .update({ status: 'PENDING', updated_at: new Date().toISOString() })
        .eq('id', application.pet_id);
      newPetStatus = 'PENDING';
    } else {
      newPetStatus = 'ADOPTED';
    }
  } else {
    // REJECTED, CANCELLED, or returned to SUBMITTED:
    // If the application was previously APPROVED or UNDER_REVIEW, recalculate pet status
    newPetStatus = await syncPetStatus(application.pet_id);
  }

  // Fetch updated pet info to return alongside application
  const { data: petData } = await dbClient.supabaseAdmin
    .from('pets')
    .select('id, name, status')
    .eq('id', application.pet_id)
    .single();

  return res.json({
    message: `Application status updated to ${status}`,
    data: {
      ...updatedApp,
      pet: petData || { id: application.pet_id, status: newPetStatus },
    },
  });
});

// 3.4.6 Delete Application (Adopter can cancel/delete own app; Staff/Admin can delete any)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { data: application, error: findError } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .select('id, pet_id, applicant_id, status')
    .eq('id', req.params.id)
    .single();

  if (findError || !application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const isOwner = application.applicant_id === req.user?.id;
  const isStaffOrAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SHELTER_STAFF';

  if (!isOwner && !isStaffOrAdmin) {
    return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to delete this application' });
  }

  const { error } = await dbClient.supabaseAdmin
    .from('adoption_applications')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // If the deleted application was APPROVED or UNDER_REVIEW, recalculate pet status
  if (application.status === 'APPROVED' || application.status === 'UNDER_REVIEW') {
    await syncPetStatus(application.pet_id);
  }

  return res.json({ message: 'Application deleted successfully' });
});

export default router;
