// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M3 - Promit Ghosh Turjo (Promit)
//  GitHub: @___  |  Part: Frontend auth context (login/signup/logout)
// ============================================================
// Auth context: keeps the logged-in user + token, exposes login/signup/logout.
import { createContext, useCallback, useContext, useState } from 'react';
import { api, setToken, getToken } from './api.js';

const AuthContext = createContext(null);

// Identity-verification state of the signed-in account, remembered between
// visits so the app can route a new member straight to their step. The server
// is still the authority: every API call re-checks it.
const VSTATUS_KEY = 'rentalflow_vstatus';
const EMAIL_OK_KEY = 'rentalflow_email_ok';
function readEmailOk() {
  try {
    const v = localStorage.getItem(EMAIL_OK_KEY);
    return v == null ? null : v === '1';
  } catch { return null; }
}
function writeEmailOk(v) {
  try {
    if (v == null) localStorage.removeItem(EMAIL_OK_KEY);
    else localStorage.setItem(EMAIL_OK_KEY, v ? '1' : '0');
  } catch { /* ignore */ }
}
function readStatus() {
  try { return localStorage.getItem(VSTATUS_KEY) || null; } catch { return null; }
}
function writeStatus(s) {
  try {
    if (s) localStorage.setItem(VSTATUS_KEY, s);
    else localStorage.removeItem(VSTATUS_KEY);
  } catch { /* private mode: the server gate still applies */ }
}

function decodeUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.id, name: payload.name, email: payload.email, role: payload.role,
      verificationStatus: readStatus(),
      emailVerified: readEmailOk(),
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(decodeUser());

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    writeStatus(data.user.verificationStatus);
    writeEmailOk(data.user.emailVerified);
    setUser(data.user);
    return data.user;
  }

  // Public signup always creates a member, who then verifies their identity.
  async function signup(name, email, password) {
    const data = await api.post('/auth/signup', { name, email, password });
    setToken(data.token);
    writeStatus(data.user.verificationStatus);
    writeEmailOk(false);
    // Test mode (no email account configured): keep the code for the next screen.
    try {
      if (data.devCode) sessionStorage.setItem('rentalflow_dev_code', data.devCode);
    } catch { /* ignore */ }
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setToken(null);
    writeStatus(null);
    writeEmailOk(null);
    setUser(null);
  }

  // Sign in with a session handed over from another device (the QR hand-off).
  function adoptSession(token, sessionUser) {
    setToken(token);
    writeStatus(sessionUser.verificationStatus);
    writeEmailOk(sessionUser.emailVerified);
    setUser(sessionUser);
  }

  const setVerificationStatus = useCallback((status) => {
    writeStatus(status);
    setUser((u) => (u && u.verificationStatus !== status ? { ...u, verificationStatus: status } : u));
  }, []);

  const setEmailVerified = useCallback((ok) => {
    writeEmailOk(ok);
    setUser((u) => (u && u.emailVerified !== ok ? { ...u, emailVerified: ok } : u));
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, setVerificationStatus, setEmailVerified, adoptSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
