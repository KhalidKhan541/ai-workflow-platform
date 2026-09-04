import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, validateBody } from '@/lib/api-utils';
import { registerSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(registerSchema, body);
    if (!validation.success) return validation.response;

    const { email, name, password, orgName } = validation.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          emailVerified: null,
        },
      });

      const slug = orgName
        ? orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : `org-${uuidv4().substring(0, 8)}`;

      const org = await tx.organization.create({
        data: {
          name: orgName || `${name}'s Organization`,
          slug,
          ownerId: user.id,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: 'OWNER',
        },
      });

      const verificationToken = await tx.verificationToken.create({
        data: {
          identifier: email,
          token: uuidv4(),
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return { user, org, verificationToken };
    });

    // TODO: Send verification email with result.verificationToken.token

    return successResponse(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        organization: {
          id: result.org.id,
          name: result.org.name,
          slug: result.org.slug,
        },
        message: 'Registration successful. Please check your email for verification.',
      },
      201
    );
  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse('Registration failed', 500);
  }
}
