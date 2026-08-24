import * as snake from './snake';
import * as breakout from './breakout';
import * as pong from './pong';
import * as invaders from './invaders';
import * as jumper from './jumper';
import * as rocks from './rocks';
import * as crossing from './crossing';
import * as stacker from './stacker';
import * as repeat from './repeat';

/**
 * What is in the cabinet.
 *
 * The order is deliberate. Snake first because everybody already knows how to
 * play it, so nobody's first go is spent reading instructions. After that the
 * one-button and grid games, which are the easiest to pick up, and the ones
 * needing real dexterity — Rocks and Stacker — further down the row.
 */
export const GAMES = [
  snake,
  breakout,
  pong,
  crossing,
  repeat,
  jumper,
  invaders,
  rocks,
  stacker,
];

export const byId = (id) => GAMES.find((g) => g.meta.id === id);
