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
  const timeLeftMs = (phase === 'betting') ? (BETTING_MS - within) : (ROUND_MS - within);
  const roundId = `double-${idx}`;
  return { roundIndex: idx, roundId, phase, timeLeftMs };
}

function winningColorFor(roundIndex) {
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  const h = crypto.createHash('sha256').update(`${secret}:double:${roundIndex}`).digest();
  const roll = h[0] % 15;
  if (roll === 0) return 'white';
  return (roll % 2 === 1) ? 'red' : 'black';
}

function buildPreviousResults(count, currentIndex) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    out.push(winningColorFor(currentIndex - i));
  }
  return out;
}

async function settleRound(supabase, roundIndex) {
  // Idempotente: liquida apenas apostas unsettled
  const { data: bets, error: betErr } = await supabase
    .from('double_bets')
    .select('id, user_id, user_name, amount, color, settled')
    .eq('round_index', roundIndex)
    .eq('settled', false);
  if (betErr) return; // se tabela não existir, ignore
  if (!bets || bets.length === 0) return;

  const winColor = winningColorFor(roundIndex);
  const multiplier = (c) => (c === 'white' ? 14 : 2);

  for (const b of bets) {
    const isWin = b.color === winColor;
    const winAmount = isWin ? Number(b.amount) * multiplier(b.color) : 0;
    // marca settled
    await supabase.from('double_bets').update({ settled: true, win_amount: winAmount }).eq('id', b.id);
    // credita se ganhou e escreve log
    if (isWin) {
      const { data: users, error: selErr } = await supabase
        .from('users').select('id, username, balance').eq('id', b.user_id).limit(1);
      if (selErr || !users || !users.length) continue;
      const u = users[0];
      const newBalance = Number(u.balance) + winAmount;
      await supabase.from('users').update({ balance: newBalance }).eq('id', u.id);
      await supabase.from('logs').insert({
        id: uuidv4(),
        user_id: u.id,
        user_name: u.username,
        game: 'Double',
        type: 'Ganho',
        amount: winAmount,
        details: `Cor vencedora: ${winColor}`,
        timestamp: new Date().toISOString(),
        session_id: null
      });
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    // opcional: autenticação não é obrigatória para ler estado, mas se vier token, valida
    try { verifyTokenFromRequest(req); } catch {}
    const supabase = await ensureSchema();
    const now = Date.now();
    const info = getRoundInfo(now);

    // ao entrar na fase de apostas, liquide a rodada anterior
    if (info.phase === 'betting') {
      await settleRound(supabase, info.roundIndex - 1);
    }

    const response = {
      game: 'Double',
      roundId: info.roundId,
      phase: info.phase,
      timeLeftMs: Math.max(0, Math.floor(info.timeLeftMs)),
      serverTime: now,
      previousResults: buildPreviousResults(10, info.roundIndex),
      spinning: info.phase === 'spinning' ? { winningColor: winningColorFor(info.roundIndex), spinStartedAt: now - (SPINNING_MS - info.timeLeftMs) } : null
    };
    return res.json(response);
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Erro no servidor' });
  }
}

