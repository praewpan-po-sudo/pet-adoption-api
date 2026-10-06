import assert from 'node:assert';
import express from 'express';
import cors from 'cors';

// In-memory data store for tests
const db = {
  profiles: [
    { id: 'admin-uuid', email: 'admin@petadoption.local', role: 'ADMIN', first_name: 'Super', last_name: 'Admin' },
    { id: 'staff-uuid', email: 'staff@petadoption.local', role: 'SHELTER_STAFF', first_name: 'Shelter', last_name: 'Staff' },
    { id: 'user-uuid-1', email: 'adopter1@petadoption.local', role: 'ADOPTER', first_name: 'Somchai', last_name: 'Jaidee' },
    { id: 'user-uuid-2', email: 'adopter2@petadoption.local', role: 'ADOPTER', first_name: 'Somsri', last_name: 'Rukdee' },
  ],
  shelters: [
    { id: 'shelter-1', name: 'Bangkok Paws', location: 'Bangkok', contact_phone: '02-111-2222', email: 'bkk@paws.org' },
  ],
  categories: [
    { id: 'cat-1', name: 'Dog', description: 'Canines', icon_url: null, created_at: new Date().toISOString() },
    { id: 'cat-2', name: 'Cat', description: 'Felines', icon_url: null, created_at: new Date().toISOString() },
  ],
  pets: [
    {
      id: 'pet-1',
      name: 'Milo',
      category_id: 'cat-1',
      shelter_id: 'shelter-1',
      breed: 'Golden Retriever',
      age_months: 12,
      gender: 'MALE',
      size: 'LARGE',
      status: 'AVAILABLE',
      description: 'Friendly dog',
      medical_history: 'Vaccinated',
      vaccinated: true,
      spayed_neutered: true,
      image_url: null,
      shelter_staff_id: 'staff-uuid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'pet-2',
      name: 'Luna',
      category_id: 'cat-2',
      shelter_id: 'shelter-1',
      breed: 'British Shorthair',
      age_months: 8,
      gender: 'FEMALE',
      size: 'SMALL',
      status: 'AVAILABLE',
      description: 'Quiet cat',
      medical_history: 'Vaccinated',
      vaccinated: true,
      spayed_neutered: true,
      image_url: null,
      shelter_staff_id: 'staff-uuid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  adoption_applications: [] as any[],
  pet_inquiries: [] as any[],
};

// Mock Supabase Query Builder
function createMockClient() {
  return {
    auth: {
      getUser: async (token: string) => {
        if (token === 'admin-token') return { data: { user: { id: 'admin-uuid', email: 'admin@petadoption.local' } }, error: null };
        if (token === 'staff-token') return { data: { user: { id: 'staff-uuid', email: 'staff@petadoption.local' } }, error: null };
        if (token === 'user-token-1') return { data: { user: { id: 'user-uuid-1', email: 'adopter1@petadoption.local' } }, error: null };
        if (token === 'user-token-2') return { data: { user: { id: 'user-uuid-2', email: 'adopter2@petadoption.local' } }, error: null };
        return { data: { user: null }, error: { message: 'Invalid token' } };
      },
    },
    from: (tableName: keyof typeof db) => {
      const table = db[tableName];
      let filters: ((item: any) => boolean)[] = [];
      let sortField: string | null = null;
      let sortAsc = true;
      let limitCount: number | null = null;
      let pendingInsert: any = null;
      let pendingUpdate: any = null;
      let isDelete = false;

      const builder = {
        select: (_fields?: string) => builder,
        eq: (col: string, val: any) => {
          filters.push((item: any) => item[col] === val);
          return builder;
        },
        neq: (col: string, val: any) => {
          filters.push((item: any) => item[col] !== val);
          return builder;
        },
        in: (col: string, values: any[]) => {
          filters.push((item: any) => values.includes(item[col]));
          return builder;
        },
        or: (conditionStr: string) => {
          const match = conditionStr.match(/%([^%]+)%/);
          if (match) {
            const term = match[1].toLowerCase();
            filters.push((item: any) => {
              return (item.name && item.name.toLowerCase().includes(term)) ||
                     (item.breed && item.breed.toLowerCase().includes(term)) ||
                     (item.description && item.description.toLowerCase().includes(term));
            });
          }
          return builder;
        },
        order: (col: string, options?: { ascending: boolean }) => {
          sortField = col;
          sortAsc = options?.ascending ?? true;
          return builder;
        },
        limit: (n: number) => {
          limitCount = n;
          return builder;
        },
        insert: (rows: any[]) => {
          pendingInsert = rows;
          return builder;
        },
        update: (payload: any) => {
          pendingUpdate = payload;
          return builder;
        },
        delete: () => {
          isDelete = true;
          return builder;
        },
        single: async () => {
          const res = await builder.execute();
          if (res.error) return { data: null, error: res.error };
          if (Array.isArray(res.data)) {
            if (res.data.length === 0) return { data: null, error: { code: 'PGRST116', message: 'No rows' } };
            return { data: res.data[0], error: null };
          }
          return { data: res.data, error: null };
        },
        maybeSingle: async () => {
          const res = await builder.execute();
          if (res.error) return { data: null, error: res.error };
          if (Array.isArray(res.data)) {
            return { data: res.data[0] || null, error: null };
          }
          return { data: res.data || null, error: null };
        },
        then: (resolve: any, reject: any) => {
          return builder.execute().then(resolve, reject);
        },
        execute: async () => {
          if (pendingInsert) {
            const insertedRows = pendingInsert.map((r: any) => {
              const newRow = {
                id: r.id || `${tableName}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                created_at: new Date().toISOString(),
                ...r,
              };
              table.push(newRow);
              return newRow;
            });
            return { data: insertedRows.length === 1 ? insertedRows[0] : insertedRows, error: null };
          }

          if (pendingUpdate) {
            let matched = table.filter((item: any) => filters.every(f => f(item)));
            if (matched.length === 0) {
              return { data: null, error: { code: 'PGRST116', message: '0 rows matched update' } };
            }
            matched.forEach((item: any) => Object.assign(item, pendingUpdate));
            return { data: matched.length === 1 ? matched[0] : matched, error: null };
          }

          if (isDelete) {
            const remaining = table.filter((item: any) => !filters.every(f => f(item)));
            table.length = 0;
            table.push(...remaining);
            return { data: null, error: null };
          }

          let result = table.filter((item: any) => filters.every(f => f(item)));
          if (sortField) {
            result.sort((a: any, b: any) => {
              if (a[sortField!] > b[sortField!]) return sortAsc ? 1 : -1;
              if (a[sortField!] < b[sortField!]) return sortAsc ? -1 : 1;
              return 0;
            });
          }
          if (limitCount !== null) {
            result = result.slice(0, limitCount);
          }
          return { data: result, error: null };
        },
      };
      return builder;
    },
  };
}

async function main() {
  const mockClient = createMockClient();
  const supabaseClientModule = await import('../src/supabaseClient');
  supabaseClientModule.setSupabaseClients(mockClient, mockClient);

  const { default: categoryRoutes } = await import('../src/routes/category.routes');
  const { default: petRoutes } = await import('../src/routes/pet.routes');
  const { default: applicationRoutes } = await import('../src/routes/application.routes');

  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());

  testApp.get('/', (_req, res) => {
    res.json({ status: 'online', project: 'Pet Adoption API' });
  });

  testApp.use('/api/categories', categoryRoutes);
  testApp.use('/api/pets', petRoutes);
  testApp.use('/api/applications', applicationRoutes);

  const server = testApp.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(path: string, options: { method?: string; token?: string; body?: any } = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }

  console.log('🧪 Starting Pet Adoption API Test Suite...\n');
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // --- SECTION 1: HEALTH CHECK ---
  console.log('--- 1. Base / Health Check ---');
  await test('GET / returns online status', async () => {
    const res = await request('/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'online');
  });

  // --- SECTION 2: CATEGORIES CRUD ---
  console.log('\n--- 2. Categories CRUD ---');
  let createdCatId = '';

  await test('GET /api/categories returns list of categories', async () => {
    const res = await request('/api/categories');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2);
  });

  await test('POST /api/categories requires authentication', async () => {
    const res = await request('/api/categories', {
      method: 'POST',
      body: { name: 'Hamster' },
    });
    assert.strictEqual(res.status, 401);
  });

  await test('POST /api/categories rejects regular ADOPTER role', async () => {
    const res = await request('/api/categories', {
      method: 'POST',
      token: 'user-token-1',
      body: { name: 'Hamster' },
    });
    assert.strictEqual(res.status, 403);
  });

  await test('POST /api/categories succeeds with ADMIN role', async () => {
    const res = await request('/api/categories', {
      method: 'POST',
      token: 'admin-token',
      body: { name: 'Hamster', description: 'Pocket pets' },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.name, 'Hamster');
    createdCatId = res.body.data.id;
  });

  await test('POST /api/categories validates required name', async () => {
    const res = await request('/api/categories', {
      method: 'POST',
      token: 'admin-token',
      body: { name: '   ' },
    });
    assert.strictEqual(res.status, 400);
  });

  await test('GET /api/categories/:id returns single category', async () => {
    const res = await request(`/api/categories/${createdCatId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.name, 'Hamster');
  });

  await test('PUT /api/categories/:id updates category (Admin)', async () => {
    const res = await request(`/api/categories/${createdCatId}`, {
      method: 'PUT',
      token: 'admin-token',
      body: { name: 'Hamster & Rodents' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.name, 'Hamster & Rodents');
  });

  await test('DELETE /api/categories/:id deletes category (Admin)', async () => {
    const res = await request(`/api/categories/${createdCatId}`, {
      method: 'DELETE',
      token: 'admin-token',
    });
    assert.strictEqual(res.status, 200);

    const checkRes = await request(`/api/categories/${createdCatId}`);
    assert.strictEqual(checkRes.status, 404);
  });

  // --- SECTION 3: PETS CRUD ---
  console.log('\n--- 3. Pets CRUD ---');
  let createdPetId = '';

  await test('GET /api/pets returns list of pets', async () => {
    const res = await request('/api/pets');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2);
  });

  await test('GET /api/pets?status=AVAILABLE filters pets', async () => {
    const res = await request('/api/pets?status=AVAILABLE');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.every((p: any) => p.status === 'AVAILABLE'));
  });

  await test('POST /api/pets validates required fields (name, category_id, breed)', async () => {
    const res = await request('/api/pets', {
      method: 'POST',
      token: 'admin-token',
      body: { name: 'Incomplete' },
    });
    assert.strictEqual(res.status, 400);
  });

  await test('POST /api/pets validates non-existent category_id', async () => {
    const res = await request('/api/pets', {
      method: 'POST',
      token: 'admin-token',
      body: { name: 'Charlie', category_id: 'non-existent-cat', breed: 'Corgi' },
    });
    assert.strictEqual(res.status, 400);
  });

  await test('POST /api/pets creates pet successfully (Staff or Admin)', async () => {
    const res = await request('/api/pets', {
      method: 'POST',
      token: 'staff-token',
      body: {
        name: 'Charlie',
        category_id: 'cat-1',
        shelter_id: 'shelter-1',
        breed: 'Corgi',
        age_months: 10,
        gender: 'MALE',
        size: 'MEDIUM',
        status: 'AVAILABLE',
        description: 'Cheerful dog',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.name, 'Charlie');
    assert.strictEqual(res.body.data.status, 'AVAILABLE');
    createdPetId = res.body.data.id;
  });

  await test('GET /api/pets/:id returns pet details', async () => {
    const res = await request(`/api/pets/${createdPetId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.name, 'Charlie');
  });

  await test('PUT /api/pets/:id updates pet details', async () => {
    const res = await request(`/api/pets/${createdPetId}`, {
      method: 'PUT',
      token: 'staff-token',
      body: { description: 'Updated cheerful dog' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.description, 'Updated cheerful dog');
  });

  await test('POST /api/pets/:id/inquiries adds an inquiry from authenticated user', async () => {
    const res = await request(`/api/pets/${createdPetId}/inquiries`, {
      method: 'POST',
      token: 'user-token-1',
      body: { message: 'Is Charlie friendly with other dogs?' },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.message, 'Is Charlie friendly with other dogs?');
  });

  // --- SECTION 4: ADOPTION APPLICATIONS & BUSINESS LOGIC ---
  console.log('\n--- 4. Adoption Applications CRUD & Business Logic ---');
  let applicationId = '';

  await test('POST /api/applications validates required fields', async () => {
    const res = await request('/api/applications', {
      method: 'POST',
      token: 'user-token-1',
      body: { pet_id: createdPetId },
    });
    assert.strictEqual(res.status, 400);
  });

  await test('POST /api/applications fails for non-existent pet', async () => {
    const res = await request('/api/applications', {
      method: 'POST',
      token: 'user-token-1',
      body: {
        pet_id: 'missing-pet-id',
        living_condition: 'House',
        reason_for_adoption: 'Love pets',
      },
    });
    assert.strictEqual(res.status, 404);
  });

  await test('POST /api/applications succeeds for AVAILABLE pet', async () => {
    const res = await request('/api/applications', {
      method: 'POST',
      token: 'user-token-1',
      body: {
        pet_id: createdPetId,
        living_condition: 'Single house with a high-fenced green backyard',
        has_other_pets: false,
        reason_for_adoption: 'Experience caring for dogs for 5 years',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.status, 'SUBMITTED');
    applicationId = res.body.data.id;
  });

  await test('POST /api/applications prevents duplicate active application from same user', async () => {
    const res = await request('/api/applications', {
      method: 'POST',
      token: 'user-token-1',
      body: {
        pet_id: createdPetId,
        living_condition: 'Another house',
        reason_for_adoption: 'Another reason',
      },
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('already have an active application'));
  });

  await test('GET /api/applications returns user own applications', async () => {
    const res = await request('/api/applications', {
      token: 'user-token-1',
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.data.length, 1);
  });

  await test('GET /api/applications/:id allows adopter to view own application', async () => {
    const res = await request(`/api/applications/${applicationId}`, {
      token: 'user-token-1',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.id, applicationId);
  });

  await test('GET /api/applications/:id forbids other adopter from viewing', async () => {
    const res = await request(`/api/applications/${applicationId}`, {
      token: 'user-token-2',
    });
    assert.strictEqual(res.status, 403);
  });

  await test('PUT /api/applications/:id allows adopter to update submitted application', async () => {
    const res = await request(`/api/applications/${applicationId}`, {
      method: 'PUT',
      token: 'user-token-1',
      body: {
        living_condition: 'Updated house with bigger fenced yard',
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.living_condition, 'Updated house with bigger fenced yard');
  });

  // BUSINESS LOGIC: UNDER_REVIEW -> pet becomes PENDING
  await test('Business Logic: Review to UNDER_REVIEW changes pet status to PENDING', async () => {
    const res = await request(`/api/applications/${applicationId}/status`, {
      method: 'PATCH',
      token: 'admin-token',
      body: {
        status: 'UNDER_REVIEW',
        review_notes: 'Checking background',
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'UNDER_REVIEW');
    assert.strictEqual(res.body.data.pet.status, 'PENDING');

    const petRes = await request(`/api/pets/${createdPetId}`);
    assert.strictEqual(petRes.body.data.status, 'PENDING');
  });

  // BUSINESS LOGIC: Cannot submit application when pet is PENDING
  await test('Business Logic: Cannot submit application for PENDING pet', async () => {
    const res = await request('/api/applications', {
      method: 'POST',
      token: 'user-token-2',
      body: {
        pet_id: createdPetId,
        living_condition: 'Condo',
        reason_for_adoption: 'Love pets',
      },
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('PENDING'));
  });

  // BUSINESS LOGIC: Review to APPROVED -> pet becomes ADOPTED
  await test('Business Logic: Review to APPROVED changes pet status to ADOPTED', async () => {
    const res = await request(`/api/applications/${applicationId}/status`, {
      method: 'PATCH',
      token: 'admin-token',
      body: {
        status: 'APPROVED',
        review_notes: 'Home inspection passed, adopter is approved!',
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'APPROVED');
    assert.strictEqual(res.body.data.pet.status, 'ADOPTED');

    const petRes = await request(`/api/pets/${createdPetId}`);
    assert.strictEqual(petRes.body.data.status, 'ADOPTED');
  });

  // BUSINESS LOGIC: Cannot approve another application when pet is already ADOPTED
  await test('Business Logic: Cannot approve another application if pet is already ADOPTED', async () => {
    const fakeAppId = 'app-fake-2';
    db.adoption_applications.push({
      id: fakeAppId,
      pet_id: createdPetId,
      applicant_id: 'user-uuid-2',
      status: 'SUBMITTED',
      living_condition: 'House',
      has_other_pets: false,
      reason_for_adoption: 'Good care',
    });

    const res = await request(`/api/applications/${fakeAppId}/status`, {
      method: 'PATCH',
      token: 'admin-token',
      body: {
        status: 'APPROVED',
      },
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('already adopted'));
  });

  // BUSINESS LOGIC: Rejecting/Cancelling approved application reverts pet to AVAILABLE
  await test('Business Logic: Rejecting/Cancelling approved application reverts pet to AVAILABLE', async () => {
    db.adoption_applications = db.adoption_applications.filter(a => a.id !== 'app-fake-2');

    const res = await request(`/api/applications/${applicationId}/status`, {
      method: 'PATCH',
      token: 'admin-token',
      body: {
        status: 'CANCELLED',
        review_notes: 'Adopter had to relocate',
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'CANCELLED');
    assert.strictEqual(res.body.data.pet.status, 'AVAILABLE');

    const petRes = await request(`/api/pets/${createdPetId}`);
    assert.strictEqual(petRes.body.data.status, 'AVAILABLE');
  });

  // DELETE APPLICATION
  await test('DELETE /api/applications/:id deletes application', async () => {
    const res = await request(`/api/applications/${applicationId}`, {
      method: 'DELETE',
      token: 'admin-token',
    });
    assert.strictEqual(res.status, 200);

    const checkRes = await request(`/api/applications/${applicationId}`, {
      token: 'admin-token',
    });
    assert.strictEqual(checkRes.status, 404);
  });

  // CLEANUP PET
  await test('DELETE /api/pets/:id deletes pet successfully', async () => {
    const res = await request(`/api/pets/${createdPetId}`, {
      method: 'DELETE',
      token: 'admin-token',
    });
    assert.strictEqual(res.status, 200);

    const checkRes = await request(`/api/pets/${createdPetId}`);
    assert.strictEqual(checkRes.status, 404);
  });

  // --- SECTION 5: EDGE CASES & VALIDATIONS ---
  console.log('\n--- 5. Edge Cases & Boundary Conditions ---');

  await test('Pet POST rejects invalid enum size', async () => {
    const res = await request('/api/pets', {
      method: 'POST',
      token: 'admin-token',
      body: { name: 'Doggo', category_id: 'cat-1', breed: 'Mixed', size: 'GIANT' },
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Invalid size'));
  });

  await test('Pet POST rejects invalid enum gender', async () => {
    const res = await request('/api/pets', {
      method: 'POST',
      token: 'admin-token',
      body: { name: 'Doggo', category_id: 'cat-1', breed: 'Mixed', gender: 'ALIEN' },
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Invalid gender'));
  });

  await test('Pet POST rejects invalid enum status', async () => {
    const res = await request('/api/pets', {
      method: 'POST',
      token: 'admin-token',
      body: { name: 'Doggo', category_id: 'cat-1', breed: 'Mixed', status: 'UNKNOWN_STATUS' },
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Invalid status'));
  });

  await test('Application PATCH status rejects invalid status value', async () => {
    // create a temp application
    const tempApp = {
      id: 'app-edge-1',
      pet_id: 'pet-1',
      applicant_id: 'user-uuid-1',
      status: 'SUBMITTED',
      living_condition: 'House',
      has_other_pets: false,
      reason_for_adoption: 'Good care',
    };
    db.adoption_applications.push(tempApp);

    const res = await request('/api/applications/app-edge-1/status', {
      method: 'PATCH',
      token: 'admin-token',
      body: { status: 'DISMISSED' },
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Invalid status'));

    db.adoption_applications = db.adoption_applications.filter(a => a.id !== 'app-edge-1');
  });

  await test('Adopter cannot update another user application', async () => {
    const otherApp = {
      id: 'app-other-user',
      pet_id: 'pet-1',
      applicant_id: 'user-uuid-2',
      status: 'SUBMITTED',
      living_condition: 'House',
      has_other_pets: false,
      reason_for_adoption: 'Good care',
    };
    db.adoption_applications.push(otherApp);

    const res = await request('/api/applications/app-other-user', {
      method: 'PUT',
      token: 'user-token-1',
      body: { living_condition: 'Hacked condition' },
    });
    assert.strictEqual(res.status, 403);

    db.adoption_applications = db.adoption_applications.filter(a => a.id !== 'app-other-user');
  });

  await test('Adopter cannot delete another user application', async () => {
    const otherApp = {
      id: 'app-other-delete',
      pet_id: 'pet-1',
      applicant_id: 'user-uuid-2',
      status: 'SUBMITTED',
      living_condition: 'House',
      has_other_pets: false,
      reason_for_adoption: 'Good care',
    };
    db.adoption_applications.push(otherApp);

    const res = await request('/api/applications/app-other-delete', {
      method: 'DELETE',
      token: 'user-token-1',
    });
    assert.strictEqual(res.status, 403);

    db.adoption_applications = db.adoption_applications.filter(a => a.id !== 'app-other-delete');
  });

  await test('Inquiry rejects empty message', async () => {
    const res = await request('/api/pets/pet-1/inquiries', {
      method: 'POST',
      token: 'user-token-1',
      body: { message: '   ' },
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Message is required'));
  });

  await test('Inquiry fails for non-existent pet', async () => {
    const res = await request('/api/pets/ghost-pet/inquiries', {
      method: 'POST',
      token: 'user-token-1',
      body: { message: 'Is this pet real?' },
    });
    assert.strictEqual(res.status, 404);
  });

  await test('DELETE non-existent pet returns 404', async () => {
    const res = await request('/api/pets/ghost-pet', {
      method: 'DELETE',
      token: 'admin-token',
    });
    assert.strictEqual(res.status, 404);
  });

  await test('DELETE non-existent category returns 404', async () => {
    const res = await request('/api/categories/ghost-cat', {
      method: 'DELETE',
      token: 'admin-token',
    });
    assert.strictEqual(res.status, 404);
  });

  await test('DELETE non-existent application returns 404', async () => {
    const res = await request('/api/applications/ghost-app', {
      method: 'DELETE',
      token: 'admin-token',
    });
    assert.strictEqual(res.status, 404);
  });

  console.log('\n=======================================');
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('=======================================');

  server.close();
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
