import { Role } from "@prisma/client";
import { ForbiddenError } from "./errors";
import { logger } from "./logger";

const log = logger.child("permissions");

export type Resource =
  | "organization"
  | "workflow"
  | "execution"
  | "integration"
  | "data_source"
  | "webhook"
  | "api_key"
  | "ai_agent"
  | "member"
  | "billing"
  | "audit_log"
  | "notification"
  | "settings";

export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "execute"
  | "share"
  | "export"
  | "manage"
  | "admin";

interface PermissionRule {
  resource: Resource;
  actions: PermissionAction[];
  description: string;
}

const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

const ROLE_PERMISSIONS: Record<Role, PermissionRule[]> = {
  OWNER: [
    { resource: "organization", actions: ["create", "read", "update", "delete", "manage", "admin"], description: "Full organization control" },
    { resource: "workflow", actions: ["create", "read", "update", "delete", "execute", "share", "export", "manage"], description: "Full workflow management" },
    { resource: "execution", actions: ["create", "read", "delete", "cancel", "export"], description: "Execution control" },
    { resource: "integration", actions: ["create", "read", "update", "delete", "manage"], description: "Integration management" },
    { resource: "data_source", actions: ["create", "read", "update", "delete", "export", "manage"], description: "Data source management" },
    { resource: "webhook", actions: ["create", "read", "update", "delete", "manage"], description: "Webhook management" },
    { resource: "api_key", actions: ["create", "read", "update", "delete", "manage"], description: "API key management" },
    { resource: "ai_agent", actions: ["create", "read", "update", "delete", "execute", "manage"], description: "AI agent management" },
    { resource: "member", actions: ["create", "read", "update", "delete", "manage"], description: "Member management" },
    { resource: "billing", actions: ["read", "update", "manage"], description: "Billing control" },
    { resource: "audit_log", actions: ["read", "export"], description: "Audit log access" },
    { resource: "notification", actions: ["create", "read", "update", "delete"], description: "Notification management" },
    { resource: "settings", actions: ["read", "update", "manage"], description: "Settings management" },
  ],
  ADMIN: [
    { resource: "organization", actions: ["read", "update"], description: "Organization settings" },
    { resource: "workflow", actions: ["create", "read", "update", "delete", "execute", "share", "export"], description: "Workflow management" },
    { resource: "execution", actions: ["create", "read", "delete", "cancel", "export"], description: "Execution control" },
    { resource: "integration", actions: ["create", "read", "update", "delete", "manage"], description: "Integration management" },
    { resource: "data_source", actions: ["create", "read", "update", "delete", "export"], description: "Data source management" },
    { resource: "webhook", actions: ["create", "read", "update", "delete"], description: "Webhook management" },
    { resource: "api_key", actions: ["create", "read", "update", "delete"], description: "API key management" },
    { resource: "ai_agent", actions: ["create", "read", "update", "delete", "execute"], description: "AI agent management" },
    { resource: "member", actions: ["create", "read", "update", "delete"], description: "Member management" },
    { resource: "billing", actions: ["read"], description: "Billing view" },
    { resource: "audit_log", actions: ["read", "export"], description: "Audit log access" },
    { resource: "notification", actions: ["create", "read", "update", "delete"], description: "Notification management" },
    { resource: "settings", actions: ["read", "update"], description: "Settings management" },
  ],
  MEMBER: [
    { resource: "organization", actions: ["read"], description: "Organization view" },
    { resource: "workflow", actions: ["create", "read", "update", "execute"], description: "Workflow management" },
    { resource: "execution", actions: ["create", "read", "cancel"], description: "Execution control" },
    { resource: "integration", actions: ["create", "read", "update"], description: "Integration management" },
    { resource: "data_source", actions: ["create", "read", "update"], description: "Data source management" },
    { resource: "webhook", actions: ["create", "read", "update"], description: "Webhook management" },
    { resource: "api_key", actions: ["create", "read", "update"], description: "API key management" },
    { resource: "ai_agent", actions: ["create", "read", "update", "execute"], description: "AI agent management" },
    { resource: "member", actions: ["read"], description: "Member view" },
    { resource: "billing", actions: ["read"], description: "Billing view" },
    { resource: "audit_log", actions: ["read"], description: "Audit log view" },
    { resource: "notification", actions: ["create", "read", "update", "delete"], description: "Notification management" },
    { resource: "settings", actions: ["read"], description: "Settings view" },
  ],
  VIEWER: [
    { resource: "organization", actions: ["read"], description: "Organization view" },
    { resource: "workflow", actions: ["read"], description: "Workflow view" },
    { resource: "execution", actions: ["read"], description: "Execution view" },
    { resource: "integration", actions: ["read"], description: "Integration view" },
    { resource: "data_source", actions: ["read"], description: "Data source view" },
    { resource: "webhook", actions: ["read"], description: "Webhook view" },
    { resource: "api_key", actions: [], description: "No API key access" },
    { resource: "ai_agent", actions: ["read"], description: "AI agent view" },
    { resource: "member", actions: ["read"], description: "Member view" },
    { resource: "billing", actions: [], description: "No billing access" },
    { resource: "audit_log", actions: [], description: "No audit log access" },
    { resource: "notification", actions: ["read"], description: "Notification view" },
    { resource: "settings", actions: ["read"], description: "Settings view" },
  ],
};

