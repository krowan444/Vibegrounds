import { Link } from 'react-router-dom';

/**
 * The high score tables, under the machine.
 *
 * Aaron asked for this on the forum and Kieran asked for it to sit below the
 * games, one little chart per game, like the Portal charts. That shape is
 * right for a reason beyond consistency: nine separate tables of five names
 * gives forty-five people somewhere to be, where one combined table would
 * give five. On a site this size that is the difference between a chart being
 * something you might get on and something you look at once.
 *
 * A game nobody has played yet still gets its card, saying so. Hiding empty
 * games would make the arcade look smaller than it is and would quietly
 * punish the games nobody has found yet.
 */

const MEDAL = ['🥇', '🥈', '🥉'];

function Row({ row, fresh }) {
  return (
    <li className={`vg-hs-row ${row.you ? 'is-you' : ''} ${fresh ? 'is-fresh' : ''}`}>
      <span className="vg-hs-rank">
        {MEDAL[row.rank - 1] || String(row.rank).padStart(2, '0')}
      </span>

      {/* Only on the go just finished, and only until you go back to the
          machine — the result this comes from is cleared then. A badge that
          stayed would stop meaning "this just happened" by the second look. */}
      {fresh && <span className="vg-hs-new">NEW</span>}

      {/* The three letters, the way a real board shows them. Somebody who has
          not chosen yet gets the front of their username instead — dimmed,
          because it is a stand-in rather than something they picked, and a
          blank space on a high score table looks like a fault. */}
      <span className={`vg-hs-ini ${row.named ? '' : 'is-auto'}`}>
        {row.initials || '---'}
      </span>

      {/* And the username too. On a real machine three letters is all you get
          and half the board is a mystery; here the whole point is that these
          are people you can go and find, so the name stays and it links. */}
      <Link className="vg-hs-name" to={`/profile/${row.username}`}>
        {row.avatar
          ? <img className="vg-hs-face" src={row.avatar} alt="" loading="lazy" />
          : null}
        {row.username}
      </Link>

      <span className="vg-hs-score">{row.score.toLocaleString()}</span>
    </li>
  );
}

export default function ArcadeCharts({ games, charts, onPick, pickedId, justSet }) {
  const top = charts?.top || {};
  const you = charts?.you || {};

  return (
    <section className="vg-hs">
      <div className="section-header">
        <h2>🏆 HIGH SCORES</h2>
      </div>

      <div className="vg-hs-grid">
        {games.map((g) => {
          const rows = top[g.meta.id] || [];
          const mine = you[g.meta.id];
          return (
            <div
              key={g.meta.id}
              className={`vg-hs-card ${g.meta.id === pickedId ? 'is-on' : ''}`}
            >
              <div className="vg-hs-card-head">
                <h3>{g.meta.name}</h3>
                {/* Loading the game into the machine from its own chart is the
                    obvious thing to want after reading a score you fancy
                    beating, and it saves scrolling back up to the stick. */}
                <button type="button" className="vg-hs-play" onClick={() => onPick(g.meta.id)}>
                  PLAY ▸
                </button>
              </div>

              {rows.length === 0 ? (
                <p className="vg-hs-empty">
                  Nobody has posted a score yet. First one on the board owns it.
                </p>
              ) : (
                <ol className="vg-hs-list">
                  {rows.map((r) => (
                    <Row
                      key={r.user_id}
                      row={r}
                      // Matched on the rank as well as on it being you: play
                      // the same game twice without beating yourself and the
                      // board does not move, so flashing NEW at an unchanged
                      // row would be claiming something that did not happen.
                      fresh={!!justSet
                        && justSet.game === g.meta.id
                        && justSet.rank === r.rank
                        && r.you}
                    />
                  ))}
                </ol>
              )}

              {/* Only worth saying when they are not already visible above —
                  telling somebody they are 2nd directly under a table showing
                  them at 2nd is noise. */}
              {mine && !rows.some((r) => r.you) && (
                <p className="vg-hs-mine">
                  You: <b>{mine.score.toLocaleString()}</b> · {ordinal(mine.rank)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="vg-hs-honest">
        <h4>How these are checked</h4>
        <p>
          A score can only be saved against a go that was paid for, one score
          per go, and it has to be possible — every game has a ceiling and a
          top speed, and the length of a go is checked against the clock. So
          nobody can type a number in and land on the board.
        </p>
        <p>
          What it does <b>not</b> do yet: every go is recorded — the seed the
          machine used and the buttons pressed — but nothing plays those
          recordings back to prove a score exactly. Somebody determined enough
          could still work out something unusual that gets through. The
          recordings are kept from day one so that check can be written later
          and run over everything already on the board, rather than starting
          from scratch.
        </p>
        <p className="vg-hs-ask">
          If a score of yours was refused for being too high, it means the
          limit is set too low — that is a guess and guesses are wrong
          sometimes. <Link to="/community">Say so on the forum</Link> and it gets
          raised.
        </p>
      </div>
    </section>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
