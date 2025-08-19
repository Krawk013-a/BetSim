import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Arquivo de "banco de dados" simples
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir);
}

// Inicializa DB se não existir
if (!fs.existsSync(dbPath)) {
	fs.writeFileSync(dbPath, JSON.stringify({ users: [], logs: [] }, null, 2));
}

function readDB() {
	const content = fs.readFileSync(dbPath, 'utf-8');
	return JSON.parse(content);
}

function writeDB(db) {
	fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function authMiddleware(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) return res.status(401).json({ message: 'Token ausente' });
	const token = authHeader.replace('Bearer ', '');
	try {
		const payload = jwt.verify(token, JWT_SECRET);
		req.user = payload;
		next();
	} catch (err) {
		return res.status(401).json({ message: 'Token inválido' });
	}
}

// Registro
app.post('/api/register', (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
	}
	const db = readDB();
	const exists = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
	if (exists) {
		return res.status(409).json({ message: 'Usuário já existe' });
	}
	const passwordHash = bcrypt.hashSync(password, 10);
	const newUser = {
		id: uuidv4(),
		username,
		passwordHash,
		balance: 100.00,
		createdAt: new Date().toISOString()
	};
	db.users.push(newUser);
	writeDB(db);
	return res.json({ message: 'Registrado com sucesso' });
});

// Login
app.post('/api/login', (req, res) => {
	const { username, password } = req.body;
	const db = readDB();
	const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
	if (!user) return res.status(401).json({ message: 'Credenciais inválidas' });
	const ok = bcrypt.compareSync(password, user.passwordHash);
	if (!ok) return res.status(401).json({ message: 'Credenciais inválidas' });
	const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
	return res.json({ token, user: { id: user.id, username: user.username, balance: user.balance } });
});

// Perfil atual
app.get('/api/me', authMiddleware, (req, res) => {
	const db = readDB();
	const user = db.users.find(u => u.id === req.user.userId);
	if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
	return res.json({ id: user.id, username: user.username, balance: user.balance });
});

// Atualiza saldo (depósito/saque/ajuste)
app.post('/api/balance', authMiddleware, (req, res) => {
	const { delta, reason } = req.body; // delta positivo ou negativo
	if (typeof delta !== 'number') return res.status(400).json({ message: 'Delta inválido' });
	const db = readDB();
	const user = db.users.find(u => u.id === req.user.userId);
	if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
	const newBalance = user.balance + delta;
	if (newBalance < 0) return res.status(400).json({ message: 'Saldo insuficiente' });
	user.balance = parseFloat(newBalance.toFixed(2));
	// cria um log de transação bancária
	db.logs.push({
		id: uuidv4(),
		user: user.username,
		userId: user.id,
		game: 'Bank',
		type: delta >= 0 ? 'Depósito' : 'Saque',
		amount: delta,
		details: reason || 'Ajuste de saldo',
		timestamp: new Date().toISOString(),
		sessionId: req.headers['x-session-id'] || null
	});
	writeDB(db);
	return res.json({ balance: user.balance });
});

// Adiciona log de jogo e atualiza saldo atomicamente
app.post('/api/game-transaction', authMiddleware, (req, res) => {
	const { type, amount, details, game } = req.body;
	if (!type || typeof amount !== 'number' || !game) {
		return res.status(400).json({ message: 'Campos obrigatórios: type, amount, game' });
	}
	const db = readDB();
	const user = db.users.find(u => u.id === req.user.userId);
	if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
	const newBalance = user.balance + amount;
	if (newBalance < 0) return res.status(400).json({ message: 'Saldo insuficiente' });
	user.balance = parseFloat(newBalance.toFixed(2));
	db.logs.push({
		id: uuidv4(),
		user: user.username,
		userId: user.id,
		game,
		type,
		amount,
		details: details || '',
		timestamp: new Date().toISOString(),
		sessionId: req.headers['x-session-id'] || null
	});
	writeDB(db);
	return res.json({ balance: user.balance });
});

// Adiciona log de jogo
app.post('/api/logs', authMiddleware, (req, res) => {
	const { type, amount, details, game } = req.body;
	if (!type || typeof amount !== 'number' || !game) {
		return res.status(400).json({ message: 'Campos obrigatórios: type, amount, game' });
	}
	const db = readDB();
	const user = db.users.find(u => u.id === req.user.userId);
	if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
	db.logs.push({
		id: uuidv4(),
		user: user.username,
		userId: user.id,
		game,
		type,
		amount,
		details: details || '',
		timestamp: new Date().toISOString(),
		sessionId: req.headers['x-session-id'] || null
	});
	writeDB(db);
	return res.json({ ok: true });
});

