import { sql } from '@vercel/postgres';
import { ensureSchema } from './_schema.js';
import { verifyTokenFromRequest } from './_auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    await ensureSchema();
    const payload = verifyTokenFromRequest(req);
    const { type, amount, details, game } = req.body || {};
    if (!type || typeof amount !== 'number' || !game) return res.status(400).json({ message: 'Campos obrigatórios: type, amount, game' });
    const sessionId = req.headers['x-session-id'] || null;
    const result = await sql.begin(async (tx) => {
      const { rows: users } = await tx`SELECT id, username, balance FROM users WHERE id=${payload.userId} FOR UPDATE`;
      if (!users.length) throw new Error('Usuário não encontrado');
      const user = users[0];
      const newBalance = Number(user.balance) + amount;
      if (newBalance < 0) throw new Error('Saldo insuficiente');
      await tx`UPDATE users SET balance=${newBalance} WHERE id=${user.id}`;
      await tx`INSERT INTO logs (id, user_id, user_name, game, type, amount, details, timestamp, session_id) VALUES (
        ${uuidv4()}, ${user.id}, ${user.username}, ${game}, ${type}, ${amount}, ${details || ''}, now(), ${sessionId}
      )`;
      return { balance: newBalance };
    });
    return res.json(result);
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    const code = msg === 'Saldo insuficiente' ? 400 : (msg.includes('Token') ? 401 : 500);
    return res.status(code).json({ message: msg });
  }
}