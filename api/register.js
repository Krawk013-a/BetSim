import { ensureSchema } from './_schema.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const supabase = await ensureSchema();
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: 'Usuário e senha são obrigatórios' });
    const { data: existing, error: selErr } = await supabase.from('users').select('id').ilike('username', username).limit(1);
    if (selErr) throw new Error(selErr.message);
    if (existing && existing.length) return res.status(409).json({ message: 'Usuário já existe' });
    const passwordHash = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const { error: insErr } = await supabase.from('users').insert({ id, username, password_hash: passwordHash, balance: 100 });
    if (insErr) throw new Error(insErr.message);
    return res.json({ message: 'Registrado com sucesso' });
  } catch (e) {
    console.error('register:error', e);
    return res.status(500).json({ message: e.message || 'Erro no servidor' });
  }
}