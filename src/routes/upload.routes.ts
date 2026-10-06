import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as dbClient from '../supabaseClient';

const router = Router();

// ตั้งค่า Multer เก็บไฟล์ในหน่วยความจำ RAM (จำกัดขนาดไม่เกิน 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// POST /api/upload - อัปโหลดรูปภาพสัตว์เลี้ยงเข้า Supabase Storage
router.post('/', authenticate, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Bad Request', message: 'No image file uploaded' });
    }

    const file = req.file;
    const fileExt = file.originalname.split('.').pop();
    const fileName = `pet-${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // ส่งไฟล์ขึ้น Supabase Storage (Bucket: pet-images)
    const { error: uploadError } = await dbClient.supabaseAdmin.storage
      .from(dbClient.PET_STORAGE_BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: 'Upload Failed', message: uploadError.message });
    }

    // ดึง Public URL ของภาพที่อัปโหลดสำเร็จ
    const { data: { publicUrl } } = dbClient.supabaseAdmin.storage
      .from(dbClient.PET_STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return res.status(201).json({
      message: 'Image uploaded successfully to Supabase Storage',
      imageUrl: publicUrl,
      path: filePath,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

export default router;