import { getAppDb } from '../pool';

export interface DbUser {
  id: string;
  oidc_id: string;
  email: string;
  name: string | null;
  groups: string[];
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function upsertUser(profile: {
  oidcId: string;
  email: string;
  name?: string;
  groups?: string[];
  isAdmin?: boolean;
}): Promise<DbUser> {
  const sql = getAppDb()!;
  const groups = profile.groups || [];
  const isAdmin = profile.isAdmin || false;

  const [user] = await sql<DbUser[]>`
    INSERT INTO users (oidc_id, email, name, groups, is_admin)
    VALUES (${profile.oidcId}, ${profile.email}, ${profile.name || null}, ${groups}, ${isAdmin})
    ON CONFLICT (oidc_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      groups = EXCLUDED.groups,
      is_admin = EXCLUDED.is_admin
    RETURNING *
  `;
  return user;
}

export async function getUserByOidcId(oidcId: string): Promise<DbUser | null> {
  const sql = getAppDb()!;
  const [user] = await sql<DbUser[]>`
    SELECT * FROM users WHERE oidc_id = ${oidcId}
  `;
  return user || null;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const sql = getAppDb()!;
  const [user] = await sql<DbUser[]>`
    SELECT * FROM users WHERE id = ${id}
  `;
  return user || null;
}

export async function searchUsers(query: string): Promise<DbUser[]> {
  const sql = getAppDb()!;
  const pattern = `%${query}%`;
  return sql<DbUser[]>`
    SELECT * FROM users
    WHERE email ILIKE ${pattern} OR name ILIKE ${pattern}
    ORDER BY name, email
    LIMIT 20
  `;
}

export async function getAllUsers(): Promise<DbUser[]> {
  const sql = getAppDb()!;
  return sql<DbUser[]>`
    SELECT * FROM users ORDER BY name, email
  `;
}
