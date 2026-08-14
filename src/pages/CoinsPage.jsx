import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';

/**
 * Guess the viewer's country from their browser locale so a UK visitor
 * sees £5 and an American sees $5 — same clean number, right currency.
 * They can override it with the picker if we guess wrong.
 */
function detectCountry() {
  try {
    const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const loc of locales) {
      const region = new Intl.Locale(loc).region;
      if (region) return region.toUpperCase();
    }
  } catch { /* older browser — fall through */ }
  return 'GB';
}

const MARKETS = [
  { code: 'GB', label: '🇬🇧 UK (£)' },
  { code: 'US', label: '🇺🇸 US ($)' },
  { code: 'DE', label: '🇪🇺 EU (€)' },
  { code: 'CA', label: '🇨🇦 Canada (CA$)' },
  { code: 'AU', label: '🇦🇺 Australia (A$)' },
];

const REASON_LABELS = {
  signup_bonus: '🎁 Welcome bonus',
  submission: '🚀 Submission',
  purchase: '💳 Vibe Coin purchase',
  refund: '↩️ Refund',
  admin_grant: '🎩 Granted by staff',
  admin_deduct: '🎩 Removed by staff',
  achievement: '🏅 Achievement reward',
  contest_prize: '🏆 Contest prize',
  featured_bonus: '⭐ Featured bonus',
};

