-- ==============================================================================
-- Pet Adoption Seed Data (Supabase / PostgreSQL)
-- Architecture: CyberSec-69 Standard
-- ==============================================================================

-- 1. Insert Categories
INSERT INTO public.categories (id, name, description, icon_url)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Dog', 'Friendly canines of all breeds and sizes looking for loving homes', 'https://images.unsplash.com/photo-1543466835-00a7907e9de1'),
    ('c2222222-2222-2222-2222-222222222222', 'Cat', 'Affectionate and playful cats and kittens', 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba'),
    ('c3333333-3333-3333-3333-333333333333', 'Rabbit', 'Gentle and cuddly bunnies seeking quiet and caring adopters', 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308'),
    ('c4444444-4444-4444-4444-444444444444', 'Bird', 'Colorful and chirpy companion birds', 'https://images.unsplash.com/photo-1522858547550-3456a529323f')
ON CONFLICT (name) DO NOTHING;

-- 1.1 Insert Shelters (เทียบเท่า Department ใน Strapi)
INSERT INTO public.shelters (id, name, location, contact_phone, email)
VALUES
    ('s1111111-1111-1111-1111-111111111111', 'Bangkok Paws Rescue Shelter', 'Chatuchak, Bangkok', '02-123-4567', 'contact@bangkokpaws.org'),
    ('s2222222-2222-2222-2222-222222222222', 'Chiang Mai Animal Haven', 'Mae Rim, Chiang Mai', '053-987-654', 'haven@cm-animals.org')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Sample Pets
INSERT INTO public.pets (
    id, name, category_id, breed, age_months, gender, size, status,
    description, medical_history, vaccinated, spayed_neutered, image_url
)
VALUES
    (
        'b1111111-1111-1111-1111-111111111111',
        'Milo',
        'c1111111-1111-1111-1111-111111111111',
        'Golden Retriever Mix',
        14,
        'MALE',
        'LARGE',
        'AVAILABLE',
        'Very playful, friendly with kids and other dogs. Loves fetch and swimming.',
        'Fully checked, microchipped, dewormed.',
        true,
        true,
        'https://images.unsplash.com/photo-1552053831-71594a27632d'
    ),
    (
        'b2222222-2222-2222-2222-222222222222',
        'Luna',
        'c2222222-2222-2222-2222-222222222222',
        'British Shorthair',
        8,
        'FEMALE',
        'SMALL',
        'AVAILABLE',
        'Calm and affectionate kitten. Loves lounging in sunny spots and gentle scratches.',
        'Core vaccinations completed, flea treatment up to date.',
        true,
        true,
        'https://images.unsplash.com/photo-1518791841217-8f162f1e1131'
    ),
    (
        'b3333333-3333-3333-3333-333333333333',
        'Coco',
        'c3333333-3333-3333-3333-333333333333',
        'Holland Lop',
        6,
        'FEMALE',
        'SMALL',
        'AVAILABLE',
        'Sweet rabbit trained for indoor litter box. Enjoys hay and leafy greens.',
        'Healthy checkup, ears and teeth examined.',
        true,
        false,
        'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308'
    ),
    (
        'b4444444-4444-4444-4444-444444444444',
        'Rocky',
        'c1111111-1111-1111-1111-111111111111',
        'Siberian Husky',
        24,
        'MALE',
        'LARGE',
        'PENDING',
        'High energy dog that loves jogging and outdoor adventures. Needs active owner.',
        'Up to date on rabies and distemper vaccines.',
        true,
        true,
        'https://images.unsplash.com/photo-1605568427561-40dd23c2acea'
    ),
    (
        'b5555555-5555-5555-5555-555555555555',
        'Bella',
        'c2222222-2222-2222-2222-222222222222',
        'Persian Cat',
        18,
        'FEMALE',
        'MEDIUM',
        'ADOPTED',
        'Graceful and quiet. Successfully adopted into a loving home.',
        'Fully vaccinated and groomed.',
        true,
        true,
        'https://images.unsplash.com/photo-1513360309081-38f07627399e'
    )
ON CONFLICT (id) DO NOTHING;
