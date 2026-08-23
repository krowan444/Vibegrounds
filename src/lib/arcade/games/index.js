import * as snake from './snake';
import * as pong from './pong';
import * as breakout from './breakout';
import * as invaders from './invaders';
import * as jumper from './jumper';

/**
 * What is in the cabinet.
 *
 * The order is deliberate: Snake first because everybody already knows how to
 * play it, so nobody's first go is spent reading instructions.
 */
export const GAMES = [snake, breakout, pong, invaders, jumper];

export const byId = (id) => GAMES.find((g) => g.meta.id === id);
