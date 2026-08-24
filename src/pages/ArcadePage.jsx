import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase, describeError } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import ArcadeCabinet from '../components/ArcadeCabinet';
import CouldNotLoad from '../components/CouldNotLoad';
import createInput from '../lib/arcade/input';
import { runGame } from '../lib/arcade/screen';
import { GAMES } from '../lib/arcade/games';
import { useDocumentTitle } from '../lib/pageMeta';

/**
 * The arcade.
 *
 * A go costs a coin and everybody gets one free go a day, so the machine is
 * never a locked door to somebody who has just arrived. The database decides
 * which of those a go is — this page only asks and then plays whatever it is
 * told it may play.
 *
 * The important sequencing: the coin is taken BEFORE the game starts, not
 * after. Charging at the end would mean a closed tab is a free go, and the
 * first person to notice would never pay again.
 */
export default function ArcadePage() {
  const { user, refreshProfile } = useAuth();

  useDocumentTitle(
    'The Arcade',
    'Five small retro games in a cabinet. One free go a day, then a coin a play.',
  );

  const [status, setStatus] = useState(null);
  const [unreachable, setUnreachable] = useState(false);
  const [picked, setPicked] = useState(GAMES[0].meta.id);
  const [phase, setPhase] = useState('idle');   // idle | playing | over
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastGo, setLastGo] = useState(null);

  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const runningRef = useRef(null);

  if (!inputRef.current) inputRef.current = createInput();

  // The input layer listens on the window for key presses, so it has to be
  // taken down when the page goes away or it will keep swallowing the space
  // bar on whatever page you go to next.
  useEffect(() => () => {
    runningRef.current?.stop();
    inputRef.current?.destroy();
    inputRef.current = null;
  }, []);

  const load = useCallback(async () => {
    setUnreachable(false);
    const { data, error: err } = await supabase.rpc('arcade_status');
    if (err) { setUnreachable(true); return; }
    setStatus(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const game = GAMES.find((g) => g.meta.id === picked) || GAMES[0];

  const start = async () => {
    setError('');
    setBusy(true);
    try {
      const { data, error: err } = await supabase.rpc('start_arcade_play', { p_game: picked });
      if (err) throw err;

      setLastGo(data);
      setStatus((s) => (s ? { ...s, balance: data.balance, free_left: data.free_left } : s));

      // The coin count in the header comes from the profile the auth context
      // loaded when the page opened, so paying for a go left it showing the
      // old number until something else happened to reload it. Watching your
      // balance not move after you have been charged reads as the charge
      // having failed.
      if (data.paid > 0) refreshProfile();
      setScore(0);
      setPhase('playing');

      // The canvas only exists once the cabinet is on screen, so the game is
      // started on the next frame rather than immediately.
      requestAnimationFrame(() => {
        if (!canvasRef.current) return;
        inputRef.current?.clear();
        runningRef.current?.stop();
        runningRef.current = runGame(canvasRef.current, game, {
          input: inputRef.current,
          onScore: setScore,
          onOver: () => setPhase('over'),
        });
      });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const quit = () => {
    runningRef.current?.stop();
    runningRef.current = null;
    setPhase('over');
  };

  const backToPicker = () => {
    runningRef.current?.stop();
    runningRef.current = null;
    setPhase('idle');
    load();
  };

  if (unreachable) {
    return <CouldNotLoad what="The Arcade" onRetry={load} backTo="/" backLabel="Back to the home page" />;
  }

  const cost = status?.cost ?? 1;
  const freeLeft = status?.free_left ?? 0;
  const balance = status?.balance ?? 0;
  const canAfford = freeLeft > 0 || balance >= cost;

  const line = !user
    ? 'Sign in to play'
    : freeLeft > 0
      ? `Your free go is waiting · ${balance} coins`
      : `${cost} coin a go · you have ${balance}`;

  return (
    <>
      <SiteHeader />

      <div className="vg-page vg-arcade">
        <div className="vg-arcade-intro">
          <h1>🕹️ THE ARCADE</h1>
          <p>
            Five small games in one machine. Your first go each day is free —
            after that it is {cost} Vibe {cost === 1 ? 'Coin' : 'Coins'} a go, the
            same coins you earn by rating things and posting your own work.
            Nothing here can be bought with money.
          </p>
        </div>

        <Notice tone="error">{error}</Notice>

        <ArcadeCabinet
          screenRef={canvasRef}
          input={inputRef.current}
          marquee={phase === 'playing' ? game.meta.name : 'VIBEGROUNDS ARCADE'}
          score={score}
          status={line}
          showControls={phase === 'playing'}
        >
          {phase !== 'playing' && (
            <div className="vg-arcade-attract">
              {phase === 'over' ? (
                <>
                  <div className="vg-arcade-big">GAME OVER</div>
                  <div className="vg-arcade-final">{game.meta.name} — {score}</div>
                  <button type="button" className="retro-cta" onClick={backToPicker}>
                    ↩ BACK TO THE CABINET
                  </button>
                </>
              ) : (
                <>
                  <div className="vg-arcade-big">{game.meta.name}</div>
                  <div className="vg-arcade-blurb">{game.meta.blurb}</div>
                  <div className="vg-arcade-how">{game.meta.how}</div>

                  {!user ? (
                    <Link to="/auth" className="retro-cta">SIGN IN TO PLAY</Link>
                  ) : !canAfford ? (
                    <div className="vg-arcade-broke">
                      <p>You are out of coins for today.</p>
                      <p>
                        Rate a few things or post something of your own — that is
                        how coins are earned here. Your free go comes back tomorrow.
                      </p>
                      <Link to="/portal">Go and rate something →</Link>
                    </div>
                  ) : (
                    <button type="button" className="retro-cta vg-arcade-insert" disabled={busy} onClick={start}>
                      {busy ? 'STARTING…' : freeLeft > 0 ? '▶ FREE GO — PRESS START' : `▶ INSERT ${cost} COIN`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </ArcadeCabinet>

        {phase === 'playing' && (
          <div className="vg-arcade-quit">
            <button type="button" onClick={quit}>■ End this go</button>
            <span>
              {lastGo?.free ? 'This one was free.' : `${lastGo?.paid ?? cost} coin taken.`}
            </span>
          </div>
        )}

        {phase !== 'playing' && (
          <div className="vg-arcade-picker">
            <div className="section-header"><h2>🎮 Pick a machine</h2></div>
            <div className="vg-arcade-grid">
              {GAMES.map((g) => (
                <button
                  key={g.meta.id}
                  type="button"
                  className={`vg-arcade-tile ${g.meta.id === picked ? 'is-on' : ''}`}
                  onClick={() => { setPicked(g.meta.id); setPhase('idle'); setScore(0); }}
                >
                  <span className="vg-arcade-tile-name">{g.meta.name}</span>
                  <span className="vg-arcade-tile-blurb">{g.meta.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="vg-arcade-note">
          Scores are not saved yet. A leaderboard is the obvious next thing and
          it needs doing properly — there is no point in a chart that anybody
          can type a number into.
        </p>
      </div>
    </>
  );
}
