/**
 * UI-level capability map. This only decides what to SHOW.
 * Real enforcement happens in Postgres RLS + storage policies, and every
 * server action re-checks the role from the database (never from the client).
 */
export type Role = "owner" | "viewer";

export type Action =
  | "entry:read"
  | "entry:create"
  | "entry:update"
  | "entry:delete"
  | "attachment:read"
  | "attachment:upload"
  | "attachment:delete"
  | "audio:record"
  | "draft:use"
  | "diary:export"
  | "profile:update-own"
  | "password:change-own";

const CAPABILITIES: Record<Role, ReadonlySet<Action>> = {
  owner: new Set<Action>([
    "entry:read",
    "entry:create",
    "entry:update",
    "entry:delete",
    "attachment:read",
    "attachment:upload",
    "attachment:delete",
    "audio:record",
    "draft:use",
    "diary:export",
    "profile:update-own",
    "password:change-own",
  ]),
  viewer: new Set<Action>(["entry:read", "attachment:read", "profile:update-own", "password:change-own"]),
};

export function isRole(value: unknown): value is Role {
  return value === "owner" || value === "viewer";
}

export function can(role: Role | null | undefined, action: Action): boolean {
  if (!role || !isRole(role)) return false;
  return CAPABILITIES[role].has(action);
}
