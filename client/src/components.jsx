// ============================================================
//  RentalFlow  |  Sprint 1  |  Owner: M4 - Radowanul Haque (Radowan)
//  GitHub: @___  |  Part: Shared UI components (badge, tags, card photo)
// ============================================================
// Small shared presentational pieces.
import { Icon } from './icons.jsx';

// Cover photo shown at the top of an item card. `count` shows how many photos exist.
// The product is shown WHOLE (never cropped), fitted inside a lit "stage".
// `children` layer on top of the stage (the product card's description reveal).
export function CardPhoto({ url, count, children }) {
  return (
    <div className="card-photo">
      {url
        ? <img className="stage-img" src={url} alt="" loading="lazy" decoding="async" />
        : <div className="no-photo"><Icon name="camera" size={18} /> No photo</div>}
      {count > 1 && <span className="count-badge">{count} photos</span>}
      {children}
    </div>
  );
}

export function StatusBadge({ status }) {
  // Single class token (spaces -> hyphen) so multi-word statuses like
  // "Under Maintenance" still match their CSS rule.
  const cls = `badge ${status.replace(/\s+/g, '-')}`;
  return <span className={cls}>{status}</span>;
}

export function TagList({ tags }) {
  // tags may be a comma string (list endpoint) or array of {name} (detail).
  let names = [];
  if (Array.isArray(tags)) names = tags.map((t) => (typeof t === 'string' ? t : t.name));
  else if (typeof tags === 'string' && tags) names = tags.split(',').map((s) => s.trim());
  if (!names.length) return null;
  return (
    <div>
      {names.map((n) => (
        <span className="tag" key={n}>#{n}</span>
      ))}
    </div>
  );
}
