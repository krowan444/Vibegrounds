/**
 * JUMPER — a one-button endless runner.
 *
 * The whole game is the length of one button press: a stab clears the low
 * blocks, holding through the rise clears the tall ones, and judging which is
 * needed under shrinking reaction time is the skill.
 *
 * NO DOUBLE JUMP, deliberately. A second jump in mid-air rescues a badly
 * judged press, and once a bad press costs nothing the hold length stops
 * mattering — which throws away the only decision the game has.
 */
export const meta = {
  id: 'jumper',
  name: 'JUMPER',
  blurb: 'One button. Do not trip.',
  how: 'Tap A or up to hop. Hold it down to clear the tall ones.',
};

const GROUND_Y = 186;
const PLAYER_X = 52;
const PLAYER_W = 12;
const PLAYER_H = 16;

/**
 * Take-off is gentle and the button buys extra lift on the way up, rather than
 * the usual trick of launching hard and clipping the speed on release.
 * Clipping cannot actually produce a small hop: at a launch speed high enough
 * for the tall blocks, even a two-frame stab has risen 12px before the game
 * can react, so every jump ends within a few pixels of full height and the
 * hold means nothing. Weak gravity while held separates them: 22px vs 49px.
 */
const JUMP_V = 250;            // upward speed at take-off
const LIFT_GRAVITY = 620;      // while rising with the button still down
const GRAVITY = 1500;          // falling, or rising after an early release

const RISE_T = JUMP_V / LIFT_GRAVITY;                       // 0.403s to the top
const APEX = (JUMP_V * JUMP_V) / (2 * LIFT_GRAVITY);        // 50px at the top
const AIRTIME = RISE_T + Math.sqrt((2 * APEX) / GRAVITY);   // 0.662s aloft

const SPEED_MIN = 110;
const SPEED_MAX = 220;

const OB_W_MIN = 9;
const OB_W_MAX = 24;
const OB_H_MIN = 10;           // a stab clears these
const OB_H_MAX = 34;           // these want most of the hold

/**
 * THE UNWINNABLE-GAP PROBLEM, settled with arithmetic.
 *
 * GAPS are measured in TIME, not pixels: the space after each obstacle is at
 * least one whole 0.662s jump arc plus GAP_SLACK of flat ground, so the player
 * can land, stand still for a fifth of a second, and still take off for the
 * next one. At the 220px/s cap that is a 213px minimum — about 0.97s between
 * hurdles, the tightest the game ever gets. Difficulty comes from how briefly
 * an obstacle is on screen, not from gaps closing up. SPEED_MARGIN pads the
 * sum, because a gap is frozen in pixels when it spawns while the speed that
 * has to cross it keeps climbing.
 *
 * WIDTH is the other half, and the trap is that the binding case is the
 * SLOWEST speed, not the fastest: a jump holds you above a given height for a
 * fixed number of SECONDS, so crawling along at the opening pace covers the
 * fewest pixels in that window. A full-width full-height block is comfortable
 * at 220px/s and near impossible at 110. clearWindow() prices that in.
 */
const GAP_SLACK = 0.22;
const GAP_RANDOM = 0.55;
const SPEED_MARGIN = 1.1;

