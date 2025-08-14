import { ensureSchema } from './_schema.js';
import { verifyTokenFromRequest } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const supabase = await ensureSchema();
    const payload = verifyTokenFromRequest(req);
    const { data: users, error } = await supabase.from('users').select('id, username, balance').eq('id', payload.userId).limit(1);
    if (error) throw new Error(error.message);
    if (!users || !users.length) return res.status(404).json({ message: 'Usuário não encontrado' });
    const u = users[0];
    return res.json({ id: u.id, username: u.username, balance: Number(u.balance) });
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    return res.status(msg.includes('Token') ? 401 : 500).json({ message: msg });
  }
}