// Lista logs com filtros simples
app.get('/api/logs', authMiddleware, (req, res) => {
	const { user, game, type, date } = req.query;
	const db = readDB();
	let logs = db.logs;
	if (user) logs = logs.filter(l => l.user === user);
	if (game) logs = logs.filter(l => l.game === game);
	if (type) logs = logs.filter(l => l.type === type);
	if (date) {
		const d = new Date(date);
		logs = logs.filter(l => new Date(l.timestamp).toDateString() === d.toDateString());
	}
	// Ordena por mais recente
	logs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
	return res.json({ logs });
});

// Servir arquivos estáticos (frontend)
app.use(express.static(__dirname));

// =========================
// Rodadas ao vivo (in-memory)
// =========================

/**
 * Notas:
 * - Mantemos estado em memória para as rodadas de "Double" e "Aviator".
 * - Fases: betting -> spinning/playing -> ended.
 * - Janela de apostas: 10 segundos.
 * - Double: resultado único por rodada. Red/Black x2, White x14.
 * - Aviator: voo compartilhado com crashPoint determinístico e suporte a cashout por jogador durante a fase playing.
 */

const SERVER_TICK_MS = 250;

const liveGames = {
    double: {
        game: 'Double',
        roundId: uuidv4(),
        phase: 'betting', // betting | spinning | ended
        phaseStartedAt: Date.now(),
        bettingWindowMs: 10000,
        spinningMs: 5000,
        bets: [], // { userId, username, amount, color }
        previousResults: [], // array of 'red'|'black'|'white'
        winningColor: null,
        spinStartedAt: null
    },
    aviator: {
        game: 'Aviator',
        roundId: uuidv4(),
        phase: 'betting', // betting | playing | ended
        phaseStartedAt: Date.now(),
        bettingWindowMs: 10000,
        playingStartedAt: null,
        crashPoint: null,
        bets: [], // { userId, username, amount, cashedOut: boolean, cashedMultiplier: number|null }
        previousCrashPoints: [],
    }
};

function getUserFromToken(req) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return null;
        const token = authHeader.replace('Bearer ', '');
        const payload = jwt.verify(token, JWT_SECRET);
        return payload;
    } catch {
        return null;
    }
}

// ---------- Utilitários de DB/Transações ----------

function creditUser(userId, amount, details, game) {
    const db = readDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return null;
    user.balance = parseFloat((user.balance + amount).toFixed(2));
    db.logs.push({
        id: uuidv4(),
        user: user.username,
        userId: user.id,
        game,
        type: amount >= 0 ? 'Ganho' : 'Aposta',
        amount,
        details: details || '',
        timestamp: new Date().toISOString(),
        sessionId: null
    });
    writeDB(db);
    return user.balance;
}

function debitForBet(userId, amount, details, game) {
    const db = readDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return { ok: false, message: 'Usuário não encontrado' };
    const newBalance = user.balance - amount;
    if (newBalance < 0) return { ok: false, message: 'Saldo insuficiente' };
    user.balance = parseFloat(newBalance.toFixed(2));
    db.logs.push({
        id: uuidv4(),
        user: user.username,
        userId: user.id,
        game,
        type: 'Aposta',
        amount: -amount,
        details: details || '',
        timestamp: new Date().toISOString(),
        sessionId: null
    });
    writeDB(db);
    return { ok: true, balance: user.balance, username: user.username };
}

// ---------- Lógica Double ----------

function doubleChooseWinningColor() {
    // 1 branco e 14 cores alternando vermelho/preto (padrão blaze-like)
    // Probabilidades aproximadas: white 1/15, red 7/15, black 7/15
    const roll = Math.floor(Math.random() * 15);
    if (roll === 0) return 'white';
    return roll % 2 === 1 ? 'red' : 'black';
}

