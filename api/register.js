import { sql } from '@vercel/postgres';
import { ensureSchema } from './_schema.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    await ensureSchema();
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
    const { rows: existing } = await sql`SELECT id FROM users WHERE lower(username)=lower(${username}) LIMIT 1`;
    if (existing.length) return res.status(409).json({ message: 'Usuário já existe' });
    const passwordHash = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    await sql`INSERT INTO users (id, username, password_hash, balance, created_at) VALUES (${id}, ${username}, ${passwordHash}, ${100}, now())`;
    return res.json({ message: 'Registrado com sucesso' });
  } catch (e) {
    console.error('register:error', e);
    return res.status(500).json({ message: e.message || 'Erro no servidor' });
  }
}