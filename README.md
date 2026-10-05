# 🐾 Pet Adoption API (Supabase Backend)

ระบบ API สำหรับแพลตฟอร์มศูนย์รับเลี้ยงสัตว์ (Pet Adoption Platform) ขับเคลื่อนด้วย **Supabase (PostgreSQL, Supabase Auth, Row Level Security, Storage)** โดยประยุกต์รูปแบบการบริหารจัดการทีม การแบ่งงาน 3 คน และการทดสอบระบบแบบเดียวกับมาตรฐาน `cybersec-69`

---

## 👥 การแบ่งหน้าที่ในทีม 3 คน (Team Roles & Responsibilities)

การแบ่งงานแบ่งตามความรับผิดชอบอย่างชัดเจน (Separation of Concerns) เพื่อให้ทั้ง 3 คนทำงานคู่ขนานกันได้โดยไม่เกิดโค้ดขัดแย้ง:

| สมาชิก | บทบาท / ตำแหน่ง | Git Branch | ชิ้นงานหลักที่ส่งมอบ (Deliverables) |
| :--- | :--- | :--- | :--- |
| **สมาชิกคนที่ 1** | **Database & Supabase Lead**<br>(โครงสร้างข้อมูลและสคริปต์) | `feat/supabase-db` | • `supabase/schema.sql` (Tables, Enums, Triggers, RLS)<br>• `supabase/seed.sql` & `supabase/seed.ts`<br>• `.env.simple` & `.env.example`<br>• ออกแบบความสัมพันธ์ ERD & Models |
| **สมาชิกคนที่ 2** | **Auth, Security & Storage Lead**<br>(ระบบล็อกอินและสิทธิ์) | `feat/supabase-auth-storage` | • การตั้งค่า Supabase Auth Client (`supabaseClient.ts`)<br>• Middleware ยืนยันตัวตน (`auth.ts`) & แยก Role Guard<br>• Auth Endpoints (`/admin/login`, `/api/auth/...`)<br>• Storage Bucket (`pet-images`) สำหรับภาพสัตว์เลี้ยง |
| **สมาชิกคนที่ 3** | **REST API & Testing Lead**<br>(ฟังก์ชันทางธุรกิจและการทดสอบ) | `feat/api-testing` | • CRUD Endpoints (Categories, Pets, Applications)<br>• Business Logic (การเปลี่ยนสถานะสัตว์เมื่อคำขออนุมัติ)<br>• **ไฟล์ทดสอบ `api.http.simple`** (รันด้วย VS Code REST Client)<br>• จัดทำเอกสารคู่มือทดสอบและตรวจสอบ Response |

---

## 🌿 โครงสร้าง Git Branches & Workflow

```text
main (Production / Complete Release)
  ├── feat/supabase-db             (คนที่ 1: Schema, Database Tables, Triggers, Seed Data)
  ├── feat/supabase-auth-storage   (คนที่ 2: Auth Flow, RLS, Storage Bucket, Middleware)
  └── feat/api-testing             (คนที่ 3: CRUD Routes, Business Rules, api.http.simple)
```

### ลำดับขั้นตอนการส่งมอบงาน (Handover Timeline):
1. **Phase 1 (คนที่ 1)**: สร้าง Branch `feat/supabase-db` วางโครงสร้างตารางใน `schema.sql` รัน Seed ข้อมูลสัตว์และหมวดหมู่ จากนั้น Merge เข้าสู่ `main`
2. **Phase 2 (คนที่ 2)**: แตก Branch `feat/supabase-auth-storage` จาก `main` เชื่อมต่อ Supabase Auth และทดสอบ JWT Token, Profile, Role Middleware จากนั้น Merge เข้าสู่ `main`
3. **Phase 3 (คนที่ 3)**: แตก Branch `feat/api-testing` เชื่อมโยง Routes จัดการข้อมูลสัตว์เลี้ยงและคำขอรับเลี้ยง เขียนและยิงทดสอบด้วย `api.http.simple` จนผ่านครบ 100% แล้ว Merge เข้า `main`

---

## 🗄️ โครงสร้างฐานข้อมูล (Database Schema)

