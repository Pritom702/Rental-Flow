import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import './styles.css';
import './market.css';
import './verify.css';
// Site-wide "Atelier" theme (light + dark) — loaded last so it re-themes every page.
import './theme.css';
// Community + rewards + the site-wide "feel good" layer.
import './social/social.css';
import './social/look.css';
import './social/business.css';
import { installClickSounds } from './sfx.js';
import { installMagnetic, installRipples } from './fx.js';
import { installLanguage } from './i18n.js';

// A new version was deployed while this tab was open, so the old page files
// are gone. Reload once to pick up the new build (at most every 30 s).
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('rf-reloaded-at') || 0);
    if (Date.now() - last < 30000) return;
    sessionStorage.setItem('rf-reloaded-at', String(Date.now()));
  } catch { /* storage blocked: still reload */ }
  event.preventDefault();
  window.location.reload();
});

// English or বাংলা, picked with the language button next to the theme toggle.
installLanguage();
installClickSounds();
installRipples();
installMagnetic();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