function doubleAdvancePhase() {
    const g = liveGames.double;
    const now = Date.now();
    if (g.phase === 'betting' && now - g.phaseStartedAt >= g.bettingWindowMs) {
        g.phase = 'spinning';
        g.phaseStartedAt = now;
        g.spinStartedAt = now;
        g.winningColor = doubleChooseWinningColor();
        return;
    }
    if (g.phase === 'spinning' && now - g.phaseStartedAt >= g.spinningMs) {
        // liquidar apostas
        const multiplierFor = color => (color === 'white' ? 14 : 2);
        const db = readDB();
        g.bets.forEach(b => {
            if (b.color === g.winningColor) {
                const user = db.users.find(u => u.id === b.userId);
                if (user) {
                    user.balance = parseFloat((user.balance + (b.amount * multiplierFor(b.color))).toFixed(2));
                    db.logs.push({
                        id: uuidv4(), user: user.username, userId: user.id, game: 'Double', type: 'Ganho',
                        amount: b.amount * multiplierFor(b.color), details: `Cor vencedora: ${g.winningColor}`,
                        timestamp: new Date().toISOString(), sessionId: null
                    });
                }
            }
        });
        writeDB(db);
        g.previousResults.unshift(g.winningColor);
        if (g.previousResults.length > 20) g.previousResults.pop();
        // reset e nova rodada
        g.bets = [];
        g.winningColor = null;
        g.spinStartedAt = null;
        g.phase = 'betting';
        g.phaseStartedAt = Date.now();
        g.roundId = uuidv4();
        return;
    }
}

// ---------- Lógica Aviator ----------

function aviatorDetermineCrashPoint() {
    const r = Math.random();
    if (r < 0.05) return 1.02 + Math.random() * 0.2;           // 5% muito cedo
    if (r < 0.45) return 1.5 + Math.random() * 1.5;            // 40% entre 1.5x e 3.0x
    if (r < 0.85) return 3.0 + Math.random() * 5.0;            // 40% entre 3x e 8x
    return 8.0 + Math.random() * 25.0;                         // 15% acima de 8x
}

const aviatorCurve = { speed: 0.35, curve: 1.1 };
function aviatorMultiplierAt(elapsedSeconds) {
    return 1 + Math.pow(elapsedSeconds * aviatorCurve.speed, aviatorCurve.curve);
}
function aviatorSecondsToReach(multiplier) {
    const x = Math.max(1.00001, multiplier) - 1;
    return Math.pow(x, 1 / aviatorCurve.curve) / aviatorCurve.speed;
}

function aviatorAdvancePhase() {
    const g = liveGames.aviator;
    const now = Date.now();
    if (g.phase === 'betting' && now - g.phaseStartedAt >= g.bettingWindowMs) {
        g.phase = 'playing';
        g.playingStartedAt = now;
        g.crashPoint = aviatorDetermineCrashPoint();
        return;
    }
    if (g.phase === 'playing') {
        const elapsed = (now - g.playingStartedAt) / 1000;
        const currentMult = aviatorMultiplierAt(elapsed);
        if (currentMult >= g.crashPoint) {
            // encerrar rodada: quem não sacou perde
            const db = readDB();
            g.bets.forEach(b => {
                if (!b.cashedOut) {
                    const user = db.users.find(u => u.id === b.userId);
                    if (user) {
                        db.logs.push({
                            id: uuidv4(), user: user.username, userId: user.id, game: 'Aviator', type: 'Perda',
                            amount: 0, details: `Caiu em ${g.crashPoint.toFixed(2)}x (Aposta: R$ ${b.amount.toFixed(2)})`,
                            timestamp: new Date().toISOString(), sessionId: null
                        });
                    }
                }
            });
            writeDB(db);
            g.previousCrashPoints.unshift(g.crashPoint);
            if (g.previousCrashPoints.length > 20) g.previousCrashPoints.pop();
            // reset para próxima rodada
            g.phase = 'ended';
            g.phaseStartedAt = now;
            return;
        }
    }
    if (g.phase === 'ended' && now - g.phaseStartedAt >= 2000) {
        // iniciar nova janela de apostas após breve pausa
        g.phase = 'betting';
        g.phaseStartedAt = Date.now();
        g.roundId = uuidv4();
        g.playingStartedAt = null;
        g.crashPoint = null;
        g.bets = [];
        return;
    }
}

setInterval(() => {
    try {
        doubleAdvancePhase();
        aviatorAdvancePhase();
    } catch (e) {
        // evita quebras silenciosas
    }
}, SERVER_TICK_MS);

// ---------- Endpoints Live State ----------

