import jwt from 'jsonwebtoken';

export function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyTokenFromRequest(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header) throw new Error('Token ausente');
  const token = header.replace('Bearer ', '');
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  try {
    return jwt.verify(token, secret);
  } catch (e) {
    throw new Error('Token inválido');
  }
}