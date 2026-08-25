/**
 * BREAKOUT — knock the wall down without dropping the ball.
 *
 * Everything interesting happens on the paddle. The ball leaves at an angle
 * set by where it landed, so a good player is not reacting to the ball, they
 * are catching it on a chosen spot to send it where the bricks still are.
 * That is why the bounce below ignores the incoming angle completely — a
 * mirror bounce would take the aiming away.
 */
export const meta = {
  id: 'breakout',
  name: 'BREAKOUT',
  blurb: 'Knock the wall down, keep the ball up.',
  how: 'Left and right to move. A to launch the ball.',
};

const PADDLE_W = 40, PADDLE_H = 5, PADDLE_Y = 222, PADDLE_SPEED = 170;
const BALL = 4;
const ROWS = 5, COLS = 10, WALL_X = 10, WALL_Y = 28;
const BRICK_W = 30, BRICK_H = 10;   // the cell pitch, not the drawn size
const ROW_COLOUR = ['#e2564f', '#e8a317', '#9fe870', '#4bb8d8', '#8f7fd8'];
const MAX_HOP = 3;                  // px of ball travel resolved in one go

export function create({ width, height, input, onScore, onOver, rng }) {
  const bricks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // The back rows are the awkward ones to reach, so they pay more.
      bricks.push({
        x: WALL_X + c * BRICK_W, y: WALL_Y + r * BRICK_H,
        colour: ROW_COLOUR[r], points: (ROWS - r) * 10,
      });
    }
  }

  let remaining = bricks.length;
  let px = (width - PADDLE_W) / 2;   // paddle left edge
  let bx = 0, by = 0, vx = 0, vy = 0;
  let stuck = true;                  // ball is sitting on the paddle, waiting
  let lives = 3, score = 0, speed = 150;

  function launch() {
    stuck = false;
    // Never straight up: a vertical launch just bounces back down the same
    // column and the first go looks broken rather than lucky.
    const angle = (rng() < 0.5 ? -1 : 1) * 0.5;
    vx = Math.sin(angle) * speed;
    vy = -Math.cos(angle) * speed;
  }

  function bounce() {
    // Middle of the paddle sends it straight up, the ends fan out to about 60
    // degrees. Speed is re-applied from scratch here, which is also how the
    // gradual speed-up reaches the ball — mid-flight it would feel like a jolt.
    const off = ((bx + BALL / 2) - (px + PADDLE_W / 2)) / (PADDLE_W / 2);
    const angle = Math.max(-1, Math.min(1, off)) * 1.05;
    vx = Math.sin(angle) * speed;
    vy = -Math.cos(angle) * speed;
  }

  // Bricks are tested at full cell size even though they are drawn 2px smaller.
  // The gaps are decoration; if they were real the ball could slip into the
  // mortar between two bricks and rattle there.
  function brickAt() {
    if (by + BALL < WALL_Y || by > WALL_Y + ROWS * BRICK_H) return -1;
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (!b) continue;
      if (bx + BALL > b.x && bx < b.x + BRICK_W &&
          by + BALL > b.y && by < b.y + BRICK_H) return i;
    }
    return -1;
  }

  // Called immediately after moving along one axis, so the axis just moved is
  // the axis that caused the overlap. That is the whole trick: the ball comes
  // off the side of a brick sideways and off the top of one upwards, and
  // nobody has to guess which face it met.
  function smash(axis, dir) {
    const i = brickAt();
    if (i < 0) return;
    const b = bricks[i];
    bricks[i] = null;
    remaining--;
    score += b.points;
    onScore(score);
    speed = Math.min(280, speed + 2);
    // Sit the ball flush against the face it hit before turning it around, so
    // the next hop starts outside the wall and cannot chew a second brick out
    // of the same row on its way past.
    if (axis === 'x') {
      bx = dir > 0 ? b.x - BALL : b.x + BRICK_W;
      vx = -vx;
    } else {
      by = dir > 0 ? b.y - BALL : b.y + BRICK_H;
      vy = -vy;
    }
  }

  function loseLife() {
    lives--;
    if (lives <= 0) return onOver();
    stuck = true;
    return undefined;
  }

  return {
    update(dt) {
      if (input.held('left')) px -= PADDLE_SPEED * dt;
      if (input.held('right')) px += PADDLE_SPEED * dt;
      px = Math.max(0, Math.min(width - PADDLE_W, px));

      if (stuck) {
        bx = px + PADDLE_W / 2 - BALL / 2;
        by = PADDLE_Y - BALL;
        if (input.pressed('a')) launch();
        return;
      }

      // Walk the ball in short hops rather than one jump. A whole frame at top
      // speed carries it further than a brick is tall, and a ball that lands
      // beyond a brick was never inside it — it sails through untouched.
      const hops = Math.max(1, Math.ceil(Math.hypot(vx, vy) * dt / MAX_HOP));
      const hdt = dt / hops;

      for (let h = 0; h < hops; h++) {
        const travelX = vx;
        bx += vx * hdt;
        if (bx < 0) { bx = 0; vx = -vx; }
        if (bx + BALL > width) { bx = width - BALL; vx = -vx; }
        smash('x', travelX);

        const travelY = vy;
        by += vy * hdt;
        if (by < 0) { by = 0; vy = -vy; }
        smash('y', travelY);

        // Only catch a ball on its way down. Clip the paddle's edge while
        // rising and a two-way test would trap it, flipping every hop.
        if (vy > 0 && by + BALL >= PADDLE_Y && by < PADDLE_Y + PADDLE_H &&
            bx + BALL > px && bx < px + PADDLE_W) {
          by = PADDLE_Y - BALL;
          bounce();
        }

        if (by > height) return loseLife();
        if (remaining === 0) return onOver();
      }
      return undefined;
    },

    draw(ctx) {
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, width, height);

      for (const b of bricks) {
        if (!b) continue;
        ctx.fillStyle = b.colour;
        ctx.fillRect(b.x + 1, b.y + 1, BRICK_W - 2, BRICK_H - 2);
      }

      ctx.fillStyle = '#9fe870';
      ctx.fillRect(px, PADDLE_Y, PADDLE_W, PADDLE_H);

      ctx.fillStyle = '#e6edf3';
      ctx.fillRect(bx, by, BALL, BALL);

      // Lives as little spare paddles, down in the corner the ball never
      // survives long enough to reach.
      ctx.fillStyle = '#4c9a3f';
      for (let i = 0; i < lives; i++) ctx.fillRect(4 + i * 10, 233, 7, 3);
    },
  };
}