export function create({ width, height, input, onScore, onOver }) {
  let speed = SPEED_MIN;
  let dist = 0;
  let score = 0;

  let y = GROUND_Y - PLAYER_H;
  let vy = 0;
  let grounded = true;
  let lifting = false;     // still holding, still going up
  let buffer = 0;          // a press just before touchdown still counts
  let runPhase = 0;
  let groundScroll = 0;

  const obstacles = [];
  let gapLeft = 200;       // a beat of empty runway before the first hurdle

  // Distant marks, drifting slower than the ground so the world has depth.
  const newMark = (x) => ({ x, w: 10 + ((Math.random() * 26) | 0), h: 6 + ((Math.random() * 18) | 0) });
  const marks = [];
  for (let i = 0; i < 7; i++) marks.push(newMark(i * 52));

  // Seconds a full jump keeps the player's feet above height h.
  function clearWindow(h) {
    const up = (JUMP_V - Math.sqrt(JUMP_V * JUMP_V - 2 * LIFT_GRAVITY * h)) / LIFT_GRAVITY;
    return RISE_T + Math.sqrt((2 * (APEX - h)) / GRAVITY) - up;
  }

  function spawn() {
    const h = OB_H_MIN + Math.random() * (OB_H_MAX - OB_H_MIN);
    // Crossing takes (w + player) / speed seconds and must fit the window the
    // jump buys. Using only half of it leaves the rest as slack for imperfect
    // timing, which is what keeps wide blocks fair rather than frame-perfect.
    // Early on that holds tall blocks to a sliver; they get chunky once the
    // speed can carry the player across. Floored to whole pixels so the block
    // being judged by eye is exactly the block collided with, and never bigger
    // than the sum above signed off on.
    const room = speed * clearWindow(h) * 0.5 - PLAYER_W;
    const w = OB_W_MIN + Math.random() * Math.max(0, Math.min(OB_W_MAX, room) - OB_W_MIN);
    obstacles.push({ x: width + 4, w: Math.floor(w), h: Math.floor(h) });
    gapLeft = w + speed * SPEED_MARGIN * (AIRTIME + GAP_SLACK + Math.random() * GAP_RANDOM);
  }

  return {
    update(dt) {
      const jumpDown = input.held('a') || input.held('up');
      if (input.pressed('a') || input.pressed('up')) buffer = 0.12;
      buffer = Math.max(0, buffer - dt);

      if (grounded && buffer > 0) {
        vy = -JUMP_V;
        grounded = false;
        lifting = true;
        buffer = 0;
      }
      // Letting go ends the lift for the rest of the jump. Pressing again in
      // mid-air must not restart it, or the player could feather the button to
      // hang in the air and the hold would stop being a commitment.
      if (!jumpDown || vy >= 0) lifting = false;

      if (!grounded) {
        vy += (lifting ? LIFT_GRAVITY : GRAVITY) * dt;
        y += vy * dt;
        if (y >= GROUND_Y - PLAYER_H) {
          y = GROUND_Y - PLAYER_H;
          vy = 0;
          grounded = true;
        }
      }

      dist += speed * dt;
      speed = Math.min(SPEED_MAX, SPEED_MIN + dist / 40);
      groundScroll = (groundScroll + speed * dt) % 24;
      runPhase += dt * speed * 0.15;   // strides quicken with the pace

      const next = Math.floor(dist / 10);
      if (next !== score) onScore((score = next));

      gapLeft -= speed * dt;
      if (gapLeft <= 0) spawn();

      for (const m of marks) {
        m.x -= speed * 0.35 * dt;
        if (m.x + m.w < 0) Object.assign(m, newMark(width + Math.random() * 60));
      }

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= speed * dt;
        if (o.x + o.w < -8) { obstacles.splice(i, 1); continue; }
        // Inset 2px all round. A pixel of overlap the player cannot see reads
        // as the game cheating, so give them the benefit of it.
        if (PLAYER_X + PLAYER_W - 2 > o.x + 2 && PLAYER_X + 2 < o.x + o.w - 2
            && y + PLAYER_H - 2 > GROUND_Y - o.h + 2) return onOver();
      }
      return undefined;
    },

    draw(ctx) {
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, width, height);

      // Math.floor, not | 0, on anything scrolling: these values go negative on
      // the way out, and | 0 truncates towards zero, which makes the leftmost
      // item stutter by a pixel exactly as it crosses the edge.
      ctx.fillStyle = '#1c2b33';
      for (const m of marks) ctx.fillRect(Math.floor(m.x), GROUND_Y - m.h, m.w, m.h);

      ctx.fillStyle = '#4c9a3f';
      ctx.fillRect(0, GROUND_Y, width, 2);
      for (let x = -groundScroll; x < width; x += 24) ctx.fillRect(Math.floor(x), GROUND_Y + 6, 10, 2);

      ctx.fillStyle = '#e8a317';
      for (const o of obstacles) ctx.fillRect(Math.floor(o.x), GROUND_Y - o.h, o.w, o.h);

      // Legs split apart on the ground and tuck together in the air, which is
      // enough to tell a run from a jump at this size.
      const py = Math.floor(y);
      const stride = grounded && Math.sin(runPhase) > 0 ? 2 : -2;
      ctx.fillStyle = '#9fe870';
      ctx.fillRect(PLAYER_X, py, PLAYER_W, PLAYER_H - 4);
      ctx.fillRect(PLAYER_X + 2 - stride, py + PLAYER_H - 4, 3, 4);
      ctx.fillRect(PLAYER_X + 7 + stride, py + PLAYER_H - 4, 3, 4);
    },
  };
}
