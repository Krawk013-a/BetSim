import { ensureSchema } from './_schema.js';
import { verifyTokenFromRequest } from './_auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const supabase = await ensureSchema();
    const payload = verifyTokenFromRequest(req);
    const { delta, reason } = req.body || {};
    if (typeof delta !== 'number') return res.status(400).json({ message: 'Delta inválido' });
    const sessionId = req.headers['x-session-id'] || null;

    const { data: users, error: selErr } = await supabase.from('users').select('id, username, balance').eq('id', payload.userId).limit(1);
    if (selErr) throw new Error(selErr.message);
    if (!users || !users.length) return res.status(404).json({ message: 'Usuário não encontrado' });

    const user = users[0];
    const newBalance = Number(user.balance) + delta;
    if (newBalance < 0) return res.status(400).json({ message: 'Saldo insuficiente' });

    const { error: updErr } = await supabase.from('users').update({ balance: newBalance }).eq('id', user.id);
    if (updErr) throw new Error(updErr.message);

    const { error: logErr } = await supabase.from('logs').insert({
      id: uuidv4(),
      user_id: user.id,
      user_name: user.username,
      game: 'Bank',
      type: delta >= 0 ? 'Depósito' : 'Saque',
      amount: delta,
      details: reason || 'Ajuste de saldo',
      timestamp: new Date().toISOString(),
      session_id: sessionId
    });
    if (logErr) throw new Error(logErr.message);

    return res.json({ balance: newBalance });
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    const code = msg === 'Saldo insuficiente' ? 400 : (msg.includes('Token') ? 401 : 500);
    return res.status(code).json({ message: msg });
  }
}