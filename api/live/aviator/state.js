import { ensureSchema } from '../../_schema.js';
import { verifyTokenFromRequest } from '../../_auth.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const EPOCH_MS = Date.UTC(2024, 0, 1, 0, 0, 0, 0);
const BETTING_MS = 10000;
// Aviator não tem duração fixa; usamos curva para multiplicador e crashPoint determinístico por rodada
const CURVE = { speed: 0.35, curve: 1.1 };

function getRoundInfo(nowMs) {
  // alterna entre betting e playing; playing começa após janela de apostas
  const cycleMs = BETTING_MS + 60000; // até 60s de voo máximo para segurança
  const since = nowMs - EPOCH_MS;
  const idx = Math.floor(since / cycleMs);
  const within = since % cycleMs;
  const phase = within < BETTING_MS ? 'betting' : 'playing';
  const playingStartedAt = within < BETTING_MS ? null : (nowMs - (within - BETTING_MS));
  const roundId = `aviator-${idx}`;
  return { roundIndex: idx, roundId, phase, playingStartedAt };
}

function crashPointFor(roundIndex) {
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  const h = crypto.createHash('sha256').update(`${secret}:aviator:${roundIndex}`).digest();
  const r = h[0] / 255; // 0..1
  if (r < 0.05) return 1.02 + (h[1] / 255) * 0.2;
  if (r < 0.45) return 1.5 + (h[1] / 255) * 1.5;
  if (r < 0.85) return 3.0 + (h[1] / 255) * 5.0;
  return 8.0 + (h[1] / 255) * 25.0;
}

function multiplierAt(elapsedSec) {
  return 1 + Math.pow(elapsedSec * CURVE.speed, CURVE.curve);
}

function secondsToReach(multiplier) {
  const x = Math.max(1.00001, multiplier) - 1;
  return Math.pow(x, 1 / CURVE.curve) / CURVE.speed;
}

function buildPrevious(count, currentIndex) {
  const arr = [];
  for (let i = 1; i <= count; i++) {
    arr.push(crashPointFor(currentIndex - i));
  }
  return arr;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    try { verifyTokenFromRequest(req); } catch {}
    await ensureSchema();
    const now = Date.now();
    const info = getRoundInfo(now);
    const crashPoint = crashPointFor(info.roundIndex);
    if (info.phase === 'betting') {
      return res.json({
        game: 'Aviator',
        roundId: info.roundId,
        phase: 'betting',
        timeLeftMs: Math.max(0, BETTING_MS - (now - (now - (now % (BETTING_MS + 60000))))),
        serverTime: now,
        previousCrashPoints: buildPrevious(10, info.roundIndex)
      });
    }
    // playing
    const elapsedSec = (now - info.playingStartedAt) / 1000;
    const currentMultiplier = multiplierAt(elapsedSec);
    const totalPlaySec = secondsToReach(crashPoint);
    if (elapsedSec >= totalPlaySec) {
      // rodada terminou; cliente deve ver fase 'ended' em breve ao girar o relógio do ciclo
      return res.json({
        game: 'Aviator',
        roundId: info.roundId,
        phase: 'ended',
        timeLeftMs: 1500,
        serverTime: now,
        previousCrashPoints: buildPrevious(10, info.roundIndex)
      });
    }
    return res.json({
      game: 'Aviator',
      roundId: info.roundId,
      phase: 'playing',
      serverTime: now,
      playing: { startedAt: info.playingStartedAt, currentMultiplier: Number(currentMultiplier.toFixed(4)) },
      previousCrashPoints: buildPrevious(10, info.roundIndex)
    });
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Erro no servidor' });
  }
}