export default function CoinsPage() {
  const { user, coins, emailVerified } = useAuth();
  const [country, setCountry] = useState(detectCountry());
  const [packs, setPacks] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.rpc('get_coin_packs', { p_country: country });
      if (err) { setError(err.message); return; }
      setPacks(data || []);
    })();
  }, [country]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('coin_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setHistory(data || []);
    })();
  }, [user, coins]);

  const buy = async (pack) => {
    setError('');
    setBusy(pack.slug);
    try {
      const { data, error: err } = await supabase.rpc('create_purchase_intent', {
        p_pack: pack.slug,
        p_country: country,
      });
      if (err) throw new Error(err.message);

      const checkoutUrl = import.meta.env.VITE_CHECKOUT_URL;
      if (!checkoutUrl) {
        throw new Error(
          'Card payments are not switched on yet — the Stripe checkout endpoint has not been configured. ' +
          'Your order was not charged.',
        );
      }

      const res = await fetch(checkoutUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ purchase_id: data.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || 'Could not start checkout.');
      window.location.href = json.url;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <SiteHeader compact />
      <div className="profile-page" style={{ paddingBottom: '40px' }}>

        {/* Wallet */}
        <div className="retro-panel">
          <div className="section-header"><h2>🪙 Your Vibe Coins</h2></div>
          <div className="retro-panel-body" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '32px', color: 'var(--yellow)' }}>
              {user ? coins : '—'}
            </div>
            <div style={{ fontFamily: 'var(--font-retro)', fontSize: '19px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {user
                ? `That's ${Math.floor(coins / 10)} submission${Math.floor(coins / 10) === 1 ? '' : 's'} in the tank.`
                : <><Link to="/auth?mode=signup" style={{ color: 'var(--orange)' }}>Join up</Link> and get 50 Vibe Coins free.</>}
            </div>
          </div>
        </div>

        {/* Why coins exist */}
        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header"><h2>❓ Why Vibe Coins?</h2></div>
          <div className="retro-panel-body" style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <p>Posting costs 10 coins. That is not about the money — it is about friction.</p>
            <p style={{ marginTop: '6px' }}>
              A troll with a spam script will not pay to flood the Portal. A creator with something
              to show barely notices. Everyone gets 50 Vibe Coins free on signup, which is five posts
              before you spend a penny.
            </p>
          </div>
        </div>

        {/* Packs */}
        <div className="retro-panel" style={{ marginTop: '16px' }}>
          <div className="section-header"><h2>💰 Top Up</h2></div>
          <div className="retro-panel-body">
            <Notice tone="error">{error}</Notice>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--text-dim)' }}>
                Showing prices for:
              </span>
              <select
                value={MARKETS.some((m) => m.code === country) ? country : 'GB'}
                onChange={(e) => setCountry(e.target.value)}
                style={{
                  padding: '4px 8px', background: 'var(--bg-input)',
                  border: '2px solid var(--border-dark)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-retro)', fontSize: '16px',
                }}
              >
                {MARKETS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {packs.map((p) => (
                <div key={p.slug} style={{
                  flex: '1 1 200px',
                  border: `2px solid ${p.is_popular ? 'var(--orange)' : 'var(--border-panel)'}`,
                  background: 'var(--bg-panel-alt)', padding: '16px', position: 'relative',
                }}>
                  {p.is_popular && (
                    <div style={{
                      position: 'absolute', top: '-11px', left: '12px', background: 'var(--orange)',
                      color: '#000', fontFamily: 'var(--font-pixel)', fontSize: '7px', padding: '3px 6px',
                    }}>
                      MOST POPULAR
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '11px', color: 'var(--text-bright)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '20px', color: 'var(--yellow)', margin: '12px 0 4px' }}>
                    🪙 {p.total_coins}
                  </div>
                  {p.bonus_coins > 0 && (
                    <div style={{ fontFamily: 'var(--font-retro)', fontSize: '16px', color: 'var(--green)' }}>
                      includes {p.bonus_coins} bonus coins
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-secondary)', margin: '8px 0' }}>
                    {p.submissions} submissions · {p.blurb}
                  </div>
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '16px', color: 'var(--text-bright)', margin: '10px 0' }}>
                    {p.display}
                  </div>
                  <button
                    type="button"
                    onClick={() => buy(p)}
                    disabled={!user || !emailVerified || busy === p.slug}
                    title={!user ? 'Sign in first' : !emailVerified ? 'Confirm your email first' : undefined}
                    style={{
                      width: '100%', background: 'var(--orange)', color: '#000',
                      border: '2px solid var(--orange-dim)', fontFamily: 'var(--font-pixel)',
                      fontSize: '9px', padding: '9px', cursor: user && emailVerified ? 'pointer' : 'not-allowed',
                      opacity: user && emailVerified ? 1 : 0.5,
                    }}
                  >
                    {busy === p.slug ? 'OPENING...' : `BUY ${p.display}`}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)', marginTop: '12px' }}>
              Payments are handled by Stripe — VibeGrounds never sees your card details.
              Vibe Coins are non-refundable once spent and have no cash value.
            </div>
          </div>
        </div>

        {/* Ledger */}
        {user && (
          <div className="retro-panel" style={{ marginTop: '16px' }}>
            <div className="section-header"><h2>📜 Vibe Coin History</h2></div>
            <div className="retro-panel-body" style={{ padding: 0 }}>
              {history.length === 0 ? (
                <div style={{ padding: '20px', fontFamily: 'var(--font-retro)', fontSize: '17px', color: 'var(--text-dim)', textAlign: 'center' }}>
                  Nothing here yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {history.map((t) => (
                      <tr key={t.id}>
                        <td style={{ padding: '7px 10px', fontFamily: 'var(--font-retro)', fontSize: '16px', borderBottom: '1px solid var(--border-dark)' }}>
                          {REASON_LABELS[t.reason] || t.reason}
                          {t.note && <span style={{ color: 'var(--text-dim)' }}> — {t.note}</span>}
                        </td>
                        <td style={{
                          padding: '7px 10px', fontFamily: 'var(--font-retro)', fontSize: '17px',
                          textAlign: 'right', whiteSpace: 'nowrap',
                          borderBottom: '1px solid var(--border-dark)',
                          color: t.amount >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          {t.amount >= 0 ? '+' : ''}{t.amount}
                        </td>
                        <td style={{ padding: '7px 10px', fontFamily: 'var(--font-retro)', fontSize: '15px', color: 'var(--text-dim)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-dark)' }}>
                          {new Date(t.created_at).toLocaleDateString('en-GB')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
