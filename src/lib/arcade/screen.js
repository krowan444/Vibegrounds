/**
 * The bit behind the glass.
 *
 * Every cabinet game draws into a fixed 320×240 buffer that is then scaled up
 * to whatever space the machine has. That is a real arcade screen shape, and
 * fixing it is what makes the games honest: a game written against a fixed
 * grid plays identically on a phone and a 27-inch monitor, where one written
 * against the actual pixel size would have a bigger playfield — and therefore
 * be easier — on a bigger screen.
 *
 * The scaling is done with image smoothing off, so a 2px bullet becomes a
 * crisp block rather than a grey smudge.
 *
 * TIME IS FIXED HERE, and that is a deliberate change from how this started.
 * The runner used to hand each game the real time since the last frame, which
 * plays fine and cannot ever be checked: the same player, the same seed and
 * the same button presses produce a slightly different game on a 144Hz screen
 * than on a 60Hz one, because the arithmetic lands differently. Now the world
 * advances in fixed 1/60th steps and the frame rate only decides how many
 * steps run before the next paint. Two consequences, both wanted:
 *
 *   - a fast monitor no longer very slightly changes the game
 *   - a go is a seed plus a list of (tick, button) events, so it can be run
 *     again later and the score checked
 *
 * Nothing replays a go today. This is the groundwork that makes it possible
 * to, rather than a claim that anything is verified — see the note on the
 * arcade page, which says exactly that to players.
 */
import makeRng, { looseSeed } from './rng';

export const SCREEN_W = 320;
export const SCREEN_H = 240;

export const STEP = 1 / 60;

/**
 * The most world-steps allowed in one frame. A tab left in the background
 * comes back with seconds of debt; running all of it would fast-forward the
 * player through several walls. Past this the debt is thrown away — the game
 * loses time rather than the player losing a life.
 */
const MAX_CATCHUP = 5;

/**
 * A game module looks like this:
 *
 *   export const meta = { id, name, blurb, how };
 *   export function create({ width, height, input, onScore, onOver, rng }) {
 *     return { update(dt), draw(ctx), destroy? };
 *   }
 *
 *   update(dt)  dt is always STEP — a fixed 1/60th of a second. It is still
 *               passed rather than assumed so the games read the same way.
 *   draw(ctx)   the canvas is already cleared and scaled; draw in 320×240.
 *   rng()       a number from 0 to 1, from the seed the machine was given.
 *               Games must use this and never Math.random(), or the go stops
 *               being reproducible.
 *   onScore(n)  set the number on the marquee.
 *   onOver()    end the go. Called once; calling it twice is harmless.
 */

export function runGame(canvas, gameModule, { input, onScore, onOver, seed }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const usedSeed = Number.isFinite(seed) ? seed >>> 0 : looseSeed();

  let tick = 0;
  let over = false;

  // Recording starts before the game does, so a button held down from the
  // instant of pressing START is in the log too.
  input?.record?.(() => tick);

  const finish = () => {
    if (over) return;
    over = true;
    onOver({ seed: usedSeed, ticks: tick, log: input?.recording?.() ?? '' });
  };

  const game = gameModule.create({
    width: SCREEN_W,
    height: SCREEN_H,
    input,
    onScore,
    onOver: finish,
    rng: makeRng(usedSeed),
  });

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let stopped = false;

  const frame = (now) => {
    if (stopped) return;
    // Clamped before it even reaches the accumulator. Half a second of debt
    // is already more than MAX_CATCHUP will spend.
    const elapsed = Math.min(0.5, Math.max(0, (now - last) / 1000));
    last = now;

    if (!over) {
      acc += elapsed;
      let steps = 0;
      while (acc >= STEP && steps < MAX_CATCHUP && !over) {
        game.update(STEP);
        acc -= STEP;
        tick += 1;
        steps += 1;
      }
      // Still behind after spending the whole budget: give up on the debt
      // rather than carrying it into the next frame and never catching up.
      if (steps === MAX_CATCHUP) acc = 0;
    }

    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Letterbox: keep the 4:3 shape whatever the canvas is, so nothing
    // stretches when the cabinet is narrow.
    const scale = Math.min(canvas.width / SCREEN_W, canvas.height / SCREEN_H);
    const w = SCREEN_W * scale;
    const h = SCREEN_H * scale;
    ctx.save();
    ctx.translate((canvas.width - w) / 2, (canvas.height - h) / 2);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, SCREEN_W, SCREEN_H);
    ctx.clip();
    game.draw(ctx);
    ctx.restore();

    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    /** How long the go has lasted in world time — what the score is judged against. */
    elapsed: () => tick * STEP,
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      input?.stopRecording?.();
      game.destroy?.();
    },
    /** For a go the player ended themselves rather than lost. */
    snapshot: () => ({ seed: usedSeed, ticks: tick, log: input?.recording?.() ?? '' }),
  };
}
