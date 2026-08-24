/**
 * STACKER — the falling-block one.
 *
 * The game is one question asked over and over: where does this piece go? So
 * everything here is about making sure the answer the player picked is the
 * answer they get. It turns when pressed against a wall instead of ignoring
 * the button, a held key walks it across at a readable pace instead of
 * flinging it, and the next piece is on screen so the choice can be made a
 * turn early. The shuffled bag is the same idea: twenty turns without the long
 * piece is not bad luck as far as the player can tell, it is the machine
 * cheating.
 */
export const meta = {
  id: 'stacker',
  name: 'STACKER',
  blurb: 'Fit the falling blocks, clear the lines.',
  how: 'Left and right to shift, down to fall faster, A to turn, B to slam it down.',
};

const COLS = 10, ROWS = 20, CELL = 11;
const WELL_X = 105, WELL_Y = 10;    // puts the 110×220 well dead centre
const PREVIEW = 9;                  // the next piece is drawn a size smaller

// Each shape sits in a square box, so turning it is just turning the box. The
// empty rows are load-bearing: they are what makes the long piece pivot around
// its middle rather than flip end over end.
const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
const KEYS = Object.keys(SHAPES);

// Two shades of each colour. Settled blocks take the darker one so the piece
// still in the air stands out — it is the only thing being steered.
const BRIGHT = { I: '#4bb8d8', J: '#5c7ce0', L: '#e8a317', O: '#e8d64b', S: '#9fe870', T: '#8f7fd8', Z: '#e2564f' };
const SETTLED = { I: '#2d6f83', J: '#374a86', L: '#8b620e', O: '#8b7f2c', S: '#5f8b43', T: '#554b81', Z: '#873430' };

const LINE_SCORE = [0, 100, 300, 500, 800];
const HOLD_PAUSE = 0.17;            // wait before a held key starts repeating
const HOLD_REPEAT = 0.05;           // and the pace once it does

function forCells(cells, fn) {
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells.length; c++) if (cells[r][c]) fn(c, r);
  }
}

function block(ctx, x, y, colour, size) {
  ctx.fillStyle = colour;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
}

