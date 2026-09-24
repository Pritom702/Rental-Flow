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
import { installClickSounds } from './sfx.js';
import { installMagnetic, installRipples } from './fx.js';

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
