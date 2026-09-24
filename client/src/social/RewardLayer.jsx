// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: the reward layer (XP pops, level up, badges)
// ============================================================
// Mounted once for the whole app. Whenever any request earns something (see
// api.js → 'rf:reward'), this shows it where the member's attention already
// is:
//   +XP        a small lime chip rises from the spot that was just tapped
//   streak     a flame toast when today extends the streak
//   badge      a card slides up with a shine sweep
//   level up   a centred burst with confetti, then it gets out of the way
// All of it uses transform / opacity only and cleans itself up.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { play } from '../sfx.js';
import { celebrate } from '../fx.js';
import { applyReward, loadMe, useMe } from './store.js';

// Where the last tap happened, so "+10 XP" can rise from right there.
let lastPoint = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { lastPoint = { x: e.clientX, y: e.clientY, at: Date.now() }; }, { capture: true, passive: true });
}

let seq = 0;
export default function RewardLayer() {
  const { user } = useAuth();
  const [pops, setPops] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [levelUp, setLevelUp] = useState(null);
  const [notice, setNotice] = useState(null);
  const { logout } = useAuth();

  useEffect(() => { if (user) loadMe(); }, [user]);

  // Small confirmations ("Link copied") and moderation notices.
  useEffect(() => {
    const onToast = (e) => toast({ kind: 'info', icon: e.detail.icon, title: e.detail.text, body: '' });
    const onModeration = (e) => setNotice(e.detail);
    window.addEventListener('rf:toast', onToast);
    window.addEventListener('rf:moderation', onModeration);
    return () => {
      window.removeEventListener('rf:toast', onToast);
      window.removeEventListener('rf:moderation', onModeration);
    };
  }, []);

  useEffect(() => {
    function onReward(e) {
      const r = e.detail;
      applyReward(r);
      if (r.xp > 0) {
        const fresh = lastPoint && Date.now() - lastPoint.at < 4000;
        const x = fresh ? lastPoint.x : window.innerWidth - 90;
        const y = fresh ? lastPoint.y : 70;
        const id = ++seq;
        setPops((p) => [...p, { id, x, y, xp: r.xp, label: r.label }]);
        setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 1400);
        window.dispatchEvent(new CustomEvent('rf:xp-gain'));
      }
      if (r.streakUp) toast({ kind: 'streak', icon: '🔥', title: `${r.streak}-day streak!`, body: 'Come back tomorrow to keep it going.' });
      (r.badges || []).forEach((b, i) => setTimeout(() => {
        play('success');
        toast({ kind: 'rt-badge', icon: b.icon, title: 'Badge unlocked', body: b.name });
      }, 350 + i * 900));
      if (r.levelUp) {
        setTimeout(() => {
          play('levelup');
          celebrate({ silent: true });
          setLevelUp(r.level);
        }, 250);
      }
    }
    window.addEventListener('rf:reward', onReward);
    return () => window.removeEventListener('rf:reward', onReward);
  }, []);

  function toast(t) {
    const id = ++seq;
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 3800);
  }

  useEffect(() => {
    if (!levelUp) return undefined;
    const t = setTimeout(() => setLevelUp(null), 3400);
    return () => clearTimeout(t);
  }, [levelUp]);

  return (
    <>
      <div className="xp-pops" aria-live="polite">
        {pops.map((p) => (
          <span key={p.id} className="xp-pop" style={{ left: p.x, top: p.y }}>
            <b>+{p.xp} XP</b>{p.label && <small>{p.label}</small>}
          </span>
        ))}
      </div>
      <div className="reward-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`reward-toast ${t.kind}`} role="status">
            <span className="rt-icon">{t.icon}</span>
            <div><b>{t.title}</b>{t.body && <span>{t.body}</span>}</div>
          </div>
        ))}
      </div>
      {notice && (
        <div className="modal-backdrop" role="alertdialog" aria-label="Community rules">
          <div className="modal narrow mod-notice">
            <div className={`mod-icon ${notice.reason === 'adult-warning' ? 'warn' : 'ban'}`}>{notice.reason === 'adult-warning' ? '⚠️' : '⛔'}</div>
            <h2>{notice.reason === 'adult-warning' ? 'This is your one warning' : 'Your account is banned'}</h2>
            <p>{notice.message}</p>
            {notice.reason === 'adult-warning' ? (
              <>
                <p className="muted">RentalFlow is for everyone. Porn and nudity are never allowed — in posts, videos, moments or listings. A second time means a permanent ban.</p>
                <button type="button" className="btn lg block" onClick={() => setNotice(null)}>I understand</button>
              </>
            ) : (
              <button type="button" className="btn secondary lg block" onClick={() => { setNotice(null); logout(); }}>Sign out</button>
            )}
          </div>
        </div>
      )}
      {levelUp && (
        <div className="levelup" onClick={() => setLevelUp(null)} role="dialog" aria-label={`Level ${levelUp.level}`}>
          <div className="levelup-card">
            <div className="levelup-rays" aria-hidden="true" />
            <div className="levelup-num">{levelUp.level}</div>
            <div className="levelup-title">Level up!</div>
            <div className="levelup-name">You're now <b>{levelUp.name}</b></div>
            <div className="muted small">Next level at {levelUp.next} XP</div>
          </div>
        </div>
      )}
    </>
  );
}