app.get('/api/live/:game/state', (req, res) => {
    const gameKey = req.params.game;
    if (!(gameKey in liveGames)) return res.status(404).json({ message: 'Jogo inválido' });
    const g = liveGames[gameKey];
    const now = Date.now();
    let timeLeftMs = 0;
    if (gameKey === 'double') {
        if (g.phase === 'betting') timeLeftMs = Math.max(0, g.bettingWindowMs - (now - g.phaseStartedAt));
        if (g.phase === 'spinning') timeLeftMs = Math.max(0, g.spinningMs - (now - g.phaseStartedAt));
        return res.json({
            game: g.game,
            roundId: g.roundId,
            phase: g.phase,
            timeLeftMs,
            serverTime: now,
            previousResults: g.previousResults,
            spinning: g.phase === 'spinning' ? { winningColor: g.winningColor, spinStartedAt: g.spinStartedAt } : null
        });
    }
    if (gameKey === 'aviator') {
        if (g.phase === 'betting') timeLeftMs = Math.max(0, g.bettingWindowMs - (now - g.phaseStartedAt));
        if (g.phase === 'playing') {
            const elapsed = (now - g.playingStartedAt) / 1000;
            const currentMultiplier = aviatorMultiplierAt(elapsed);
            const totalPlaySec = aviatorSecondsToReach(g.crashPoint || 1000);
            timeLeftMs = Math.max(0, Math.round((totalPlaySec - elapsed) * 1000));
            return res.json({
                game: g.game,
                roundId: g.roundId,
                phase: g.phase,
                serverTime: now,
                playing: {
                    startedAt: g.playingStartedAt,
                    currentMultiplier: parseFloat(currentMultiplier.toFixed(4)),
                },
                previousCrashPoints: g.previousCrashPoints
            });
        }
        if (g.phase === 'ended') timeLeftMs = Math.max(0, 2000 - (now - g.phaseStartedAt));
        return res.json({
            game: g.game,
            roundId: g.roundId,
            phase: g.phase,
            timeLeftMs,
            serverTime: now,
            previousCrashPoints: g.previousCrashPoints
        });
    }
});

// ---------- Endpoints Aposta/Cashout ----------

app.post('/api/live/double/bet', authMiddleware, (req, res) => {
    const { color, amount } = req.body || {};
    const valid = ['red', 'black', 'white'];
    if (!valid.includes(color) || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Parâmetros inválidos' });
    }
    const g = liveGames.double;
    if (g.phase !== 'betting') return res.status(400).json({ message: 'Fora da janela de apostas' });
    const deb = debitForBet(req.user.userId, amount, `Apostou em ${color}`, 'Double');
    if (!deb.ok) return res.status(400).json({ message: deb.message });
    g.bets.push({ userId: req.user.userId, username: deb.username, amount, color });
    return res.json({ ok: true, balance: deb.balance, roundId: g.roundId });
});

app.post('/api/live/aviator/bet', authMiddleware, (req, res) => {
    const { amount } = req.body || {};
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ message: 'Parâmetros inválidos' });
    const g = liveGames.aviator;
    if (g.phase !== 'betting') return res.status(400).json({ message: 'Fora da janela de apostas' });
    const deb = debitForBet(req.user.userId, amount, `Aposta de R$ ${amount.toFixed(2)}`, 'Aviator');
    if (!deb.ok) return res.status(400).json({ message: deb.message });
    g.bets.push({ userId: req.user.userId, username: deb.username, amount, cashedOut: false, cashedMultiplier: null });
    return res.json({ ok: true, balance: deb.balance, roundId: g.roundId });
});

app.post('/api/live/aviator/cashout', authMiddleware, (req, res) => {
    const g = liveGames.aviator;
    if (g.phase !== 'playing') return res.status(400).json({ message: 'Cashout disponível apenas durante o voo' });
    const bet = g.bets.find(b => b.userId === req.user.userId);
    if (!bet) return res.status(404).json({ message: 'Aposta não encontrada nesta rodada' });
    if (bet.cashedOut) return res.status(400).json({ message: 'Aposta já sacada' });
    // Calcula multiplicador atual pelo tempo decorrido
    const elapsed = (Date.now() - g.playingStartedAt) / 1000;
    const currentMult = aviatorMultiplierAt(elapsed);
    if (currentMult >= g.crashPoint) return res.status(400).json({ message: 'Rodada já caiu' });
    const winAmount = bet.amount * currentMult;
    bet.cashedOut = true;
    bet.cashedMultiplier = currentMult;
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.userId);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
    user.balance = parseFloat((user.balance + winAmount).toFixed(2));
    db.logs.push({
        id: uuidv4(), user: user.username, userId: user.id, game: 'Aviator', type: 'Ganho',
        amount: winAmount, details: `Cashout em ${currentMult.toFixed(2)}x (Aposta: R$ ${bet.amount.toFixed(2)})`,
        timestamp: new Date().toISOString(), sessionId: null
    });
    writeDB(db);
    return res.json({ ok: true, balance: user.balance, multiplier: parseFloat(currentMult.toFixed(2)), amount: parseFloat(winAmount.toFixed(2)) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`API rodando em http://localhost:${PORT}`);
});