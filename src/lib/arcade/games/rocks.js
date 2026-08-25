/**
 * ROCKS — drift, turn, shoot, try not to fly into the debris you just made.
 *
 * Everything hangs off momentum. Thrust adds to a velocity that is only mildly
 * dragged, so the ship carries on going after you let go and the real skill is
 * turning early. A ship that stopped when you stopped pressing would be much
 * easier to fly and would not be this game at all.
 *
 * Everything also wraps at the edges, so distances have to wrap too: a rock one
 * pixel off the left edge is right beside a ship on the right edge, not a screen
 * away from it. Measuring that the plain way makes shots miss exactly where the
 * player can see they should have landed.
 */
export const meta = {
  id: 'rocks',
  name: 'ROCKS',
  blurb: 'Big ones break into small ones. That is the problem.',
  how: 'Left and right turn, up thrusts, A fires.',
};

const TURN = 3.4;                  // radians a second: a full spin in under two
const THRUST = 105, DRAG = 0.6;    // together these settle the top speed near 175px/s
const SHOT_SPEED = 235, SHOT_LIFE = 1.05, FIRE_GAP = 0.2, MAX_SHOTS = 4;
const SHIP_R = 7, ROCK_R = [6, 11, 17];   // ship, then small/medium/big rocks
const ROCK_SCORE = [100, 50, 20];  // the small fast ones are the hard ones
const CLEAR_R = 40;                // room the centre needs before the ship comes back