// The ring in the top bar: level in the middle, progress round the edge, the
// streak flame beside it. It pulses whenever XP lands.
export function XpRing() {
  const me = useMe();
  const navigate = useNavigate();
  const [pulse, setPulse] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    const on = () => {
      setPulse(false);
      requestAnimationFrame(() => setPulse(true));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPulse(false), 900);
    };
    window.addEventListener('rf:xp-gain', on);
    return () => window.removeEventListener('rf:xp-gain', on);
  }, []);
  if (!me) return null;
  const r = 15;
  const c = 2 * Math.PI * r;
  const progress = me.level?.progress || 0;
  return (
    <button
      type="button"
      className={`xp-ring-btn${pulse ? ' pulse' : ''}`}
      onClick={() => navigate('/u/me')}
      title={`Level ${me.level.level} · ${me.level.name} — ${me.xp} / ${me.level.next} XP`}
      aria-label={`Level ${me.level.level}, ${me.xp} XP, ${me.streak} day streak`}
    >
      <span className="xp-ring">
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r={r} className="xp-track" />
          <circle cx="18" cy="18" r={r} className="xp-fill" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
        </svg>
        <b>{me.level.level}</b>
      </span>
      {me.streak > 0 && (
        <span className={`streak-chip${me.activeToday ? '' : ' cold'}`} title={me.activeToday ? 'Streak kept today' : 'Visit today to keep your streak'}>
          🔥{me.streak}
        </span>
      )}
    </button>
  );
}

// A compact progress card (feed side rail, profile).
export function LevelCard() {
  const me = useMe();
  if (!me) return null;
  const pct = Math.round((me.level.progress || 0) * 100);
  const unlocked = me.badges.filter((b) => b.unlocked);
  const nextBadge = me.badges.find((b) => !b.unlocked);
  return (
    <div className="level-card">
      <div className="lc-top">
        <div className="lc-level"><span>Level</span><b>{me.level.level}</b></div>
        <div className="lc-meta">
          <b>{me.level.name}</b>
          <span className="muted">{me.xp} XP · {me.level.next - me.xp} to next</span>
        </div>
        <div className={`lc-streak${me.activeToday ? '' : ' cold'}`}>
          <span>🔥</span><b>{me.streak}</b><small>day{me.streak === 1 ? '' : 's'}</small>
        </div>
      </div>
      <div className="lc-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="lc-badges">
        {unlocked.slice(-6).map((b) => <span key={b.id} title={b.name}>{b.icon}</span>)}
        <Link to="/u/me" className="lc-all">{unlocked.length}/{me.badges.length} badges</Link>
      </div>
      {nextBadge && <div className="lc-next">Next: <b>{nextBadge.icon} {nextBadge.name}</b> — {nextBadge.hint.toLowerCase()}</div>}
    </div>
  );
}
