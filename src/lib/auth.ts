import { NextAuthOptions, getServerSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { config } from "./config";
import { AuthError } from "./errors";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      role: Role;
      orgId: string | null;
      orgSlug: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role?: Role;
    orgId?: string | null;
    orgSlug?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role: Role;
    orgId: string | null;
    orgSlug: string | null;
  }
}

async function getUserWithOrg(userId: string) {
  const membership = await prisma.orgMember.findFirst({
    where: {
      userId,
      organization: { isDeleted: false },
    },
    include: {
      organization: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return membership;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
    maxAge: config.auth.maxAge,
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
    newUser: "/onboarding",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw AuthError.invalidCredentials();
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email.toLowerCase().trim(),
            isDeleted: false,
          },
        });

        if (!user) {
          throw AuthError.invalidCredentials();
        }

        if (!user.isActive) {
          throw AuthError.accountDisabled();
        }

        if (!user.passwordHash) {
          throw new AuthError(
            "This account uses social login. Please sign in with your provider.",
            "OAUTH_ONLY"
          );
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValidPassword) {
          throw AuthError.invalidCredentials();
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),

    ...(config.auth.providers.google.clientId
      ? [
          GoogleProvider({
            clientId: config.auth.providers.google.clientId!,
            clientSecret: config.auth.providers.google.clientSecret!,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),

    ...(config.auth.providers.github.clientId
      ? [
          GitHubProvider({
            clientId: config.auth.providers.github.clientId!,
            clientSecret: config.auth.providers.github.clientSecret!,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
      }

      if (trigger === "update" && session) {
        token.name = session.user.name ?? token.name;
        token.image = session.user.image ?? token.image;
      }

      const membership = await getUserWithOrg(token.id);
      token.role = (membership?.role as Role) ?? "VIEWER";
      token.orgId = membership?.organization.id ?? null;
      token.orgSlug = membership?.organization.slug ?? null;

      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        name: token.name,
        image: token.image,
        role: token.role,
        orgId: token.orgId,
        orgSlug: token.orgSlug,
      };

      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider !== "credentials") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (existingUser && !existingUser.isActive) {
          return false;
        }

        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { lastLoginAt: new Date() },
          });
        }
      }

      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      if (isNewUser && user.email) {
        const orgName = `${user.name || "My"}'s Workspace`;
        const slug = `${(user.name || "workspace")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;

        const org = await prisma.organization.create({
          data: {
            name: orgName,
            slug,
            ownerId: user.id!,
            members: {
              create: {
                userId: user.id!,
                role: "OWNER",
                acceptedAt: new Date(),
              },
            },
            subscriptions: {
              create: {
                userId: user.id!,
                plan: "FREE",
                status: "active",
                monthlyExecQuota: 100,
              },
            },
          },
        });

        log.info("New user onboarded", {
          userId: user.id,
          orgId: org.id,
          provider: account?.provider,
        });
      }
    },
    async signOut({ session }) {
      log.info("User signed out", {
        userId: session?.user?.id,
      });
    },
  },
  logger: {
    error(code, metadata) {
      log.error("NextAuth error", {
        code,
        metadata: metadata as Record<string, unknown>,
      });
    },
    warn(code) {
      log.warn("NextAuth warning", { code });
    },
    debug(code, metadata) {
      log.debug("NextAuth debug", {
        code,
        metadata: metadata as Record<string, unknown>,
      });
    },
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw AuthError.invalidCredentials();
  }
  return session;
}

export async function requireOrgMembership() {
  const session = await requireSession();
  if (!session.user.orgId) {
    throw AuthError.insufficientPermissions("organization membership");
  }
  return session;
}

const log = logger.child("auth");
