const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../app.js');

const roll = (...values) => { let index = 0; return () => values[index++] ?? 0; };
test('vier Würfel liefern binäre Seiten und eine Summe', () => {
  assert.deepEqual(game.rollDice(roll(.1, .7, .2, .8)), { dice: [0, 1, 0, 1], total: 2 });
});
test('ein Stein kann eingesetzt und exakt ausgetragen werden', () => {
  let state = game.applyRoll(game.createGame(), roll(.9, .1, .1, .1));
  state = game.applyMove(state, game.legalMoves(state)[0]);
  assert.equal(state.pieces[game.LIGHT][0], 0);
  state = { ...state, turn: game.LIGHT, phase: 'move', dice: { dice: [1, 1, 1, 1], total: 1 }, pieces: { ...state.pieces, [game.LIGHT]: [13, -1, -1, -1, -1, -1, -1] } };
  state = game.applyMove(state, game.legalMoves(state).find((move) => move.piece === 0));
  assert.equal(state.borneOff[game.LIGHT], 1);
});
test('Rosette hält die Zugseite und geschützte Mittelweg-Rosette verhindert Schlagen', () => {
  let state = game.createGame();
  state = { ...state, phase: 'move', dice: { dice: [1, 1, 1, 1], total: 4 }, pieces: { [game.LIGHT]: [-1, -1, -1, -1, -1, -1, -1], [game.DARK]: [-1, -1, -1, -1, -1, -1, -1] } };
  state = game.applyMove(state, game.legalMoves(state).find((move) => move.piece === 0));
  assert.equal(state.turn, game.LIGHT);
  state = { ...state, phase: 'move', dice: { dice: [1, 1, 1, 1], total: 1 }, pieces: { [game.LIGHT]: [6, -1, -1, -1, -1, -1, -1], [game.DARK]: [7, -1, -1, -1, -1, -1, -1] } };
  assert.ok(!game.legalMoves(state).some((move) => move.piece === 0));
});
test('Steine auf dem gemeinsamen Weg können geschlagen werden', () => {
  const state = { ...game.createGame(), phase: 'move', dice: { dice: [1, 1, 1, 1], total: 1 }, pieces: { [game.LIGHT]: [7, -1, -1, -1, -1, -1, -1], [game.DARK]: [8, -1, -1, -1, -1, -1, -1] } };
  const next = game.applyMove(state, game.legalMoves(state).find((move) => move.piece === 0));
  assert.equal(next.pieces[game.DARK][0], -1);
});
test('Nullwurf und fehlende Züge geben automatisch ab', () => {
  assert.equal(game.applyRoll(game.createGame(), roll(.1, .1, .1, .1)).turn, game.DARK);
});
test('wer den siebten Stein exakt austrägt, gewinnt', () => {
  const state = { ...game.createGame(), phase: 'move', dice: { dice: [1, 0, 0, 0], total: 1 }, pieces: { [game.LIGHT]: [13, -1, -1, -1, -1, -1, -1], [game.DARK]: [-1, -1, -1, -1, -1, -1, -1] }, borneOff: { [game.LIGHT]: 6, [game.DARK]: 0 } };
  const next = game.applyMove(state, game.legalMoves(state).find((move) => move.piece === 0));
  assert.equal(next.winner, game.LIGHT);
  assert.equal(next.borneOff[game.LIGHT], 7);
});
test('jede KI-Stufe gibt einen legalen Zug zurück', () => {
  const state = game.applyRoll(game.createGame(), roll(.9, .1, .1, .1));
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const move = game.bestMove(state, difficulty);
    assert.ok(game.legalMoves(state).some((candidate) => candidate.piece === move.piece && candidate.to === move.to));
  }
});