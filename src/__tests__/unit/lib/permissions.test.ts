import {
  hasPermission,
  hasRoleLevel,
  canManageRole,
  getPermissionsForRole,
  getAllowedActions,
  isOwner,
  canTransferOwnership,
  Role,
} from '@/lib/permissions';

describe('Permissions (RBAC)', () => {
  describe('hasPermission', () => {
    it('SUPER_ADMIN has all permissions', () => {
      expect(hasPermission('SUPER_ADMIN', 'workflow', 'create')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'workflow', 'delete')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'organization', 'manage')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'member', 'manage')).toBe(true);
    });

    it('ADMIN has most permissions but not org manage', () => {
      expect(hasPermission('ADMIN', 'workflow', 'create')).toBe(true);
      expect(hasPermission('ADMIN', 'workflow', 'delete')).toBe(true);
      expect(hasPermission('ADMIN', 'organization', 'manage')).toBe(false);
      expect(hasPermission('ADMIN', 'organization', 'read')).toBe(true);
    });

    it('MEMBER has limited permissions', () => {
      expect(hasPermission('MEMBER', 'workflow', 'create')).toBe(true);
      expect(hasPermission('MEMBER', 'workflow', 'read')).toBe(true);
      expect(hasPermission('MEMBER', 'workflow', 'delete')).toBe(false);
      expect(hasPermission('MEMBER', 'execution', 'read')).toBe(true);
      expect(hasPermission('MEMBER', 'member', 'read')).toBe(true);
      expect(hasPermission('MEMBER', 'member', 'update')).toBe(false);
    });

    it('VIEWER has only read permissions', () => {
      expect(hasPermission('VIEWER', 'workflow', 'read')).toBe(true);
      expect(hasPermission('VIEWER', 'workflow', 'create')).toBe(false);
      expect(hasPermission('VIEWER', 'workflow', 'update')).toBe(false);
      expect(hasPermission('VIEWER', 'workflow', 'delete')).toBe(false);
      expect(hasPermission('VIEWER', 'integration', 'read')).toBe(true);
    });

    it('returns false for unknown role', () => {
      expect(hasPermission('UNKNOWN' as Role, 'workflow', 'read')).toBe(false);
    });

    it('returns false for unknown resource', () => {
      expect(hasPermission('ADMIN', 'nonexistent' as any, 'read')).toBe(false);
    });
  });

  describe('hasRoleLevel', () => {
    it('SUPER_ADMIN >= all roles', () => {
      expect(hasRoleLevel('SUPER_ADMIN', 'ADMIN')).toBe(true);
      expect(hasRoleLevel('SUPER_ADMIN', 'MEMBER')).toBe(true);
      expect(hasRoleLevel('SUPER_ADMIN', 'VIEWER')).toBe(true);
    });

    it('ADMIN >= MEMBER and VIEWER', () => {
      expect(hasRoleLevel('ADMIN', 'MEMBER')).toBe(true);
      expect(hasRoleLevel('ADMIN', 'VIEWER')).toBe(true);
      expect(hasRoleLevel('ADMIN', 'SUPER_ADMIN')).toBe(false);
    });

    it('MEMBER >= VIEWER', () => {
      expect(hasRoleLevel('MEMBER', 'VIEWER')).toBe(true);
      expect(hasRoleLevel('MEMBER', 'ADMIN')).toBe(false);
    });

    it('VIEWER is lowest level', () => {
      expect(hasRoleLevel('VIEWER', 'VIEWER')).toBe(true);
      expect(hasRoleLevel('VIEWER', 'MEMBER')).toBe(false);
    });
  });

  describe('canManageRole', () => {
    it('SUPER_ADMIN can manage anyone', () => {
      expect(canManageRole('SUPER_ADMIN', 'ADMIN')).toBe(true);
      expect(canManageRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
    });

    it('ADMIN can manage MEMBER and VIEWER', () => {
      expect(canManageRole('ADMIN', 'MEMBER')).toBe(true);
      expect(canManageRole('ADMIN', 'VIEWER')).toBe(true);
      expect(canManageRole('ADMIN', 'ADMIN')).toBe(false);
      expect(canManageRole('ADMIN', 'SUPER_ADMIN')).toBe(false);
    });

    it('MEMBER cannot manage anyone', () => {
      expect(canManageRole('MEMBER', 'VIEWER')).toBe(false);
      expect(canManageRole('MEMBER', 'MEMBER')).toBe(false);
    });

    it('VIEWER cannot manage anyone', () => {
      expect(canManageRole('VIEWER', 'VIEWER')).toBe(false);
    });
  });

  describe('getPermissionsForRole', () => {
    it('returns permissions for valid role', () => {
      const perms = getPermissionsForRole('ADMIN');
      expect(perms.length).toBeGreaterThan(0);
      expect(perms.some((p) => p.resource === 'workflow')).toBe(true);
    });

    it('returns empty for unknown role', () => {
      expect(getPermissionsForRole('UNKNOWN' as Role)).toEqual([]);
    });
  });

  describe('getAllowedActions', () => {
    it('returns all actions for SUPER_ADMIN', () => {
      const actions = getAllowedActions('SUPER_ADMIN', 'workflow');
      expect(actions).toContain('create');
      expect(actions).toContain('read');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
      expect(actions).toContain('execute');
    });

    it('returns read-only for VIEWER', () => {
      const actions = getAllowedActions('VIEWER', 'workflow');
      expect(actions).toEqual(['read']);
    });

    it('returns empty for unknown resource', () => {
      expect(getAllowedActions('ADMIN', 'nonexistent' as any)).toEqual([]);
    });
  });

  describe('isOwner', () => {
    it('SUPER_ADMIN is always owner', () => {
      expect(isOwner('SUPER_ADMIN')).toBe(true);
      expect(isOwner('SUPER_ADMIN', 'MEMBER')).toBe(true);
    });

    it('membership OWNER is owner', () => {
      expect(isOwner('MEMBER', 'OWNER')).toBe(true);
    });

    it('non-owner returns false', () => {
      expect(isOwner('MEMBER', 'MEMBER')).toBe(false);
      expect(isOwner('ADMIN', undefined)).toBe(false);
    });
  });

  describe('canTransferOwnership', () => {
    it('SUPER_ADMIN can transfer', () => {
      expect(canTransferOwnership('SUPER_ADMIN', 'ADMIN')).toBe(true);
    });

    it('OWNER membership can transfer', () => {
      expect(canTransferOwnership('ADMIN', 'OWNER')).toBe(true);
    });

    it('non-owner cannot transfer', () => {
      expect(canTransferOwnership('ADMIN', 'ADMIN')).toBe(false);
      expect(canTransferOwnership('MEMBER', 'MEMBER')).toBe(false);
    });
  });

  describe('resource-specific permissions', () => {
    it('MEMBER can execute workflows', () => {
      expect(hasPermission('MEMBER', 'workflow', 'execute')).toBe(true);
    });

    it('VIEWER cannot execute workflows', () => {
      expect(hasPermission('VIEWER', 'workflow', 'execute')).toBe(false);
    });

    it('ADMIN can manage integrations', () => {
      expect(hasPermission('ADMIN', 'integration', 'manage')).toBe(false);
      expect(hasPermission('ADMIN', 'integration', 'create')).toBe(true);
    });

    it('MEMBER can create API keys but not delete', () => {
      expect(hasPermission('MEMBER', 'apikey', 'create')).toBe(true);
      expect(hasPermission('MEMBER', 'apikey', 'delete')).toBe(false);
    });

    it('MEMBER can manage webhooks', () => {
      expect(hasPermission('MEMBER', 'webhook', 'create')).toBe(true);
      expect(hasPermission('MEMBER', 'webhook', 'update')).toBe(true);
      expect(hasPermission('MEMBER', 'webhook', 'delete')).toBe(false);
    });

    it('MEMBER can manage AI agents', () => {
      expect(hasPermission('MEMBER', 'ai_agent', 'create')).toBe(true);
      expect(hasPermission('MEMBER', 'ai_agent', 'update')).toBe(true);
      expect(hasPermission('MEMBER', 'ai_agent', 'delete')).toBe(false);
    });
  });
});
