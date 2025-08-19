import { ensureSchema } from '../../_schema.js';
import { verifyTokenFromRequest } from '../../_auth.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const EPOCH_MS = Date.UTC(2024, 0, 1, 0, 0, 0, 0);
const BETTING_MS = 10000;
const CURVE = { speed: 0.35, curve: 1.1 };

function getRoundInfo(nowMs) {
  const cycleMs = BETTING_MS + 60000;
  const since = nowMs - EPOCH_MS;
  const idx = Math.floor(since / cycleMs);
  const within = since % cycleMs;
  const phase = within < BETTING_MS ? 'betting' : 'playing';
  const playingStartedAt = within < BETTING_MS ? null : (nowMs - (within - BETTING_MS));
  return { roundIndex: idx, phase, playingStartedAt };
}

function crashPointFor(roundIndex) {
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  const h = crypto.createHash('sha256').update(`${secret}:aviator:${roundIndex}`).digest();
  const r = h[0] / 255;
  if (r < 0.05) return 1.02 + (h[1] / 255) * 0.2;
  if (r < 0.45) return 1.5 + (h[1] / 255) * 1.5;
  if (r < 0.85) return 3.0 + (h[1] / 255) * 5.0;
  return 8.0 + (h[1] / 255) * 25.0;
}

function multiplierAt(elapsedSec) {
  return 1 + Math.pow(elapsedSec * CURVE.speed, CURVE.curve);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const supabase = await ensureSchema();
    const payload = verifyTokenFromRequest(req);
    const now = Date.now();
    const info = getRoundInfo(now);
    if (info.phase !== 'playing') return res.status(400).json({ message: 'Cashout disponível apenas durante o voo' });
    const elapsedSec = (now - info.playingStartedAt) / 1000;
    const currentMultiplier = multiplierAt(elapsedSec);
    const crashPoint = crashPointFor(info.roundIndex);
    if (currentMultiplier >= crashPoint) return res.status(400).json({ message: 'Rodada já caiu' });

    const { data: users, error: selErr } = await supabase.from('users').select('id, username, balance').eq('id', payload.userId).limit(1);
    if (selErr) throw new Error(selErr.message);
    if (!users || !users.length) return res.status(404).json({ message: 'Usuário não encontrado' });
    const user = users[0];

    // Para simplificação: credita o valor da aposta atual multiplicado — demanda que o cliente controle 1 aposta por rodada
    // Alternativamente, criar tabela aviator_bets para registrar valores por rodada.
    const betAmountHeader = Number(req.headers['x-bet-amount'] || 0);
    const amount = betAmountHeader > 0 ? betAmountHeader : 0; // fallback simples
    if (!amount) return res.status(400).json({ message: 'Valor da aposta ausente' });

    const winAmount = amount * currentMultiplier;
    const newBalance = Number(user.balance) + winAmount;
    const { error: updErr } = await supabase.from('users').update({ balance: newBalance }).eq('id', user.id);
    if (updErr) throw new Error(updErr.message);
    await supabase.from('logs').insert({
      id: uuidv4(),
      user_id: user.id,
      user_name: user.username,
      game: 'Aviator',
      type: 'Ganho',
      amount: winAmount,
      details: `Cashout em ${currentMultiplier.toFixed(2)}x (Aposta: R$ ${amount.toFixed(2)})`,
      timestamp: new Date().toISOString(),
      session_id: req.headers['x-session-id'] || null
    });
    return res.json({ ok: true, balance: newBalance, multiplier: Number(currentMultiplier.toFixed(2)), amount: Number(winAmount.toFixed(2)) });
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    return res.status(msg.includes('Token') ? 401 : 500).json({ message: msg });
  }
}

