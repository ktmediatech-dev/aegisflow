import jwt from 'jsonwebtoken';
import 'dotenv/config';

const SECRET = process.env.JWT_SECRET || 'dev-secret-please-change';

export function signToken(payload, options = {}) {
  return jwt.sign(payload, SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    ...options,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
