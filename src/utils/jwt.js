import jwt from 'jsonwebtoken';
import 'dotenv/config';

const SECRET = process.env.JWT_SECRET || 'dev-secret-please-change';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
