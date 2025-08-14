import { sql } from '@vercel/postgres';
import { ensureSchema } from './_schema.js';
import { verifyTokenFromRequest } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    await ensureSchema();
    const payload = verifyTokenFromRequest(req);
    const { rows } = await sql`SELECT id, username, balance FROM users WHERE id=${payload.userId} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ message: 'Usuário não encontrado' });
    const u = rows[0];
    return res.json({ id: u.id, username: u.username, balance: Number(u.balance) });
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    return res.status(msg.includes('Token') ? 401 : 500).json({ message: msg });
  }
}