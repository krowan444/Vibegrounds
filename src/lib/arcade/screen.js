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
 */
export const SCREEN_W = 320;
export const SCREEN_H = 240;

/**
 * A game module looks like this:
 *
 *   export const meta = { id, name, blurb, how };
 *   export function create({ width, height, input, onScore, onOver }) {
 *     return { update(dt), draw(ctx), destroy? };
 *   }
 *
 *   update(dt)  dt is seconds since the last frame, already clamped so that
 *               a backgrounded tab cannot teleport the player through a wall.
 *   draw(ctx)   the canvas is already cleared and scaled; draw in 320×240.
 *   onScore(n)  set the number on the marquee.
 *   onOver()    end the go. Called once; calling it twice is harmless.
 */

export function runGame(canvas, gameModule, { input, onScore, onOver }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  let over = false;
  const finish = () => {
    if (over) return;
    over = true;
    onOver();
  };

  const game = gameModule.create({
    width: SCREEN_W,
    height: SCREEN_H,
    input,
    onScore,
    onOver: finish,
  });

  let raf = 0;
  let last = performance.now();
  let stopped = false;

  const frame = (now) => {
    if (stopped) return;
    // Clamped hard. Switch tabs for thirty seconds and an unclamped dt would
    // advance the world thirty seconds in one step — through every wall.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (!over) game.update(dt);

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
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      game.destroy?.();
    },
  };
}
