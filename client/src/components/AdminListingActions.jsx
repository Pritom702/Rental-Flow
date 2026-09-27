// ============================================================
//  RentalFlow  |  Community  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: admin controls right on a listing
// ============================================================
// An admin looking at any listing (Browse cards, the product page) can remove
// it, warn its owner or message them on the spot — the same actions as the
// Listings tab of the admin console (routes/moderation.js).
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { play } from '../sfx.js';
import { say } from '../social/toast.js';

export default function AdminListingActions({ type = 'item', id, title, ownerId, ownerName, onRemoved, large = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user?.role !== 'admin') return null;
  const size = large ? 'lg' : 'small';

  async function act(action, e) {
    e?.stopPropagation();
    const reason = window.prompt(action === 'remove'
      ? `Remove “${title}”? It is deleted and ${ownerName || 'the owner'} is told why. Reason:`
      : `Warning to ${ownerName || 'the owner'} about “${title}” — what should they fix?`,
    action === 'remove' ? 'It breaks the listing rules.' : 'Please fix the photos, price or description.');
    if (!reason) return;
    try {
      await api.post(`/moderation/listings/${type}/${id}/${action}`, { reason });
      play('success');
      say(action === 'remove' ? 'Listing removed — the owner was told' : `${ownerName || 'The owner'} was warned`, 'shield');
      if (action === 'remove') onRemoved?.();
    } catch (err) { say(err.message, 'warn'); }
  }
  async function message(e) {
    e?.stopPropagation();
    const body = window.prompt(`Message to ${ownerName || 'the owner'} (from the RentalFlow team):`, `About your listing “${title}”: `);
    if (!body || !body.trim()) return;
    try {
      const r = await api.post('/moderation/message', { user_id: ownerId, body });
      play('send');
      navigate(`/messages/${r.conversation_id}`);
    } catch (err) { say(err.message, 'warn'); }
  }

  return (
    <div className="card-actions admin-listing-actions" onClick={(e) => e.stopPropagation()}>
      <button type="button" className={`btn danger ${size}`} onClick={(e) => act('remove', e)}>Remove</button>
      <button type="button" className={`btn secondary ${size}`} onClick={(e) => act('warn', e)}>Warn</button>
      {ownerId && ownerId !== user.id && <button type="button" className={`btn ghost ${size}`} onClick={message}>Message</button>}
    </div>
  );
}
