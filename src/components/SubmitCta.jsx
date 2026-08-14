import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * A quiet, one-line prompt to post something. Sits at the foot of browse
 * pages so someone who has just finished scrolling has an obvious next move,
 * without a banner shouting at them on the way in.
 */
export default function SubmitCta({ text }) {
  const { user } = useAuth();

  return (
    <div className="vg-submit-cta">
      <span className="vg-submit-cta-text">
        {text || (user
          ? 'Made something? Get it on the charts — 10 coins a post.'
          : 'Made something? Join and get 50 free Vibe Coins — five posts on the house.')}
      </span>
      <Link to={user ? '/upload' : '/auth?mode=signup'} className="vg-submit-cta-btn">
        {user ? '🚀 SUBMIT A CREATION' : 'JOIN & SUBMIT'}
      </Link>
    </div>
  );
}
