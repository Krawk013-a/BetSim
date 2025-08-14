import { sql } from '@vercel/postgres';

export async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    username text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    balance numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  );`;

  await sql`CREATE TABLE IF NOT EXISTS logs (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    game text NOT NULL,
    type text NOT NULL,
    amount numeric NOT NULL,
    details text,
    timestamp timestamptz NOT NULL DEFAULT now(),
    session_id text
  );`;
}