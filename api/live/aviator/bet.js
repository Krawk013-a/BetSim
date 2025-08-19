import { ensureSchema } from '../../_schema.js';
import { verifyTokenFromRequest } from '../../_auth.js';
import { v4 as uuidv4 } from 'uuid';

const EPOCH_MS = Date.UTC(2024, 0, 1, 0, 0, 0, 0);
const BETTING_MS = 10000;

function isBettingPhase(nowMs) {
  const cycleMs = BETTING_MS + 5000;
  const since = nowMs - EPOCH_MS;
  const within = since % cycleMs;
  return within < BETTING_MS;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const supabase = await ensureSchema();
    const payload = verifyTokenFromRequest(req);
    const { amount } = req.body || {};
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ message: 'Parâmetros inválidos' });
    const now = Date.now();
    if (!isBettingPhase(now)) return res.status(400).json({ message: 'Fora da janela de apostas' });
    const { data: users, error: selErr } = await supabase.from('users').select('id, username, balance').eq('id', payload.userId).limit(1);
    if (selErr) throw new Error(selErr.message);
    if (!users || !users.length) return res.status(404).json({ message: 'Usuário não encontrado' });
    const user = users[0];
    const newBalance = Number(user.balance) - Number(amount);
    if (newBalance < 0) return res.status(400).json({ message: 'Saldo insuficiente' });
    const { error: updErr } = await supabase.from('users').update({ balance: newBalance }).eq('id', user.id);
    if (updErr) throw new Error(updErr.message);
    await supabase.from('logs').insert({
      id: uuidv4(),
      user_id: user.id,
      user_name: user.username,
      game: 'Aviator',
      type: 'Aposta',
      amount: -Number(amount),
      details: `Aposta de R$ ${Number(amount).toFixed(2)}`,
      timestamp: new Date().toISOString(),
      session_id: req.headers['x-session-id'] || null
    });
    // Apostas da rodada são implícitas; o cashout consulta o saldo do usuário ao resgatar
    return res.json({ ok: true, balance: newBalance });
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    return res.status(msg === 'Saldo insuficiente' ? 400 : (msg.includes('Token') ? 401 : 500)).json({ message: msg });
  }
}

