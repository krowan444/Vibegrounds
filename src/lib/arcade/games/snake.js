/**
 * SNAKE — the reference implementation for every other cabinet game.
 *
 * Moves on a grid at a fixed tick rather than continuously, because that is
 * what makes Snake feel like Snake: the turn you press is the turn you get,
 * and it lands on the beat.
 *
 * The queued-turn business matters more than it looks. Without it, pressing
 * up-then-left quickly inside a single tick loses the first press, and the
 * snake goes left when the player expected a corner — which reads as the
 * controls being broken rather than as the player being fast.
 */
export const meta = {
  id: 'snake',
  name: 'SNAKE',
  blurb: 'Eat, grow, do not eat yourself.',
  how: 'Steer with WASD or the arrows.',
};

const CELL = 8;

export function create({ width, height, input, onScore, onOver, rng }) {
  const cols = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);

  let snake = [{ x: 8, y: 12 }, { x: 7, y: 12 }, { x: 6, y: 12 }];
  let dir = { x: 1, y: 0 };
  const turns = [];          // presses waiting for the next tick
  let food = spawn();
  let score = 0;
  let tick = 0;
  let step = 0.12;           // seconds per move, speeds up as you grow

  function spawn() {
    let p;
    do {
      p = { x: (rng() * cols) | 0, y: (rng() * rows) | 0 };
    } while (snake.some((s) => s.x === p.x && s.y === p.y));
    return p;
  }

  function queue(nx, ny) {
    // Compare against the last queued turn, not the current direction, or
    // two quick presses can double back through the neck.
    const prev = turns.length ? turns[turns.length - 1] : dir;
    if (prev.x === -nx && prev.y === -ny) return;   // no 180s
    if (prev.x === nx && prev.y === ny) return;     // already going that way
    if (turns.length < 2) turns.push({ x: nx, y: ny });
  }

  return {
    update(dt) {
      if (input.pressed('left') || input.held('left')) queue(-1, 0);
      if (input.pressed('right') || input.held('right')) queue(1, 0);
      if (input.pressed('up') || input.held('up')) queue(0, -1);
      if (input.pressed('down') || input.held('down')) queue(0, 1);

      tick += dt;
      if (tick < step) return;
      tick -= step;

      if (turns.length) dir = turns.shift();

      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows) return onOver();
      if (snake.some((s) => s.x === head.x && s.y === head.y)) return onOver();

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        onScore(score);
        food = spawn();
        step = Math.max(0.05, step - 0.004);
      } else {
        snake.pop();
      }
      return undefined;
    },

    draw(ctx) {
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#e8a317';
      ctx.fillRect(food.x * CELL + 1, food.y * CELL + 1, CELL - 2, CELL - 2);

      snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? '#9fe870' : '#4c9a3f';
        ctx.fillRect(s.x * CELL, s.y * CELL, CELL - 1, CELL - 1);
      });
    },
  };
}