export function create({ width, height, input, onScore, onOver }) {
  const grid = [];
  for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(null));

  let bag = [];
  let nextKey = pull();
  let piece = null;
  let score = 0, lines = 0, level = 1;
  let fall = 0;
  let moveDir = 0, moveTimer = 0;
  let dead = false;

  // Refill with all seven shuffled, then deal off the end. Worst case is a
  // twelve-piece wait for a particular shape, and it always turns up.
  function pull() {
    if (!bag.length) {
      bag = KEYS.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function hits(cells, px, py) {
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < cells.length; c++) {
        if (!cells[r][c]) continue;
        const x = px + c, y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS || grid[y][x]) return true;
      }
    }
    return false;
  }

  function spawn() {
    const key = nextKey;
    nextKey = pull();
    const cells = SHAPES[key].map((row) => row.slice());
    piece = { key, cells, x: ((COLS - cells.length) / 2) | 0, y: 0 };
    // Nowhere left to put it. That is the only way this game ends.
    if (hits(cells, piece.x, piece.y)) { dead = true; onOver(); }
  }

  // Clockwise only. A is the one spare button, and B is better spent on the
  // slam, which nothing else can do, whereas anticlockwise is three taps away.
  //
  // If the turn lands in a wall or a settled block, try it one cell left and
  // then one cell right before giving up. Skip that and a piece pressed against
  // the wall silently refuses to turn, which reads as a dead button.
  function rotate() {
    const n = piece.cells.length;
    const turned = piece.cells.map((row, r) => row.map((_, c) => piece.cells[n - 1 - c][r]));
    for (const kick of [0, -1, 1]) {
      if (hits(turned, piece.x + kick, piece.y)) continue;
      piece.cells = turned;
      piece.x += kick;
      return;
    }
  }

  function restingY() {
    let y = piece.y;
    while (!hits(piece.cells, piece.x, y + 1)) y++;
    return y;
  }

  function shift(dir) {
    if (!hits(piece.cells, piece.x + dir, piece.y)) piece.x += dir;
  }

  function lock() {
    forCells(piece.cells, (c, r) => { grid[piece.y + r][piece.x + c] = piece.key; });

    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!grid[r].every((cell) => cell)) continue;
      grid.splice(r, 1);
      grid.unshift(new Array(COLS).fill(null));
      cleared++;
      r++;   // whatever dropped into this slot has not been looked at yet
    }

    if (cleared) {
      lines += cleared;
      level = 1 + ((lines / 10) | 0);
      // Four at once pays eight times what four singles pay. Digging a well and
      // waiting for the long piece is a gamble, so it has to be worth taking.
      score += LINE_SCORE[cleared] * level;
      onScore(score);
    }
    spawn();
  }

  spawn();

  return {
    update(dt) {
      if (dead) return;

      // Both sides are read every frame, because an unread press would sit in
      // the queue and fire a frame late.
      const tapLeft = input.pressed('left');
      const tapRight = input.pressed('right');
      const tap = tapLeft ? -1 : tapRight ? 1 : 0;
      const dir = tap || (input.held('left') ? -1 : input.held('right') ? 1 : 0);
      // A fresh press always moves once straight away; only a key left down
      // waits and then repeats. Without the wait, one tap walks the piece the
      // width of the well before the finger is off the key — but the tap has to
      // jump that wait, or a quick second tap lands mid-pause and is swallowed.
      if (tap || dir !== moveDir) {
        moveDir = dir;
        moveTimer = HOLD_PAUSE;
        if (dir) shift(dir);
      } else if (dir && (moveTimer -= dt) <= 0) {
        moveTimer = HOLD_REPEAT;
        shift(dir);
      }

      if (input.pressed('a')) rotate();
      if (input.pressed('b')) { piece.y = restingY(); lock(); return; }

      // Speeds up as the lines mount but stops at a floor, because past about
      // nine rows a second there is no time to think and it stops being a game.
      const natural = Math.max(0.11, 0.6 - lines * 0.012);
      // Down makes it fall faster rather than dropping it outright, so a key
      // held a moment too long costs a row and not the whole stack.
      const step = input.held('down') ? Math.min(0.04, natural) : natural;

      fall += dt;
      if (fall < step) return;
      // Zeroed rather than wound back, so grabbing the down key part-way through
      // a slow fall drops one row and then settles into the fast rhythm, rather
      // than spending all the banked time in one lurch.
      fall = 0;
      if (hits(piece.cells, piece.x, piece.y + 1)) lock();
      else piece.y++;
    },

    draw(ctx) {
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, width, height);

      // Half-pixel offset so the outline lands on one crisp row of pixels
      // rather than smeared across two.
      ctx.strokeStyle = '#2a3541';
      ctx.lineWidth = 1;
      ctx.strokeRect(WELL_X - 0.5, WELL_Y - 0.5, COLS * CELL + 1, ROWS * CELL + 1);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (grid[r][c]) block(ctx, WELL_X + c * CELL, WELL_Y + r * CELL, SETTLED[grid[r][c]], CELL);
        }
      }

      // An outline where the piece would land. The slam button is only usable
      // if you can see what you are slamming into.
      const landing = restingY();
      forCells(piece.cells, (c, r) => ctx.strokeRect(
        WELL_X + (piece.x + c) * CELL + 1.5, WELL_Y + (landing + r) * CELL + 1.5, CELL - 3, CELL - 3));

      forCells(piece.cells, (c, r) => block(
        ctx, WELL_X + (piece.x + c) * CELL, WELL_Y + (piece.y + r) * CELL, BRIGHT[piece.key], CELL));

      // Centre the preview on the blocks, not on the box around them — most
      // shapes have an empty row or column and would hang off to one side.
      const cells = SHAPES[nextKey];
      let minC = 4, maxC = -1, minR = 4, maxR = -1;
      forCells(cells, (c, r) => {
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      });
      const px = Math.round(267 - ((minC + maxC + 1) / 2) * PREVIEW);
      const py = Math.round(64 - ((minR + maxR + 1) / 2) * PREVIEW);
      forCells(cells, (c, r) => block(ctx, px + c * PREVIEW, py + r * PREVIEW, BRIGHT[nextKey], PREVIEW));

      ctx.textAlign = 'center';
      ctx.font = '9px monospace';
      ctx.fillStyle = '#5d6b7a';
      ['SCORE', 'LINES', 'LEVEL'].forEach((label, i) => ctx.fillText(label, 52, 44 + i * 40));
      ctx.fillText('NEXT', 267, 44);

      ctx.font = '13px monospace';
      ctx.fillStyle = '#e6edf3';
      [score, lines, level].forEach((v, i) => ctx.fillText(String(v), 52, 60 + i * 40));
    },
  };
}
