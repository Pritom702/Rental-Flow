// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Buy now — used by sell posts and the For sale grid
// ============================================================
// Buy now sends an offer at the asking price in a chat with the seller. The
// seller accepts there; the item is marked sold and the deal stays on
// RentalFlow (so the buyer keeps its protection).
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { money } from '../money.js';
import { play } from '../sfx.js';
import { say } from './toast.js';

// Signed out? Go to sign-up, and come back here afterwards.
export function useGuestGuard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  return () => {
    if (user) return false;
    navigate(`/login?mode=signup&next=${encodeURIComponent(pathname + search)}`);
    return true;
  };
}

export function useBuyNow() {
  const navigate = useNavigate();
  const guest = useGuestGuard();
  return async (post) => {
    if (guest()) return;
    if (!window.confirm(`Buy this for ${money(post.sale.price)}? The seller confirms in your chat, then you arrange the hand-over. Pay only when you have the item.`)) return;
    try {
      const { id } = await api.post('/messages/conversations', { post_id: post.id });
      try {
        await api.post('/market/deals', { conversation_id: id, buy_now: true });
      } catch (e) {
        if (!/already an offer/i.test(e.message)) throw e;   // an offer is already waiting: just open the chat
      }
      play('success');
      say('Sent — the seller confirms in your chat', 'coin');
      navigate(`/messages/${id}`);
    } catch (e) { say(e.message, 'warn'); }
  };
}
