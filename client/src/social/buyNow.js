// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Buy now — used by sell posts and the For sale grid
// ============================================================
// Buy now asks the seller to sell at the asking price. The seller sees the
// buyer's rental and sales record and accepts; then the buyer pays on
// RentalFlow Pay (a demo) and the chat opens for the hand-over. If the seller
// already accepted, Buy now goes straight to the payment page.
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
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
    try {
      const { id } = await api.post('/messages/conversations', { post_id: post.id });
      try {
        const { pay } = await api.post('/payments/sale', { conversation_id: id });
        play('pop');
        navigate(pay);
        return;
      } catch (e) {
        if (e.reason !== 'awaiting-seller') throw e;
        // Ask the seller; an offer already waiting in this chat is fine too.
        await api.post('/market/deals', { conversation_id: id, buy_now: true }).catch((err) => {
          if (!/already an offer/i.test(err.message)) throw err;
        });
      }
      play('send');
      say('Request sent. You can pay and chat as soon as the seller accepts.', 'sell');
      navigate(`/messages/${id}`);
    } catch (e) { say(e.message, 'warn'); }
  };
}
