// ============================================================
//  RentalFlow  |  Design system  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: light / dark mode, sound and language switches
// ============================================================
// Starts from the device's own setting (applied in index.html before the
// first paint, so there is no flash), then remembers the member's choice.
import { useState } from 'react';
import { Icon } from '../icons.jsx';
import { isMuted, play, setMuted } from '../sfx.js';
import { setLang, useLang } from '../i18n.js';

const KEY = 'rentalflow_theme';
const THEME_COLOR = { light: '#F5F1E8', dark: '#0C1511' };

export function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(currentTheme);

  function flip() {
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.add('theme-shift');              // cross-fade every colour
    root.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[next]);
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
    setTheme(next);
    setTimeout(() => root.classList.remove('theme-shift'), 500);
  }

  return (
    <span className={`toggles ${className}`}>
      <LangToggle />
      <SoundToggle />
      <button type="button" data-sfx="toggle" className="theme-toggle" onClick={flip}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
        <span className="theme-toggle-icons" data-theme={theme}>
          <Icon name="sun" size={17} />
          <Icon name="moon" size={17} />
        </span>
      </button>
    </span>
  );
}

function SoundToggle() {
  const [muted, setState] = useState(isMuted);
  function flip() {
    setMuted(!muted);
    setState(!muted);
    if (muted) play('success');                     // just switched on: a chime, so you can check your volume
  }
  return (
    <button type="button" data-sfx="none" className="theme-toggle sound-toggle" onClick={flip}
      aria-pressed={!muted} aria-label={muted ? 'Turn sounds on' : 'Turn sounds off'} title={muted ? 'Sounds off' : 'Sounds on'}>
      <Icon name={muted ? 'sound-off' : 'sound'} size={17} />
    </button>
  );
}

// বাংলা / English. The labels are never translated, so each language is
// always written in its own script.
export function LangToggle() {
  const lang = useLang();
  const next = lang === 'bn' ? 'en' : 'bn';
  return (
    <button type="button" data-sfx="toggle" className="lang-toggle" translate="no" onClick={() => setLang(next)}
      aria-label={lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'} title={lang === 'bn' ? 'English' : 'বাংলা'}>
      <span className={lang === 'bn' ? 'on' : ''}>বাং</span>
      <span className={lang === 'en' ? 'on' : ''}>EN</span>
    </button>
  );
}
