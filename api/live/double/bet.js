import { ensureSchema } from '../../_schema.js';
import { verifyTokenFromRequest } from '../../_auth.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const EPOCH_MS = Date.UTC(2024, 0, 1, 0, 0, 0, 0);
const BETTING_MS = 10000;
const SPINNING_MS = 5000;
const ROUND_MS = BETTING_MS + SPINNING_MS;

function getRoundInfo(nowMs) {
  const since = nowMs - EPOCH_MS;
  const idx = Math.floor(since / ROUND_MS);
  const within = since % ROUND_MS;
  const phase = within < BETTING_MS ? 'betting' : 'spinning';
  const roundId = `double-${idx}`;
  return { roundIndex: idx, roundId, phase };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const supabase = await ensureSchema();
    const payload = verifyTokenFromRequest(req);
    const { color, amount } = req.body || {};
    const valid = ['red', 'black', 'white'];
    if (!valid.includes(color) || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'Parâmetros inválidos' });
    }
    const now = Date.now();
    const info = getRoundInfo(now);
    if (info.phase !== 'betting') return res.status(400).json({ message: 'Fora da janela de apostas' });

    // Debitar saldo
    const { data: users, error: selErr } = await supabase.from('users').select('id, username, balance').eq('id', payload.userId).limit(1);
    if (selErr) throw new Error(selErr.message);
    if (!users || !users.length) return res.status(404).json({ message: 'Usuário não encontrado' });
    const user = users[0];
    const newBalance = Number(user.balance) - Number(amount);
    if (newBalance < 0) return res.status(400).json({ message: 'Saldo insuficiente' });
    const { error: updErr } = await supabase.from('users').update({ balance: newBalance }).eq('id', user.id);
    if (updErr) throw new Error(updErr.message);

    // Registrar aposta
    await supabase.from('logs').insert({
      id: uuidv4(),
      user_id: user.id,
      user_name: user.username,
      game: 'Double',
      type: 'Aposta',
      amount: -Number(amount),
      details: `Apostou em ${color}`,
      timestamp: new Date().toISOString(),
      session_id: req.headers['x-session-id'] || null
    });

    // Tabela de apostas (criar no SQL):
    // CREATE TABLE IF NOT EXISTS double_bets (
    //   id uuid PRIMARY KEY,
    //   round_index bigint NOT NULL,
    //   user_id uuid NOT NULL,
    //   user_name text NOT NULL,
    //   amount numeric NOT NULL,
    //   color text NOT NULL,
    //   settled boolean NOT NULL DEFAULT false,
    //   win_amount numeric
    // );
    await supabase.from('double_bets').insert({
      id: uuidv4(),
      round_index: info.roundIndex,
      user_id: user.id,
      user_name: user.username,
      amount: Number(amount),
      color,
      settled: false
    });

    return res.json({ ok: true, balance: newBalance, roundId: info.roundId });
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    return res.status(msg === 'Saldo insuficiente' ? 400 : (msg.includes('Token') ? 401 : 500)).json({ message: msg });
  }
}

