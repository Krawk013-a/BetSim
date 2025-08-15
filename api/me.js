import { ensureSchema } from './_schema.js';
import { verifyTokenFromRequest } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const supabase = await ensureSchema();
    const payload = verifyTokenFromRequest(req);
    const { data: users, error } = await supabase.from('users').select('id, username, balance').eq('id', payload.userId).limit(1);
    if (error) throw new Error(error.message);
    if (!users || !users.length) return res.status(404).json({ message: 'Usuário não encontrado' });
    const u = users[0];

    // Depósito diário automático de R$ 100
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const { data: todayLogs, error: logErr } = await supabase
      .from('logs')
      .select('id')
      .eq('user_id', u.id)
      .eq('type', 'Depósito Diário')
      .gte('timestamp', start.toISOString())
      .lt('timestamp', end.toISOString())
      .limit(1);
    if (logErr) throw new Error(logErr.message);

    let balance = Number(u.balance);
    if (!todayLogs || !todayLogs.length) {
      balance = balance + 100;
      const { error: updErr } = await supabase.from('users').update({ balance }).eq('id', u.id);
      if (updErr) throw new Error(updErr.message);
      const { error: insErr } = await supabase.from('logs').insert({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        user_id: u.id,
        user_name: u.username,
        game: 'Bank',
        type: 'Depósito Diário',
        amount: 100,
        details: 'Depósito automático diário',
        timestamp: new Date().toISOString(),
        session_id: null
      });
      if (insErr) throw new Error(insErr.message);
    }

    return res.json({ id: u.id, username: u.username, balance });
  } catch (e) {
    const msg = e.message || 'Erro no servidor';
    return res.status(msg.includes('Token') ? 401 : 500).json({ message: msg });
  }
}