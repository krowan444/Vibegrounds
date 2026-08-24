/**
 * REPEAT — the machine plays a tune on four panels, you play it back.
 *
 * The panels sit in a cross, one per joystick direction, because on this
 * cabinet the stick already IS four buttons — and that layout is the whole
 * instruction manual: top panel means up, so nothing needs labelling.
 *
 * Everything else here is timing. The constants below ARE the game — the dark
 * gap between flashes above all, since it is the only thing stopping two goes
 * at the same panel from looking like one long light.
 */
export const meta = {
  id: 'repeat',
  name: 'REPEAT',
  blurb: 'Watch the lights. Play them back.',
  how: 'Watch the panels flash, then play the order back on WASD or the arrows.',
};

const PW = 84;
const PH = 60;

// Clockwise from the top, laid out as a cross with a hole in the middle.
const PANELS = [
  { key: 'up', x: 118, y: 22, dim: '#37552a', bright: '#9fe870' },
  { key: 'right', x: 208, y: 88, dim: '#54390c', bright: '#e8a317' },
  { key: 'down', x: 118, y: 154, dim: '#1b4358', bright: '#4cc2ff' },
  { key: 'left', x: 28, y: 88, dim: '#5c211e', bright: '#ff5f56' },
];

const SHOW_ON_START = 0.42;   // seconds a panel stays lit, round one
const SHOW_ON_MIN = 0.22;     // and the fastest it is ever allowed to get
const SHOW_ON_STEP = 0.02;    // shaved off per extra note, so it creeps up
const GAP_RATIO = 0.45;       // dark between flashes, as a share of the lit time
const GAP_MIN = 0.12;
const PRE_ROLL = 0.7;         // dark beat first, so nobody misses note one
const TAP_FLASH = 0.16;       // how long the player's own press lights a panel
const ROUND_PAUSE = 0.55;
const WRONG_TIME = 0.9;
const WRONG_BLINK = 0.13;
const PRESS_TIME = 3.5;       // per press, not per round

export function create({ width, height, input, onScore, onOver }) {
  const seq = [];
  let phase = 'show';   // show | input | good | wrong
  let step = 0;
  let timer = 0;
  let lit = -1;         // panel alight this instant, -1 for none
  let litFor = 0;
  let answer = -1;      // the panel they needed, kept for the wrong flash
  let rounds = 0;
  let pressLeft = 0;

  // Only the lit time shrinks as the tune grows, and only to a floor. Past the
  // floor it would stop asking whether you remember the order and start asking
  // how fast your eyes are, which is a different game.
  const onTime = () => Math.max(SHOW_ON_MIN, SHOW_ON_START - SHOW_ON_STEP * (seq.length - 1));
  // The gap bottoms out sooner than the lit time does, deliberately: it is the
  // only thing separating two flashes of the SAME panel, so it is the last
  // thing allowed to get short.
  const gapTime = (on) => Math.max(GAP_MIN, on * GAP_RATIO);

  function nextRound() {
    seq.push((Math.random() * 4) | 0);
    step = 0;
    phase = 'show';
    timer = PRE_ROLL;
  }
  nextRound();

  function fail(correct) {
    answer = correct;
    phase = 'wrong';
    timer = WRONG_TIME;
    lit = -1;
    return undefined;
  }

  // Reads and CLEARS all four every frame, even mid-playback: `pressed` holds
  // a press until somebody asks for it, so a jab thrown during the machine's
  // turn would sit there and answer the first note the moment input opened.
  // Dropping those beats queueing them — a player drumming along would commit
  // answers to a tune they had not finished watching — and it only costs them
  // pressing again.
  function takePress() {
    let hit = -1;
    for (let i = 0; i < 4; i++) if (input.pressed(PANELS[i].key)) hit = i;
    return hit;
  }

  return {
    update(dt) {
      litFor -= dt;
      if (litFor <= 0) lit = -1;
      const hit = takePress();

      if (phase === 'show') {
        timer -= dt;
        if (timer > 0) return undefined;
        // The last note's slot already included its dark gap, so by the time
        // input opens the screen has been quiet for a beat.
        if (step >= seq.length) {
          phase = 'input';
          step = 0;
          pressLeft = PRESS_TIME;
          return undefined;
        }
        // Every note books its own dark gap as part of its slot, so the pause
        // is guaranteed rather than being the next note's job to remember.
        const on = onTime();
        lit = seq[step++];
        litFor = on;
        timer += on + gapTime(on);   // += so a long frame does not stretch the beat
        return undefined;
      }

      if (phase === 'input') {
        // A clock per PRESS, not per round: one round-long clock would hand
        // round twelve the same time as round one for four times the work. And
        // 3.5s is far more than anyone who knows the answer needs — it is here
        // to close an abandoned go, not to hurry a player who is thinking.
        pressLeft -= dt;
        if (pressLeft <= 0) return fail(seq[step]);
        if (hit < 0) return undefined;
        // Their press lights the panel exactly as the machine did, same colour
        // and brightness, or answering feels like typing at the game rather
        // than playing the same instrument back.
        lit = hit;
        litFor = TAP_FLASH;
        if (hit !== seq[step]) return fail(seq[step]);
        step++;
        pressLeft = PRESS_TIME;
        if (step === seq.length) {
          rounds++;
          onScore(rounds);   // the length you reached IS the brag in this game
          phase = 'good';
          timer = ROUND_PAUSE;
        }
        return undefined;
      }

      timer -= dt;
      if (timer <= 0) {
        if (phase === 'good') nextRound();
        else onOver();
      }
      return undefined;
    },

    draw(ctx) {
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, width, height);

      // On a miss the panel they NEEDED strobes before the go ends. A screen
      // that simply stops leaves them guessing; this says "oh, it was left".
      const blink = Math.floor(timer / WRONG_BLINK) % 2 === 0;
      PANELS.forEach((p, i) => {
        const on = phase === 'wrong' ? (i === answer && blink) : i === lit;
        ctx.fillStyle = on ? p.bright : p.dim;
        ctx.fillRect(p.x, p.y, PW, PH);
      });

      const words = { show: 'WATCH', input: 'REPEAT', good: 'YES', wrong: 'NOPE' };
      ctx.textAlign = 'center';
      ctx.fillStyle = phase === 'wrong' ? '#ff5f56' : '#e6f0f5';
      ctx.font = '20px monospace';
      ctx.fillText(String(seq.length), width / 2, 116);
      ctx.font = '10px monospace';
      ctx.fillText(words[phase], width / 2, 132);

      // The press clock drains in plain sight, so running out reads as a
      // warning ignored rather than the game snatching the go away.
      if (phase === 'input') {
        ctx.fillStyle = '#243440';
        ctx.fillRect(width / 2 - 28, 140, 56, 3);
        ctx.fillStyle = '#9fe870';
        ctx.fillRect(width / 2 - 28, 140, 56 * Math.max(0, pressLeft / PRESS_TIME), 3);
      }
    },
  };
}
