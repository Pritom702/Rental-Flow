// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  GitHub: @___  |  Part: Signup/login API (bcrypt + JWT)
// ============================================================
// Auth routes: signup + login. Raw SQL, bcrypt password hashing, JWT tokens.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { sendVerificationCode } from './verify.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, password } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  }
  // Public signup ALWAYS creates a member. Admin and staff accounts are made by
  // an existing admin from the Admin page — never self-assigned — because the
  // admins are the people who approve everyone else's identity.
  try {
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role, verification_status)
       VALUES ($1, $2, $3, 'member', 'unverified')
       RETURNING id, name, email, role, verification_status`,
      [String(name).trim(), email, hash]
    );
    const row = rows[0];
    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    // First step of verification starts straight away: the code is in their inbox
    // by the time the next screen loads.
    let dev = {};
    try {
      dev = await sendVerificationCode(row);
    } catch (err) {
      console.error('Verification email failed:', err.message);   // they can press "resend"
    }
    res.status(201).json({ token: signToken(user), user: { ...user, verificationStatus: 'unverified', emailVerified: false }, ...dev });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const { rows } = await query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({
    token: signToken(publicUser),
    user: {
      ...publicUser,
      verificationStatus: user.verification_status,
      // accounts from before email codes existed count as confirmed
      emailVerified: Boolean(user.email_verified_at) || user.verification_status === 'verified',
    },
  });
});

export default router;
