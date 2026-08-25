import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase, describeError } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SiteHeader from '../components/SiteHeader';
import Notice from '../components/Notice';
import ArcadeCabinet from '../components/ArcadeCabinet';
import ArcadeMenu from '../components/ArcadeMenu';
import ArcadeCharts from '../components/ArcadeCharts';
import ArcadeInitials from '../components/ArcadeInitials';
import CouldNotLoad from '../components/CouldNotLoad';
import createInput from '../lib/arcade/input';
import { runGame } from '../lib/arcade/screen';
import { GAMES } from '../lib/arcade/games';
import { useDocumentTitle } from '../lib/pageMeta';
import { scrollToElement } from '../lib/scrollTo';

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
 *
 * The score goes the other way — filed at the end, against the play id the
 * coin bought. See migration 34 for exactly what that does and does not
 * prove; the short version is on the page itself under the charts, because a
 * leaderboard that quietly overstates how trustworthy it is deserves less
 * trust than one that says where its edges are.
 */
export default function ArcadePage() {
  const { user, profile, refreshProfile } = useAuth();

  useDocumentTitle(
    'The Arcade',
    'Nine small retro games in one cabinet, with high score tables. One free go a day, then a coin a play.',
  );

  const [status, setStatus] = useState(null);
  const [unreachable, setUnreachable] = useState(false);
  const [charts, setCharts] = useState(null);
  const [picked, setPicked] = useState(GAMES[0].meta.id);
  const [phase, setPhase] = useState('idle');   // idle | playing | over
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastGo, setLastGo] = useState(null);
  const [result, setResult] = useState(null);   // what the database said about the score
  const [saving, setSaving] = useState(false);

  // The three letters that go on the board. Asked for once, then remembered
  // on the profile and preloaded into every game after — which is the whole
  // point of them, so this is read from the server rather than kept in this
  // browser, where a different phone would forget it.
  const [initials, setInitials] = useState(null);
  const [naming, setNaming] = useState(false);
  const [namingErr, setNamingErr] = useState('');
  const [namingBusy, setNamingBusy] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const runningRef = useRef(null);
  const cabRef = useRef(null);
  const scoreRef = useRef(0);

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

  // The chart is loaded separately and is allowed to fail on its own. A
  // leaderboard that will not load is a shame; a leaderboard that will not
  // load and therefore stops you playing is a bug.
  const loadCharts = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('arcade_charts', { p_top: 5 });
    if (!err) {
      setCharts(data);
      if (data?.initials) setInitials(data.initials);
    }
  }, []);

  useEffect(() => { load(); loadCharts(); }, [load, loadCharts]);

  // The profile is loaded by the auth context anyway and carries the three
  // letters, so they are on screen before the chart has finished coming back
  // — which is the difference between the name being "remembered" and the
  // name appearing a second late every time.
  useEffect(() => {
    if (profile?.arcade_initials) setInitials(profile.arcade_initials);
  }, [profile?.arcade_initials]);

  const game = GAMES.find((g) => g.meta.id === picked) || GAMES[0];

  /** The best score on the board for a game — shown beside it in the menu. */
  const bestFor = useCallback((id) => {
    const rows = charts?.top?.[id];
    return rows && rows.length ? rows[0] : null;
  }, [charts]);

  const fileScore = useCallback(async (playId, finalScore, ticks, log) => {
    if (!playId) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('finish_arcade_play', {
        p_play: playId,
        p_score: Math.max(0, Math.round(finalScore) || 0),
        p_ticks: Math.max(0, Math.round(ticks) || 0),
        p_log: log || '',
      });
      if (err) throw err;
      setResult(data);
      loadCharts();

      // Only ever asked when there is a score on the board to attach it to,
      // and only when they have not already got one. Somebody who said "not
      // now" this session is left alone until they come back.
      if (data?.saved && !initials && !skipped) setNaming(true);
    } catch (e) {
      // Said out loud rather than swallowed. If the database refused the
      // score the player is owed the reason — silently dropping it would
      // leave somebody staring at a board their good go never reached,
      // with no idea why.
      setResult({ saved: false, why: describeError(e) });
    } finally {
      setSaving(false);
    }
  }, [loadCharts, initials, skipped]);

  const saveInitials = async (word) => {
    setNamingErr('');
    setNamingBusy(true);
    try {
      const { data, error: err } = await supabase.rpc('set_arcade_initials', { p_initials: word });
      if (err) throw err;
      setInitials(data.initials);
      setNaming(false);
      // The board is showing the old three letters until it is asked again.
      loadCharts();
      refreshProfile();
    } catch (e) {
      setNamingErr(describeError(e));
    } finally {
      setNamingBusy(false);
    }
  };

  const start = async () => {
    setError('');
    setResult(null);
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
      scoreRef.current = 0;
      setPhase('playing');

      // The canvas only exists once the cabinet is on screen, so the game is
      // started on the next frame rather than immediately.
      requestAnimationFrame(() => {
        if (!canvasRef.current) return;
        inputRef.current?.clear();
        runningRef.current?.stop();
        runningRef.current = runGame(canvasRef.current, game, {
          input: inputRef.current,
          seed: Number(data.seed),
          onScore: (n) => { scoreRef.current = n; setScore(n); },
          onOver: (go) => {
            setPhase('over');
            fileScore(data.play_id, scoreRef.current, go.ticks, go.log);
          },
        });
      });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  // Ending a go yourself still files the score. The alternative is that
  // quitting is a way to avoid a bad score going on your record, which turns
  // the End button into a tactic.
  const quit = () => {
    const go = runningRef.current?.snapshot?.();
    runningRef.current?.stop();
    runningRef.current = null;
    setPhase('over');
    if (go) fileScore(lastGo?.play_id, scoreRef.current, go.ticks, go.log);
  };

  const backToMenu = () => {
    runningRef.current?.stop();
    runningRef.current = null;
    setPhase('idle');
    setResult(null);
    load();
  };

  /** Picking a game from the charts loads it and takes you to the machine. */
  const pickFromCharts = (id) => {
    setPicked(id);
    if (phase !== 'playing') { setPhase('idle'); setScore(0); setResult(null); }
    if (cabRef.current) scrollToElement(cabRef.current, { offset: 12 });
  };

  if (unreachable) {
    return <CouldNotLoad what="The Arcade" onRetry={load} backTo="/" backLabel="Back to the home page" />;
  }

  const cost = status?.cost ?? 1;
  const freeLeft = status?.free_left ?? 0;
  const balance = status?.balance ?? 0;
  const canAfford = freeLeft > 0 || balance >= cost;

  const line = !user
    ? 'SIGN IN TO PLAY'
    : freeLeft > 0
      ? `FREE GO WAITING · ${balance} COINS`
      : `${cost} COIN A GO · YOU HAVE ${balance}`;

  const startLabel = busy
    ? 'STARTING…'
    : freeLeft > 0 ? 'FREE GO — PRESS START' : `INSERT ${cost} COIN`;

  return (
    <>
      <SiteHeader />

      <div className="vg-page vg-arcade">
        <div className="vg-arcade-intro">
          <h1>🕹️ THE ARCADE</h1>
          <p>
            Nine small games in one machine. Your first go each day is free —
            after that it is {cost} Vibe {cost === 1 ? 'Coin' : 'Coins'} a go, the
            same coins you earn by rating things and posting your own work.
            Nothing here can be bought with money.
          </p>
          <p className="vg-arcade-nudge">
            Push the stick up and down to choose a game on the screen, then
            press <b>START</b> — or the <b>A</b> button.
          </p>
        </div>

        <Notice tone="error">{error}</Notice>

        <div ref={cabRef}>
          <ArcadeCabinet
            screenRef={canvasRef}
            input={inputRef.current}
            marquee={phase === 'playing' ? game.meta.name : 'VIBEGROUNDS ARCADE'}
            score={score}
            status={line}
            playing={phase === 'playing'}
            onStart={phase === 'idle' && !naming && user && canAfford ? start : null}
            startLabel={startLabel}
            startDisabled={busy}
          >
            {/* Naming takes the screen over whatever else was on it. It is a
                modal moment on a real machine too — the game is over, the
                board is waiting, nothing else is happening. */}
            {naming && (
              <ArcadeInitials
                input={inputRef.current}
                username={profile?.username}
                current={initials}
                onSave={saveInitials}
                onSkip={() => { setNaming(false); setSkipped(true); }}
                saving={namingBusy}
                error={namingErr}
                madeTheBoard={Boolean(result?.saved && result.rank <= 5)}
              />
            )}

            {!naming && phase === 'idle' && (
              <ArcadeMenu
                games={GAMES}
                pickedId={picked}
                onPick={setPicked}
                onChoose={user && canAfford && !busy ? start : undefined}
                input={inputRef.current}
                bestFor={bestFor}
                active
              />
            )}

            {!naming && phase === 'over' && (
              <div className="vg-arcade-attract">
                <div className="vg-arcade-big">GAME OVER</div>
                <div className="vg-arcade-final">
                  {game.meta.name} — {score.toLocaleString()}
                  {initials && <span className="vg-arcade-tag">{initials}</span>}
                </div>

                <div className="vg-arcade-verdict">
                  {saving && <span className="vg-arcade-saving">SAVING YOUR SCORE…</span>}

                  {!saving && result?.saved && (
                    <>
                      <span className="vg-arcade-rank">
                        {result.rank === 1 ? '🥇 TOP OF THE BOARD' : `RANK ${result.rank}`}
                      </span>
                      {result.personal_best
                        ? <span className="vg-arcade-pb">NEW PERSONAL BEST</span>
                        : <span className="vg-arcade-pb is-quiet">
                            YOUR BEST: {Number(result.your_best).toLocaleString()}
                          </span>}
                    </>
                  )}

                  {!saving && result && !result.saved && (
                    <span className="vg-arcade-refused">{result.why}</span>
                  )}
                </div>

                <button type="button" className="retro-cta" onClick={backToMenu}>
                  ↩ BACK TO THE MACHINE
                </button>
              </div>
            )}
          </ArcadeCabinet>
        </div>

        {phase === 'playing' && (
          <div className="vg-arcade-quit">
            <button type="button" onClick={quit}>■ End this go</button>
            <span>
              {lastGo?.free ? 'This one was free.' : `${lastGo?.paid ?? cost} coin taken.`}
              {' '}Ending it early still saves the score.
            </span>
          </div>
        )}

        {phase === 'idle' && !user && (
          <div className="vg-arcade-signin">
            <Link to="/auth" className="retro-cta">SIGN IN TO PLAY</Link>
            <span>You can look at the scores without signing in.</span>
          </div>
        )}

        {phase === 'idle' && user && !canAfford && (
          <div className="vg-arcade-broke">
            <p>You are out of coins for today.</p>
            <p>
              Rate a few things or post something of your own — that is how
              coins are earned here. Your free go comes back tomorrow.
            </p>
            <Link to="/portal">Go and rate something →</Link>
          </div>
        )}

        {user && (
          <p className="vg-arcade-name">
            {initials
              ? <>Your name on the board is <b>{initials}</b>. </>
              : <>You have not picked your three letters yet. </>}
            <button
              type="button"
              className="vg-arcade-rename"
              onClick={() => {
                setSkipped(false);
                setNamingErr('');
                setNaming(true);
                if (phase === 'playing') quit();
                if (cabRef.current) scrollToElement(cabRef.current, { offset: 12 });
              }}
            >
              {initials ? 'Change it' : 'Pick them now'}
            </button>
          </p>
        )}

        <ArcadeCharts
          games={GAMES}
          charts={charts}
          pickedId={picked}
          onPick={pickFromCharts}
        />
      </div>
    </>
  );
}
