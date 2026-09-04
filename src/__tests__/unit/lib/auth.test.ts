import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken, hasRole, canAccessOrg, maskToken, AuthUser } from '@/lib/auth';

describe('Auth', () => {
  const testUser: AuthUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'MEMBER',
    orgId: 'org-1',
  };

  describe('JWT generation and verification', () => {
    it('should generate and verify an access token', async () => {
      const token = await generateAccessToken(testUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const payload = await verifyAccessToken(token);
      expect(payload.userId).toBe('user-1');
      expect(payload.email).toBe('test@example.com');
      expect(payload.role).toBe('MEMBER');
      expect(payload.orgId).toBe('org-1');
    });

    it('should generate and verify a refresh token', async () => {
      const token = await generateRefreshToken('user-1');
      expect(typeof token).toBe('string');

      const payload = await verifyRefreshToken(token);
      expect(payload.userId).toBe('user-1');
    });

    it('should reject an invalid token', async () => {
      await expect(verifyAccessToken('invalid.token.here')).rejects.toThrow();
    });

    it('should reject a tampered token', async () => {
      const token = await generateAccessToken(testUser);
      const tampered = token.slice(0, -5) + 'XXXXX';
      await expect(verifyAccessToken(tampered)).rejects.toThrow();
    });

    it('should include issuer in token', async () => {
      const token = await generateAccessToken(testUser);
      const payload = await verifyAccessToken(token);
      expect(payload.iss).toBe('ai-workflow-platform');
    });
  });

  describe('role hierarchy', () => {
    it('SUPER_ADMIN has highest privileges', () => {
      expect(hasRole('SUPER_ADMIN', 'ADMIN')).toBe(true);
      expect(hasRole('SUPER_ADMIN', 'MEMBER')).toBe(true);
      expect(hasRole('SUPER_ADMIN', 'VIEWER')).toBe(true);
      expect(hasRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
    });

    it('ADMIN can access MEMBER level', () => {
      expect(hasRole('ADMIN', 'MEMBER')).toBe(true);
      expect(hasRole('ADMIN', 'VIEWER')).toBe(true);
      expect(hasRole('ADMIN', 'ADMIN')).toBe(true);
      expect(hasRole('ADMIN', 'SUPER_ADMIN')).toBe(false);
    });

    it('MEMBER can access VIEWER level', () => {
      expect(hasRole('MEMBER', 'VIEWER')).toBe(true);
      expect(hasRole('MEMBER', 'MEMBER')).toBe(true);
      expect(hasRole('MEMBER', 'ADMIN')).toBe(false);
    });

    it('VIEWER has minimal access', () => {
      expect(hasRole('VIEWER', 'VIEWER')).toBe(true);
      expect(hasRole('VIEWER', 'MEMBER')).toBe(false);
    });
  });

  describe('org access', () => {
    it('SUPER_ADMIN can access any org', () => {
      const admin: AuthUser = { ...testUser, role: 'SUPER_ADMIN', orgId: 'org-1' };
      expect(canAccessOrg(admin, 'org-2')).toBe(true);
    });

    it('member can only access their own org', () => {
      expect(canAccessOrg(testUser, 'org-1')).toBe(true);
      expect(canAccessOrg(testUser, 'org-2')).toBe(false);
    });
  });

  describe('maskToken', () => {
    it('should mask a long token', () => {
      const token = 'abcdefghijklmnopqrstuvwx';
      const masked = maskToken(token);
      expect(masked).toBe('abcdefgh...vwx');
      expect(masked.length).toBeLessThan(token.length);
    });

    it('should return *** for short tokens', () => {
      expect(maskToken('short')).toBe('***');
    });
  });
});
