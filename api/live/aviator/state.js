import { ensureSchema } from '../../_schema.js';
import { verifyTokenFromRequest } from '../../_auth.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const EPOCH_MS = Date.UTC(2024, 0, 1, 0, 0, 0, 0);
const BETTING_MS = 10000;
const ENDED_MS = 2000;
// Aviator não tem duração fixa; usamos curva para multiplicador e crashPoint determinístico por rodada
const CURVE = { speed: 0.35, curve: 1.1 };

function getRoundIndex(nowMs) {
  const cycleMs = BETTING_MS + 60000;
  const since = nowMs - EPOCH_MS;
  const idx = Math.floor(since / cycleMs);
  const within = since % cycleMs;
  return { idx, within, cycleMs };
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
    const { idx, within, cycleMs } = getRoundIndex(now);
    const crashPoint = crashPointFor(idx);
    const playSec = secondsToReach(crashPoint);
    const playMs = Math.min(60000 - BETTING_MS, Math.floor(playSec * 1000));
    const playingStartWithin = BETTING_MS;
    const crashWithin = playingStartWithin + playMs;
    const endedUntilWithin = crashWithin + ENDED_MS;

    if (within < BETTING_MS) {
      // Betting da rodada idx
      const timeLeftMs = BETTING_MS - within;
      return res.json({
        game: 'Aviator',
        roundId: `aviator-${idx}`,
        phase: 'betting',
        timeLeftMs,
        serverTime: now,
        previousCrashPoints: buildPrevious(10, idx)
      });
    }

    if (within >= BETTING_MS && within < crashWithin) {
      // Playing da rodada idx
      const playingStartedAt = now - (within - BETTING_MS);
      const elapsedSec = (now - playingStartedAt) / 1000;
      const currentMultiplier = multiplierAt(elapsedSec);
      return res.json({
        game: 'Aviator',
        roundId: `aviator-${idx}`,
        phase: 'playing',
        serverTime: now,
        playing: { startedAt: playingStartedAt, currentMultiplier: Number(currentMultiplier.toFixed(4)) },
        previousCrashPoints: buildPrevious(10, idx)
      });
    }

    if (within >= crashWithin && within < endedUntilWithin) {
      // Ended curto
      const timeLeftMs = endedUntilWithin - within;
      return res.json({
        game: 'Aviator',
        roundId: `aviator-${idx}`,
        phase: 'ended',
        timeLeftMs,
        serverTime: now,
        previousCrashPoints: buildPrevious(10, idx)
      });
    }

    // Pré-betting da próxima rodada (idx+1), reabre apostas até BATTERY_MS
    const sinceEnded = within - endedUntilWithin;
    const nextBettingElapsed = Math.min(BETTING_MS, sinceEnded);
    const timeLeftMs = BETTING_MS - nextBettingElapsed;
    return res.json({
      game: 'Aviator',
      roundId: `aviator-${idx + 1}`,
      phase: 'betting',
      timeLeftMs,
      serverTime: now,
      previousCrashPoints: buildPrevious(10, idx + 1)
    });
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Erro no servidor' });
  }
}

