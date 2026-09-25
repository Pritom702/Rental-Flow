// ============================================================
//  RentalFlow  |  Marketplace  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: Buy now — used by sell posts and the For sale grid
// ============================================================
// Buy now opens a chat with the seller and goes straight to the payment page
// (RentalFlow Pay, a demo) at the asking price. Once paid, the item is sold,
// the chat unlocks for the hand-over and the deal stays on RentalFlow.
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
      const { pay } = await api.post('/payments/sale', { conversation_id: id });
      play('pop');
      navigate(pay);
    } catch (e) { say(e.message, 'warn'); }
  };
}
