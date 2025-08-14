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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`API rodando em http://localhost:${PORT}`);
});