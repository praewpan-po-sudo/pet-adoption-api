import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const permissionsFilePath = path.join(__dirname, '../data/permissions.json');

// Helper to read permissions
function getStoredPermissions(): Record<string, any> {
  try {
    if (fs.existsSync(permissionsFilePath)) {
      const data = fs.readFileSync(permissionsFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading permissions file:', err);
  }
  return {};
}

// Helper to save permissions
function saveStoredPermissions(permissions: Record<string, any>): boolean {
  try {
    const dir = path.dirname(permissionsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(permissionsFilePath, JSON.stringify(permissions, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing permissions file:', err);
    return false;
  }
}

// 1. Get all roles metadata
router.get('/', (_req: Request, res: Response) => {
  const allPermissions = getStoredPermissions();
  const roles = [
    {
      id: 'public',
      name: 'Public',
      description: allPermissions.public?.description || 'Default role given to unauthenticated user.',
      type: 'public',
    },
    {
      id: 'adopter',
      name: 'Adopter',
      description: allPermissions.adopter?.description || 'Authenticated users who can browse, inquire, and submit adoption applications.',
      type: 'authenticated',
    },
    {
      id: 'shelter_staff',
      name: 'Shelter Staff',
      description: allPermissions.shelter_staff?.description || 'Staff members who manage pets, categories, and review applications.',
      type: 'staff',
    },
    {
      id: 'admin',
      name: 'Admin',
      description: allPermissions.admin?.description || 'Super administrator with full system management permissions.',
      type: 'admin',
    },
  ];

  return res.json({ data: roles });
});

// 2. Get permissions for all roles
router.get('/permissions', (_req: Request, res: Response) => {
  const permissions = getStoredPermissions();
  return res.json({ data: permissions });
});

// 3. Get permissions for specific role
router.get('/:roleId/permissions', (req: Request, res: Response) => {
  const { roleId } = req.params;
  const permissions = getStoredPermissions();
  const roleKey = roleId.toLowerCase();

  if (!permissions[roleKey]) {
    return res.status(404).json({ error: 'Role not found', message: `Role '${roleId}' does not exist.` });
  }

  return res.json({
    role: roleKey,
    name: permissions[roleKey].name,
    description: permissions[roleKey].description,
    permissions: permissions[roleKey].permissions,
  });
});

// 4. Update permissions for a specific role (Admin only)
router.put('/:roleId/permissions', authenticate, requireRole(['ADMIN']), (req: AuthRequest, res: Response) => {
  const { roleId } = req.params;
  const { permissions: newPermissions, description } = req.body;
  const roleKey = roleId.toLowerCase();

  const allPermissions = getStoredPermissions();

  if (!allPermissions[roleKey]) {
    return res.status(404).json({ error: 'Role not found', message: `Role '${roleId}' does not exist.` });
  }

  if (newPermissions && typeof newPermissions === 'object') {
    // Merge actions
    Object.keys(newPermissions).forEach((collection) => {
      if (allPermissions[roleKey].permissions[collection]) {
        if (newPermissions[collection].actions) {
          Object.keys(newPermissions[collection].actions).forEach((action) => {
            if (allPermissions[roleKey].permissions[collection].actions[action]) {
              allPermissions[roleKey].permissions[collection].actions[action].enabled =
                !!newPermissions[collection].actions[action].enabled;
            }
          });
        }
      }
    });
  }

  if (description) {
    allPermissions[roleKey].description = description;
  }

  const success = saveStoredPermissions(allPermissions);
  if (!success) {
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save permissions.' });
  }

  return res.json({
    message: `Permissions for role '${allPermissions[roleKey].name}' updated successfully`,
    role: roleKey,
    permissions: allPermissions[roleKey].permissions,
  });
});

export default router;
