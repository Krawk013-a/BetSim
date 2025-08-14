import { ensureSchema } from './_schema.js';
import bcrypt from 'bcryptjs';
import { signToken } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const supabase = await ensureSchema();
    const { username, password } = req.body || {};
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, password_hash, balance')
      .ilike('username', username)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!users || !users.length) return res.status(401).json({ message: 'Credenciais inválidas' });
    const user = users[0];
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Credenciais inválidas' });
    const token = signToken({ userId: user.id, username: user.username });
    return res.json({ token, user: { id: user.id, username: user.username, balance: Number(user.balance) } });
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Erro no servidor' });
  }
}