/**
 * INVADERS — the block marches, you thin it out, it comes at you faster.
 *
 * The aliens hop on a timer rather than sliding smoothly, because the pause
 * between hops is the window you have to line up a shot, and watching that
 * window shorten is the whole tension. So the rate is tied to how many are
 * left: killing them is what winds the pressure up, and the last one alive
 * is genuinely hard to catch.
 */
export const meta = {
  id: 'invaders',
  name: 'INVADERS',
  blurb: 'They only get faster.',
  how: 'Move with the arrows, fire with A.',
};

const COLS = 6, ROWS = 4;
const AW = 14, AH = 10;          // alien size
const SX = 22, SY = 16;          // spacing between alien slots
const MARCH_X = 6, DROP = 9;     // one hop sideways, one hop down
const PW = 16, PH = 8;           // player ship
const MAX_BULLETS = 2;           // small magazine, so it is about timing

export function create({ width, height, input, onScore, onOver, rng }) {
  const py = height - 18;
  let px = width / 2 - PW / 2;
  let grid, ox, oy, dir, bullets, bombs;
  let march = 0, bombTimer = 1.2, lives = 3, score = 0, wave = 0, hitPause = 0;

  function newWave() {
    grid = [];
    for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(true));
    ox = (width - (COLS - 1) * SX - AW) / 2;
    // Later waves also start lower. Speed on its own only makes the block
    // twitchier; starting it closer is what actually shortens the fight.
    oy = 22 + wave * 6;
    dir = 1;
    bullets = [];
    bombs = [];
  }
  newWave();

  const alive = () => grid.reduce((n, row) => n + row.filter(Boolean).length, 0);
  const ax = (c) => ox + c * SX;
  const ay = (r) => oy + r * SY;
  const hit = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function stepBlock() {
    let left = width, right = 0;
    for (let c = 0; c < COLS; c++) {
      if (!grid.some((row) => row[c])) continue;   // empty columns are not edges
      left = Math.min(left, ax(c));
      right = Math.max(right, ax(c) + AW);
    }
    // Turning is a hop of its own: the block drops instead of moving sideways,
    // so it never ends up overlapping the wall. Sliding into the edge first
    // and reversing after would leave it overlapping, it would flip again on
    // the next hop, and it would jitter on the spot forever.
    if (right + MARCH_X * dir > width - 4 || left + MARCH_X * dir < 4) {
      dir = -dir;
      oy += DROP;
    } else {
      ox += MARCH_X * dir;
    }
  }

  function dropBomb() {
    const front = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 0; r--) {
        // Only the alien at the front of its column fires, or the bomb looks
        // like it is passing straight through its own friends.
        if (grid[r][c]) { front.push({ c, r }); break; }
      }
    }
    if (!front.length) return;
    const p = front[(rng() * front.length) | 0];
    bombs.push({ x: ax(p.c) + AW / 2 - 1, y: ay(p.r) + AH, w: 2, h: 5 });
  }

  function loseLife() {
    lives -= 1;
    if (lives <= 0) return onOver();
    bombs = [];
    bullets = [];
    px = width / 2 - PW / 2;
    hitPause = 0.7;   // a beat to see what happened before control comes back
    return undefined;
  }

  return {
    update(dt) {
      if (hitPause > 0) { hitPause -= dt; return undefined; }

      if (input.held('left')) px -= 105 * dt;
      if (input.held('right')) px += 105 * dt;
      px = Math.max(4, Math.min(width - 4 - PW, px));

      // pressed, not held: leaning on the button must not drain the magazine.
      if (input.pressed('a') && bullets.length < MAX_BULLETS) {
        bullets.push({ x: px + PW / 2 - 1, y: py - 4, w: 2, h: 5 });
      }
      bullets.forEach((b) => { b.y -= 210 * dt; });
      bullets = bullets.filter((b) => b.y + b.h > 0);

      march += dt;
      // A full block hops lazily, the last alien scurries. The ratio of what
      // is left to what started does all the work.
      const pace = Math.max(0.05, (0.34 - wave * 0.05) * (alive() / (COLS * ROWS)));
      if (march >= pace) { march -= pace; stepBlock(); }

      bombTimer -= dt;
      if (bombTimer <= 0) {
        dropBomb();
        bombTimer = 0.5 + rng() * (1.4 - Math.min(0.9, wave * 0.2));
      }
      bombs.forEach((b) => { b.y += 95 * dt; });
      bombs = bombs.filter((b) => b.y < height);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!grid[r][c]) continue;
          const box = { x: ax(c), y: ay(r), w: AW, h: AH };
          if (box.y + AH >= py) return onOver();   // they have walked into your row
          const shot = bullets.find((b) => hit(b, box));
          if (!shot) continue;
          grid[r][c] = false;
          bullets = bullets.filter((b) => b !== shot);
          score += (ROWS - r) * 10;   // back rows are the safe ones, so they pay less
          onScore(score);
        }
      }

      if (bombs.some((b) => hit(b, { x: px, y: py, w: PW, h: PH }))) return loseLife();

      if (alive() === 0) {
        // A new wave rather than a win screen: a go should end because you ran
        // out of lives, not because you were doing well.
        wave += 1;
        newWave();
      }
      return undefined;
    },

    draw(ctx) {
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#e8a317';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!grid[r][c]) continue;
          const x = ax(c), y = ay(r);
          ctx.fillRect(x, y + 2, AW, AH - 4);        // squat cross with legs:
          ctx.fillRect(x + 2, y, AW - 4, AH);        // enough to read as a bug
          ctx.fillRect(x, y + AH - 1, 3, 2);
          ctx.fillRect(x + AW - 3, y + AH - 1, 3, 2);
        }
      }
      bombs.forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));

      ctx.fillStyle = '#9fe870';
      // Flash the ship through the pause so a lost life is visible, not just felt.
      if (hitPause <= 0 || ((hitPause * 10) | 0) % 2 === 0) {
        ctx.fillRect(px, py + 3, PW, PH - 3);
        ctx.fillRect(px + PW / 2 - 2, py, 4, 4);     // the gun barrel
      }
      bullets.forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));

      // Lives in hand as little ships, tucked in the corner out of the way of
      // the shooting. The one you are flying is not among them.
      for (let i = 0; i < lives - 1; i++) ctx.fillRect(6 + i * 12, height - 7, 8, 4);
    },
  };
}
