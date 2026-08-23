/**
 * PONG — first to five against the machine.
 *
 * Two decisions carry the whole game. The first is that the return angle comes
 * from how far off the middle of the bat the ball was struck, so lining up the
 * edge fires it into a corner the computer cannot reach in time — without that,
 * both sides bat the same angle back and forth and nobody is really playing.
 *
 * The second is that the computer is deliberately imperfect: capped speed, and
 * an aim a little off the true ball position. A bat that simply matches the
 * ball's y is unbeatable, and an unbeatable opponent is not an opponent.
 */
export const meta = {
  id: 'pong',
  name: 'PONG',
  blurb: 'First to five. The machine is quick, not perfect.',
  how: 'Move your bat with W/S or up and down.',
};

const PAD_W = 4;
const PAD_H = 34;
const BALL_R = 2;
const PLAYER_SPEED = 185;
const CPU_SPEED = 130;        // under the ball's top speed, so it can be beaten
const BALL_MIN = 145;
const BALL_MAX = 280;
const MAX_ANGLE = Math.PI / 3; // 60° off horizontal keeps some forward pace
const WIN = 5;

export function create({ width, height, input, onScore, onOver }) {
  const leftX = 12;
  const rightX = width - 12 - PAD_W;

  let playerY = (height - PAD_H) / 2;
  let cpuY = playerY;
  let playerPts = 0, cpuPts = 0;
  let ballX = 0, ballY = 0, vx = 0, vy = 0;
  let serveIn = 0;             // frozen pause after a point, in seconds
  let aim = 0;                 // how far off centre the computer is aiming

  function serve(towards) {
    ballX = width / 2;
    ballY = height / 2;
    // Serve shallow and always sideways, so a serve can never dribble
    // vertically down the centre line and stall the rally.
    const angle = (Math.random() - 0.5) * (MAX_ANGLE / 2);
    vx = Math.cos(angle) * BALL_MIN * towards;
    vy = Math.sin(angle) * BALL_MIN;
    serveIn = 0.8;
    reaim();
  }

  // A fresh error each time the ball turns around rather than a wobble every
  // frame: the computer commits to a slightly wrong spot and lives with it,
  // which reads as a misjudgement instead of a shaking bat.
  function reaim() {
    aim = (Math.random() - 0.5) * PAD_H * 0.85;
  }

  function bounce(padY, dir, hitY) {
    const rel = Math.max(-1, Math.min(1, (hitY - (padY + PAD_H / 2)) / (PAD_H / 2)));
    const angle = rel * MAX_ANGLE;
    const speed = Math.min(BALL_MAX, Math.hypot(vx, vy) + 11);
    vx = Math.cos(angle) * speed * dir;
    vy = Math.sin(angle) * speed;
    reaim();
  }

  function point(toPlayer) {
    if (toPlayer) {
      playerPts += 1;
      onScore(playerPts);
    } else {
      cpuPts += 1;
    }
    // A win ends the go just as a loss does — the score stands either way.
    if (playerPts >= WIN || cpuPts >= WIN) return onOver();
    return serve(toPlayer ? 1 : -1);   // the side that conceded receives
  }

  serve(Math.random() < 0.5 ? -1 : 1);

  return {
    update(dt) {
      if (input.held('up')) playerY -= PLAYER_SPEED * dt;
      if (input.held('down')) playerY += PLAYER_SPEED * dt;
      playerY = Math.max(0, Math.min(height - PAD_H, playerY));

      // The computer only chases while the ball is coming at it, and otherwise
      // eases back to the middle — how a person plays, and what leaves the
      // player room to place a shot.
      const target = vx > 0 ? ballY + aim : height / 2;
      const want = Math.max(0, Math.min(height - PAD_H, target - PAD_H / 2));
      const step = CPU_SPEED * dt;
      cpuY += Math.max(-step, Math.min(step, want - cpuY));

      if (serveIn > 0) { serveIn -= dt; return undefined; }

      const prevX = ballX;
      const prevY = ballY;
      ballX += vx * dt;
      ballY += vy * dt;

      // Push the ball clear of the wall and force the sign rather than flipping
      // it, or a ball sitting exactly on the edge flips every frame and buzzes
      // along the rail instead of bouncing off it.
      if (ballY - BALL_R < 0) { ballY = BALL_R; vy = Math.abs(vy); }
      else if (ballY + BALL_R > height) { ballY = height - BALL_R; vy = -Math.abs(vy); }

      // Test the crossing of the bat's face, not overlap with its box: at full
      // speed the ball travels further in one frame than the bat is thick, so
      // an overlap test would let it pass clean through — or trap it inside.
      const goingLeft = vx < 0;
      const face = goingLeft ? leftX + PAD_W : rightX;
      const before = goingLeft ? prevX - BALL_R : prevX + BALL_R;
      const after = goingLeft ? ballX - BALL_R : ballX + BALL_R;
      const crossed = goingLeft ? before >= face && after <= face : before <= face && after >= face;

      if (crossed) {
        const t = (face - before) / (after - before);
        const hitY = prevY + (ballY - prevY) * t;
        const padY = goingLeft ? playerY : cpuY;
        if (hitY >= padY - BALL_R && hitY <= padY + PAD_H + BALL_R) {
          ballY = hitY;
          ballX = goingLeft ? face + BALL_R : face - BALL_R;
          bounce(padY, goingLeft ? 1 : -1, hitY);
          return undefined;
        }
      }

      if (ballX + BALL_R < 0) return point(false);
      if (ballX - BALL_R > width) return point(true);
      return undefined;
    },

    draw(ctx) {
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#2a3540';
      for (let y = 4; y < height; y += 12) ctx.fillRect(width / 2 - 1, y, 2, 7);

      ctx.fillStyle = '#e8a317';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(playerPts), width / 2 - 28, 24);
      ctx.fillText(String(cpuPts), width / 2 + 28, 24);

      ctx.fillStyle = '#9fe870';
      ctx.fillRect(leftX, playerY, PAD_W, PAD_H);
      ctx.fillStyle = '#e8a317';
      ctx.fillRect(rightX, cpuY, PAD_W, PAD_H);
      ctx.fillRect(ballX - BALL_R, ballY - BALL_R, BALL_R * 2, BALL_R * 2);
    },
  };
}
