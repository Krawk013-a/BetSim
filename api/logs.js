import { sql } from '@vercel/postgres';
import { ensureSchema } from './_schema.js';
import { verifyTokenFromRequest } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    await ensureSchema();
    verifyTokenFromRequest(req);
    const { user, game, type, date } = req.query || {};
    let where = [];
    let params = [];
    if (user) { params.push(user); where.push(`user_name = $${params.length}`); }
    if (game) { params.push(game); where.push(`game = $${params.length}`); }
    if (type) { params.push(type); where.push(`type = $${params.length}`); }
    if (date) { params.push(date); where.push(`to_char(timestamp::date, 'YYYY-MM-DD') = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const query = `SELECT timestamp, user_name as user, game, type, amount::float8 as amount, coalesce(details,'') as details, session_id as "sessionId"
                   FROM logs ${whereSql} ORDER BY timestamp DESC`;
    const { rows } = await sql.query(query, params);
    return res.json({ logs: rows });
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    return res.status(msg.includes('Token') ? 401 : 500).json({ message: msg });
  }
}