export function hasPermission(
  role: Role,
  resource: Resource,
  action: PermissionAction
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) {
    log.warn("Unknown role", { role });
    return false;
  }

  const resourcePermission = rolePermissions.find(
    (p) => p.resource === resource
  );

  if (!resourcePermission) {
    return false;
  }

  if (resourcePermission.actions.includes(action as never)) {
    return true;
  }

  if (resourcePermission.actions.includes("manage" as never)) {
    return true;
  }

  if (role === "OWNER" && resourcePermission.actions.includes("admin" as never)) {
    return true;
  }

  return false;
}

export function checkPermission(
  role: Role,
  resource: Resource,
  action: PermissionAction
): void {
  if (!hasPermission(role, resource, action)) {
    log.warn("Permission denied", { role, resource, action });
    throw ForbiddenError.insufficientPermissions(
      `${action} on ${resource}`
    );
  }
}

export function getRoleHierarchy(role: Role): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

export function isRoleHigherThan(role1: Role, role2: Role): boolean {
  return getRoleHierarchy(role1) > getRoleHierarchy(role2);
}

export function canManageRole(managerRole: Role, targetRole: Role): boolean {
  if (managerRole === "OWNER") return true;
  return isRoleHigherThan(managerRole, targetRole);
}

export function getPermissionsForRole(role: Role): PermissionRule[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function getAllowedActions(
  role: Role,
  resource: Resource
): PermissionAction[] {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) return [];

  const resourcePermission = rolePermissions.find(
    (p) => p.resource === resource
  );

  return (resourcePermission?.actions as PermissionAction[]) ?? [];
}

export function requirePermission(
  role: Role,
  resource: Resource,
  action: PermissionAction
): boolean {
  const allowed = hasPermission(role, resource, action);
  if (!allowed) {
    throw ForbiddenError.insufficientPermissions(
      `${action} on ${resource}`
    );
  }
  return true;
}

export async function verifyOrgMembership(
  userId: string,
  orgId: string,
  requiredRole?: Role
): Promise<Role> {
  const { prisma } = await import("./db");

  const membership = await prisma.orgMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
    include: {
      organization: {
        select: { isDeleted: true },
      },
    },
  });

  if (!membership || membership.organization.isDeleted) {
    throw ForbiddenError.orgMembershipRequired();
  }

  const userRole = membership.role as Role;

  if (requiredRole && !canManageRole(userRole, requiredRole)) {
    throw ForbiddenError.insufficientPermissions(
      `role ${requiredRole} or higher`
    );
  }

  return userRole;
}

export function createPermissionChecker(role: Role) {
  return {
    can: (resource: Resource, action: PermissionAction) =>
      hasPermission(role, resource, action),
    cannot: (resource: Resource, action: PermissionAction) =>
      !hasPermission(role, resource, action),
    require: (resource: Resource, action: PermissionAction) =>
      checkPermission(role, resource, action),
    allowedActions: (resource: Resource) =>
      getAllowedActions(role, resource),
    is: (targetRole: Role) => role === targetRole,
    isAtLeast: (targetRole: Role) =>
      getRoleHierarchy(role) >= getRoleHierarchy(targetRole),
    isHigherThan: (targetRole: Role) =>
      getRoleHierarchy(role) > getRoleHierarchy(targetRole),
  };
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access to the organization. Can manage billing, members, and all resources.",
  ADMIN: "Can manage most resources and members. Cannot delete the organization or manage billing.",
  MEMBER: "Can create and manage workflows, integrations, and data sources. Limited member management.",
  VIEWER: "Read-only access to the organization resources.",
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  MEMBER: "Member",
  VIEWER: "Viewer",
};
