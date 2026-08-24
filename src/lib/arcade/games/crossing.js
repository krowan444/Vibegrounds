/**
 * CROSSING — hop the road, fill the four homes, do not get flattened.
 *
 * One press is one hop. Frogger only works if the board is honest about where
 * you are: always in exactly one lane, never halfway between two, so you are
 * never hit by a car you had already cleared.
 *
 * The whole thing is arranged around one promise — a crossing is always
 * physically possible. Traffic gets faster and the road fills up, but no lane
 * is ever built without a gap you can stand in. See minGap().
 */
export const meta = {
  id: 'crossing',
  name: 'CROSSING',
  blurb: 'Hop the traffic. Fill all four homes.',
  how: 'Arrows or WASD to hop. Land in an empty home slot at the top.',
};

const ROW = 20;        // one lane, and one forward hop
const COL = 20;        // one sideways hop
const PLAYER = 14;     // hitbox, smaller than its cell so near-misses read as misses
const DWELL = 0.55;    // seconds a person needs to spot a gap and press

const HOME_ROW = 0;
const START_ROW = 11;
const LANE_ROWS = [1, 2, 3, 4, 6, 7, 8, 9];   // eight lanes of road
const SAFE_ROWS = [0, 5, 10, 11];             // home bank, a median, and the two-deep kerb you start on
const SLOT_COLS = [1, 5, 9, 13];              // each home slot is two cells wide
const FILL_ORDER = [0, 4, 2, 6, 1, 5, 3, 7];  // order lanes get traffic, spread out on purpose
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

/*
 * The fairness rule, worked out.
 *
 * A gap is only usable if it sits over you long enough to see it and react. It
 * has to travel its own length past a PLAYER-wide body, so it covers your cell
 * for (gap - PLAYER) / speed seconds. Set that to DWELL and rearrange:
 *
 *     gap >= PLAYER + speed * DWELL   =   14 + speed * 0.55
 *
 * At the fastest traffic this game ever makes (110 px/s) that is 74px, more
 * than three hops of daylight. A gap is also never under two vehicle lengths,
 * so at least half of every lane is open road and nothing can wall you in.
 * Lanes are built once as a convoy that wraps, rather than rolling a fresh car
 * every so often, so those distances hold forever instead of on average.
 */
const minGap = (speed, carW) => Math.max(PLAYER + speed * DWELL, carW * 2);

const wrap = (v, m) => ((v % m) + m) % m;

export function create({ width, height, input, onScore, onOver }) {
  const cols = Math.floor(width / COL);

  let lanes = [];
  let homes = [false, false, false, false];
  let lives = 3;
  let level = 0;
  let score = 0;
  let col = 8;
  let row = START_ROW;
  let dead = 0;                     // counts down while the squashed player blinks

  function buildLanes() {
    const mult = Math.min(1.7, 1 + level * 0.07);
    // Half the road is empty at the start and fills in every other crossing, so
    // the step up is one new hazard at a time rather than a wall arriving at once.
    const busy = Math.min(LANE_ROWS.length, 4 + (level >> 1));
    lanes = LANE_ROWS.map((r, i) => {
      if (FILL_ORDER.indexOf(i) >= busy) return { row: r, cars: [] };
      const speed = Math.min(110, (26 + Math.random() * 44) * mult);
      const cars = [];
      let x = 0;
      // Keep laying cars until the convoy is longer than the screen, so the
      // wrap-around join is off-screen and the pattern never visibly repeats.
      while (x < width + 80) {
        const w = Math.random() < 0.25 ? 44 : 28;
        cars.push({ x, w });
        x += w + minGap(speed, w) + Math.random() * 40;
      }
      return { row: r, dir: i % 2 ? 1 : -1, speed, cars, span: x, shift: 0, pale: i % 3 === 0 };
    });
  }

  // Each car can be showing in two places at once when the convoy wraps: its
  // own position, and the tail poking back in from the other edge.
  function forEachCar(lane, fn) {
    for (const c of lane.cars) {
      const p = wrap(c.x + lane.shift * lane.dir, lane.span);
      if (p < width) fn(p, c.w);
      if (p + c.w > lane.span) fn(p - lane.span, c.w);
    }
  }

  function respawn() {
    col = 8;
    row = START_ROW;
  }

  // No auto-repeat on purpose: the whole game is picking your moment, and a key
  // you can lean on would turn that into a shove.
  function readHop() {
    for (const b in DIRS) if (input.pressed(b)) return DIRS[b];
    return null;
  }

  function reachHome(slot) {
    homes[slot] = true;
    score += 100;
    if (homes.every(Boolean)) {
      score += 300;
      homes = homes.map(() => false);
    }
    onScore(score);
    level += 1;
    buildLanes();      // safe to reshuffle here: the player is back on the bank
    respawn();
  }

  buildLanes();

  return {
    update(dt) {
      for (const l of lanes) if (l.speed) l.shift += l.speed * dt;

      // Traffic keeps rolling through the blink, so the road you come back to
      // is the road you were watching, not a frozen snapshot.
      if (dead > 0) {
        dead -= dt;
        // Throw away presses made during the blink. Mashing keys after a hit is
        // reflex, and it should not fling you into traffic the moment you land.
        readHop();
        if (dead <= 0) respawn();
        return;
      }

      const d = readHop();
      if (d) {
        const nc = Math.max(0, Math.min(cols - 1, col + d[0]));
        const nr = Math.max(HOME_ROW, Math.min(START_ROW, row + d[1]));
        if (nr === HOME_ROW) {
          const slot = SLOT_COLS.findIndex((s) => nc === s || nc === s + 1);
          // The bank between slots simply refuses the hop. A wall you can see
          // should stop you, not kill you.
          if (slot >= 0 && !homes[slot]) reachHome(slot);
        } else {
          col = nc;
          row = nr;
        }
      }

      const lane = lanes.find((l) => l.row === row);
      if (!lane) return;
      const px = col * COL + (COL - PLAYER) / 2;
      let struck = false;
      forEachCar(lane, (x, w) => {
        if (x < px + PLAYER && x + w > px) struck = true;
      });
      if (!struck) return;

      lives -= 1;
      if (lives <= 0) onOver();
      else dead = 0.7;
    },

    draw(ctx) {
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#2b3b4a';
      SAFE_ROWS.forEach((r) => ctx.fillRect(0, r * ROW, width, ROW));

      SLOT_COLS.forEach((s, i) => {
        ctx.fillStyle = homes[i] ? '#9fe870' : '#0b0f14';
        ctx.fillRect(s * COL + 2, 3, COL * 2 - 4, ROW - 6);
      });

      lanes.forEach((l) => {
        ctx.fillStyle = l.pale ? '#dfe6ee' : '#e8a317';
        forEachCar(l, (x, w) => ctx.fillRect(x, l.row * ROW + 3, w, ROW - 6));
      });

      ctx.fillStyle = '#9fe870';
      for (let i = 0; i < lives - 1; i++) ctx.fillRect(4 + i * 7, height - 7, 5, 4);

      // Blink on the spot where it happened, so you can see what got you.
      if (dead <= 0 || ((dead * 10) | 0) % 2 === 0) {
        ctx.fillStyle = dead > 0 ? '#e8a317' : '#9fe870';
        ctx.fillRect(col * COL + 3, row * ROW + 3, PLAYER, PLAYER);
      }
    },
  };
}