export function create({ width, height, input, onScore, onOver, rng }) {
  const ship = { x: width / 2, y: height / 2, vx: 0, vy: 0, a: -Math.PI / 2 };
  let rocks = [], shots = [];
  let score = 0, lives = 3, wave = 0;
  let invuln = 2, cool = 0, down = 0, gap = 0.8, thrusting = false;

  // Shortest distance across a surface that joins up at all four edges.
  function dist(ax, ay, bx, by) {
    let dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (dx > width / 2) dx = width - dx;
    if (dy > height / 2) dy = height - dy;
    return Math.hypot(dx, dy);
  }

  const wrap = (o) => { o.x = (o.x + width) % width; o.y = (o.y + height) % height; };

  function makeRock(x, y, size) {
    const dir = rng() * Math.PI * 2;
    // Chunks fly faster than what they came off, so breaking a big rock winds
    // the pace up instead of just leaving more of the same to dodge.
    const speed = (26 + wave * 5) * (1 + (2 - size) * 0.35);
    const verts = [];
    for (let i = 0; i < 9; i++) verts.push(0.7 + rng() * 0.45);
    return {
      x, y, size, verts, r: ROCK_R[size],
      vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed,
      a: rng() * Math.PI * 2, spin: (rng() - 0.5) * 1.6,
    };
  }

  function startWave() {
    wave += 1;
    for (let i = 0; i < 3 + wave; i++) {
      let x, y;
      // Never in the player's lap: a wave that opens with a rock already on
      // top of you is a life lost before you have touched the controls.
      do { x = rng() * width; y = rng() * height; }
      while (dist(x, y, ship.x, ship.y) < 75);
      rocks.push(makeRock(x, y, 2));
    }
  }

  function split(rock) {
    score += ROCK_SCORE[rock.size];
    onScore(score);
    rocks = rocks.filter((r) => r !== rock);
    if (rock.size === 0) return;   // the smallest ones simply go
    const half = rock.size - 1;
    rocks.push(makeRock(rock.x, rock.y, half), makeRock(rock.x, rock.y, half));
  }

  return {
    update(dt) {
      rocks.forEach((r) => { r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.spin * dt; wrap(r); });
      shots.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; wrap(s); });
      shots = shots.filter((s) => s.life > 0);

      for (const s of shots.slice()) {
        const hit = rocks.find((r) => dist(s.x, s.y, r.x, r.y) < r.r);
        if (hit) { shots = shots.filter((o) => o !== s); split(hit); }
      }

      if (down > 0) {
        down -= dt;
        if (down > 0) return undefined;
        // Hold the respawn until the middle is actually empty. Putting the
        // ship back inside a rock would burn all three lives in a second for
        // nothing the player did, which reads as the game cheating.
        if (rocks.some((r) => dist(width / 2, height / 2, r.x, r.y) < r.r + CLEAR_R)) {
          down = 0.15;
          return undefined;
        }
        Object.assign(ship, { x: width / 2, y: height / 2, vx: 0, vy: 0, a: -Math.PI / 2 });
        invuln = 2;
        return undefined;
      }

      if (input.held('left')) ship.a -= TURN * dt;
      if (input.held('right')) ship.a += TURN * dt;
      thrusting = input.held('up');
      if (thrusting) {
        ship.vx += Math.cos(ship.a) * THRUST * dt;
        ship.vy += Math.sin(ship.a) * THRUST * dt;
      }
      // Drag as a share of current speed, not a flat subtraction: it trims the
      // top end hard but never quite stops the ship, so the drift keeps biting.
      ship.vx -= ship.vx * DRAG * dt; ship.vy -= ship.vy * DRAG * dt;
      ship.x += ship.vx * dt; ship.y += ship.vy * dt;
      wrap(ship);

      cool -= dt;
      // A gap between shots on top of the magazine limit, or leaning on the
      // button fills the screen with lead and no aiming is needed.
      if (input.pressed('a') && cool <= 0 && shots.length < MAX_SHOTS) {
        cool = FIRE_GAP;
        const cx = Math.cos(ship.a), cy = Math.sin(ship.a);
        shots.push({
          x: ship.x + cx * 9, y: ship.y + cy * 9,
          // Bullets carry the ship's own velocity, or flying fast means
          // outrunning your shots and firing forwards stops working.
          vx: ship.vx + cx * SHOT_SPEED, vy: ship.vy + cy * SHOT_SPEED,
          life: SHOT_LIFE,
        });
      }

      if (invuln > 0) invuln -= dt;
      // Rocks are drawn dented, so their nominal radius overstates most of the
      // outline. Shave it for the ship, because dying to the empty gap between
      // two spikes is the death a player will swear they did not deserve.
      else if (rocks.some((r) => dist(ship.x, ship.y, r.x, r.y) < r.r * 0.88 + SHIP_R)) {
        lives -= 1;
        thrusting = false;
        if (lives <= 0) return onOver();
        down = 1;          // a beat to see the hit before the ship returns
      }

      if (!rocks.length) {
        // A breather between waves. Landing the last shot and being instantly
        // surrounded again reads as a punishment for clearing the screen.
        gap -= dt;
        if (gap <= 0) { startWave(); gap = 1.4; }
      }
      return undefined;
    },

    draw(ctx) {
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 1;

      // Anything straddling an edge is drawn on the far side as well, so it
      // does not blink out of existence half way through a wrap.
      const wrapped = (x, y, r, body) => {
        for (let ox = -width; ox <= width; ox += width) {
          for (let oy = -height; oy <= height; oy += height) {
            const px = x + ox, py = y + oy;
            if (px < -r || px > width + r || py < -r || py > height + r) continue;
            ctx.save(); ctx.translate(px, py); body(); ctx.restore();
          }
        }
      };

      ctx.strokeStyle = '#e8a317';
      rocks.forEach((rock) => wrapped(rock.x, rock.y, rock.r, () => {
        ctx.rotate(rock.a);
        ctx.beginPath();
        rock.verts.forEach((v, i) => {
          const t = (i / rock.verts.length) * Math.PI * 2;
          const x = Math.cos(t) * rock.r * v, y = Math.sin(t) * rock.r * v;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
      }));

      // A dart with a notched tail, drawn nose-first along its own heading.
      const hull = () => {
        ctx.beginPath();
        ctx.moveTo(9, 0); ctx.lineTo(-6, -5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 5);
        ctx.closePath(); ctx.stroke();
      };

      ctx.fillStyle = '#9fe870';
      shots.forEach((s) => ctx.fillRect(s.x - 1, s.y - 1, 2, 2));
      ctx.strokeStyle = '#9fe870';

      // Blinking is the only way to tell the player they are still safe, so it
      // is fast and plain rather than a subtle fade.
      if (down <= 0 && (invuln <= 0 || ((invuln * 8) | 0) % 2 === 0)) {
        wrapped(ship.x, ship.y, 10, () => {
          ctx.rotate(ship.a);
          hull();
          if (thrusting) {
            ctx.beginPath();
            ctx.moveTo(-4, -3); ctx.lineTo(-10, 0); ctx.lineTo(-4, 3);
            ctx.stroke();
          }
        });
      }

      // Lives in hand, nose up in the corner. The one you are flying is not one of them.
      for (let i = 0; i < lives - 1; i++) {
        ctx.save();
        ctx.translate(11 + i * 12, height - 9);
        ctx.rotate(-Math.PI / 2); ctx.scale(0.6, 0.6);
        hull();
        ctx.restore();
      }
    },
  };
}
