-- ==============================================================================
-- Pet Adoption Database Schema (Supabase / PostgreSQL)
-- Architecture: CyberSec-69 Standard
-- ==============================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom ENUM Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'SHELTER_STAFF', 'ADOPTER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pet_status AS ENUM ('AVAILABLE', 'PENDING', 'ADOPTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pet_gender AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pet_size AS ENUM ('SMALL', 'MEDIUM', 'LARGE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    role user_role NOT NULL DEFAULT 'ADOPTER',
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Categories Table (Pet Types: Dog, Cat, Bird, Rabbit, etc.)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4.1 Shelters Table (เทียบเท่า Department ใน Strapi: ศูนย์พักพิงสัตว์)
CREATE TABLE IF NOT EXISTS public.shelters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    location TEXT NOT NULL,
    contact_phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Pets Table
CREATE TABLE IF NOT EXISTS public.pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    breed TEXT NOT NULL,
    age_months INTEGER NOT NULL DEFAULT 0,
    gender pet_gender NOT NULL DEFAULT 'UNKNOWN',
    size pet_size NOT NULL DEFAULT 'MEDIUM',
    status pet_status NOT NULL DEFAULT 'AVAILABLE',
    description TEXT,
    medical_history TEXT,
    vaccinated BOOLEAN NOT NULL DEFAULT false,
    spayed_neutered BOOLEAN NOT NULL DEFAULT false,
    image_url TEXT,
    shelter_id UUID REFERENCES public.shelters(id) ON DELETE SET NULL,
    shelter_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Adoption Applications Table
CREATE TABLE IF NOT EXISTS public.adoption_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status application_status NOT NULL DEFAULT 'SUBMITTED',
    living_condition TEXT NOT NULL,
    has_other_pets BOOLEAN NOT NULL DEFAULT false,
    reason_for_adoption TEXT NOT NULL,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Pet Inquiries / Comments Table
CREATE TABLE IF NOT EXISTS public.pet_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 8. Functions & Triggers
-- ==============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
CREATE TRIGGER set_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_shelters_updated_at ON public.shelters;
CREATE TRIGGER set_shelters_updated_at
BEFORE UPDATE ON public.shelters
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_pets_updated_at ON public.pets;
CREATE TRIGGER set_pets_updated_at
BEFORE UPDATE ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_applications_updated_at ON public.adoption_applications;
CREATE TRIGGER set_applications_updated_at
BEFORE UPDATE ON public.adoption_applications
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to automatically create profile on Supabase auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'ADOPTER'::user_role)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 9. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adoption_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_inquiries ENABLE ROW LEVEL SECURITY;

-- Helper function: Is Admin or Shelter Staff
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SHELTER_STAFF')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Anyone authenticated can view their own profile; Admin can view all
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR public.is_admin_or_staff());

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- Categories: Anyone can read, only Admin/Staff can manage
CREATE POLICY "Public read categories" ON public.categories
    FOR SELECT TO public
    USING (true);

CREATE POLICY "Admin/Staff manage categories" ON public.categories
    FOR ALL TO authenticated
    USING (public.is_admin_or_staff());

-- Shelters: Anyone can read, only Admin/Staff can manage
CREATE POLICY "Public read shelters" ON public.shelters
    FOR SELECT TO public
    USING (true);

CREATE POLICY "Admin/Staff manage shelters" ON public.shelters
    FOR ALL TO authenticated
    USING (public.is_admin_or_staff());

-- Pets: Anyone can read available pets; Staff/Admin can manage all
CREATE POLICY "Public read available pets" ON public.pets
    FOR SELECT TO public
    USING (status = 'AVAILABLE' OR public.is_admin_or_staff());

CREATE POLICY "Staff/Admin manage pets" ON public.pets
    FOR ALL TO authenticated
    USING (public.is_admin_or_staff());

-- Adoption Applications:
-- Adopters can view their own applications
CREATE POLICY "Adopters view own applications" ON public.adoption_applications
    FOR SELECT TO authenticated
    USING (applicant_id = auth.uid() OR public.is_admin_or_staff());

-- Adopters can submit applications
CREATE POLICY "Adopters submit applications" ON public.adoption_applications
    FOR INSERT TO authenticated
    WITH CHECK (applicant_id = auth.uid());

-- Staff/Admin can update application status
CREATE POLICY "Staff/Admin update applications" ON public.adoption_applications
    FOR UPDATE TO authenticated
    USING (public.is_admin_or_staff());

-- Inquiries: Anyone authenticated can read inquiries for a pet, users can post
CREATE POLICY "Authenticated users view inquiries" ON public.pet_inquiries
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users create inquiries" ON public.pet_inquiries
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- 10. Storage Bucket Setup
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-images', 'pet-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access to Pet Images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pet-images');

CREATE POLICY "Authenticated Users Upload Pet Images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pet-images');
