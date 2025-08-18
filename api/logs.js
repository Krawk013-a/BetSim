import { ensureSchema } from './_schema.js';
import { verifyTokenFromRequest } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const supabase = await ensureSchema();
    verifyTokenFromRequest(req);
    const { user, game, type, date } = req.query || {};
    let q = supabase.from('logs').select('timestamp, user_name, game, type, amount, details, session_id').order('timestamp', { ascending: false });
    if (user) q = q.eq('user_name', user);
    if (game) q = q.eq('game', game);
    if (type) q = q.eq('type', type);
    if (date) q = q.gte('timestamp', date).lt('timestamp', new Date(new Date(date).getTime() + 24*60*60*1000).toISOString());
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const logs = (data || []).map(r => ({ timestamp: r.timestamp, user: r.user_name, game: r.game, type: r.type, amount: Number(r.amount), details: r.details || '', sessionId: r.session_id || null }));
    return res.json({ logs });
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    return res.status(msg.includes('Token') ? 401 : 500).json({ message: msg });
  }
}