import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase, describeError } from '../lib/supabase';
import SiteHeader from '../components/SiteHeader';

/**
 * Stopping the emails.
 *
 * Acts on arrival rather than asking for a confirming click. Somebody who
 * followed an unsubscribe link has already decided; making them press a
 * second button is a small act of hostility, and the reason so many
 * unsubscribe pages feel like a fight. There is an undo underneath instead,
 * for the one person in a hundred who clicked it by accident.
 *
 * Works with no account and no session. The whole point is that a person
 * who has forgotten this site exists can still make it stop.
 */
export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';

  const [state, setState] = useState('working');   // working | done | unknown | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setState('unknown'); return; }
    let alive = true;

    (async () => {
      const { data, error: err } = await supabase.rpc('unsubscribe_by_token', { p_token: token });
      if (!alive) return;
      if (err) { setError(describeError(err)); setState('error'); return; }
      setState(data ? 'done' : 'unknown');
    })();

    return () => { alive = false; };
  }, [token]);

  return (
    <>
      <SiteHeader compact />
      <div className="vg-page">
        <div className="retro-panel">
          <div className="section-header"><h2>✉️ Email settings</h2></div>
          <div className="retro-panel-body vg-prose">

            {state === 'working' && <p>One moment...</p>}

            {state === 'done' && (
              <>
                <p><strong>Done — that is switched off.</strong></p>
                <p>
                  VibeGrounds will not email you again about posting. You can still
                  sign in and use the site exactly as before, and anything you
                  actually ask for — a password reset, confirming your address —
                  still works, because that is you asking us rather than us
                  bothering you.
                </p>
                <p>
                  Changed your mind? Turn it back on in{' '}
                  <Link to="/settings">your settings</Link> whenever you like.
                </p>
              </>
            )}

            {state === 'unknown' && (
              <>
                <p><strong>That link has expired, or it was already used.</strong></p>
                <p>
                  If you are still getting email you do not want, mail{' '}
                  <a href="mailto:kierandrowan@gmail.com?subject=Stop%20emailing%20me">
                    kierandrowan@gmail.com
                  </a>{' '}
                  and it gets sorted by hand. It goes to one person, not a queue.
                </p>
              </>
            )}

            {state === 'error' && (
              <>
                <p><strong>Something went wrong at our end.</strong></p>
                <p style={{ color: 'var(--text-dim)' }}>{error}</p>
                <p>
                  Rather than leave you stuck: email{' '}
                  <a href="mailto:kierandrowan@gmail.com?subject=Stop%20emailing%20me">
                    kierandrowan@gmail.com
                  </a>{' '}
                  and it will be done manually.
                </p>
              </>
            )}

            <p style={{ marginTop: '18px' }}>
              <Link to="/" style={{ color: 'var(--orange)', fontWeight: 'bold' }}>← VibeGrounds</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