| ตาราง (Table) | หน้าที่ | คอลัมน์สำคัญ |
| :--- | :--- | :--- |
| **`profiles`** | บัญชีผู้ใช้งานและเจ้าหน้าที่ | `id` (FK auth.users), `email`, `first_name`, `last_name`, `role` (`ADMIN`, `SHELTER_STAFF`, `ADOPTER`), `phone` |
| **`categories`** | หมวดหมู่/ชนิดสัตว์ | `id`, `name` (Dog, Cat, Rabbit, Bird ฯลฯ), `description`, `icon_url` |
| **`pets`** | ข้อมูลสัตว์เลี้ยงหาบ้าน | `id`, `name`, `category_id`, `breed`, `age_months`, `gender`, `size`, `status` (`AVAILABLE`, `PENDING`, `ADOPTED`), `image_url` |
| **`adoption_applications`** | ใบคำขอรับเลี้ยงสัตว์ | `id`, `pet_id`, `applicant_id`, `status` (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`), `living_condition` |
| **`pet_inquiries`** | ถาม-ตอบเกี่ยวกับสัตว์เลี้ยง | `id`, `pet_id`, `user_id`, `message`, `created_at` |

---

## 🚀 สถาปัตยกรรมการใช้งานร่วมกับ Supabase

สามารถเลือกใช้งานได้ตามความเหมาะสม:
1. **ทางเลือกที่ 1: ใช้ Express Gateway (พร้อมใช้งานในโปรเจกต์นี้)**:
   - เหมาะสำหรับการทำ API รวมศูนย์ที่มี Custom Middleware และการตรวจจับความปลอดภัย
   - รันด้วยพอร์ต `9091` (กำหนดใน `.env.simple`)
2. **ทางเลือกที่ 2: ใช้ Supabase PostgREST โดยตรง (Pure BaaS)**:
   - สามารถยิง REST API ตรงไปยัง Supabase URL โดยมี RLS เป็นตัวควบคุมสิทธิ์

---

## 🧪 การทดสอบด้วย `api.http.simple`

ไฟล์ `api.http.simple` ถูกแบ่งโครงสร้างเป็น 3 ส่วนหลัก (เหมือนใน `cybersec-69`):
1. **1. Admin**: ล็อกอินแอดมิน (`POST /admin/login`) และดูโปรไฟล์ (`GET /admin/users/me`)
2. **2. User**: สมัครสมาชิก (`POST /api/auth/register`), ล็อกอิน (`POST /api/auth/login`), รีเซ็ตรหัสผ่าน, ดูโปรไฟล์
3. **3. Content**:
   - `3.1 Categories`: จัดการชนิดสัตว์ (CRUD)
   - `3.2 Pets`: ค้นหาสัตว์เลี้ยง กรองตามเงื่อนไข ลงทะเบียนสัตว์ใหม่ และสอบถามข้อมูล
   - `3.3 Adoption Applications`: ยื่นคำขอรับเลี้ยง ตรวจสอบสถานะ และแอดมินอนุมัติ/ปฏิเสธ

---

## 🛠️ วิธีการติดตั้งและเริ่มต้นใช้งาน

1. โคลนโปรเจกต์และติดตั้ง Dependencies:
   ```bash
   npm install
   ```

2. คัดลอกและตั้งค่า Environment:
   ```bash
   cp .env.simple .env
   ```
   (นำค่า `SUPABASE_URL` และ `SUPABASE_ANON_KEY` จาก Supabase Dashboard มาใส่ใน `.env`)

3. รันสคริปต์ SQL บน Supabase:
   - นำโค้ดใน `supabase/schema.sql` ไป Execute ใน **SQL Editor** ของ Supabase Dashboard
   - นำโค้ดใน `supabase/seed.sql` ไป Execute เพื่อใส่ข้อมูลเริ่มต้น

4. เริ่มต้นรันเซิร์ฟเวอร์:
   ```bash
   npm run dev
   ```

5. เปิดไฟล์ `api.http.simple` ใน VS Code แล้วกดคลิก **"Send Request"** เพื่อทดสอบทีละข้อ

---

## 🚀 เอกสารข้อกำหนดโครงการ (Project Specification)
- [เอกสารข้อกำหนดโครงการฉบับเต็ม (PDF)](./Pet_Adoption_API_Project_Specification.pdf)
- [คู่มือระบบ Dashboard ของ Supabase vs Strapi (PDF แยก)](./Supabase_Studio_Dashboard_Guide.pdf)
- เอกสารทั้งหมดถูกส่งมอบไว้ในโฟลเดอร์: `Downloads/` ของเครื่องเรียบร้อยแล้ว
