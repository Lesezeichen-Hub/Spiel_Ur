(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RoyalGameOfUr = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const LIGHT = 'light';
  const DARK = 'dark';
  const PLAYERS = [LIGHT, DARK];
  const ROSSETTES = new Set([3, 7, 13]);
  const PROTECTED_ROSETTE = 7;
  const PATH_LENGTH = 14;

  function other(player) { return player === LIGHT ? DARK : LIGHT; }
  function createGame() { return { turn: LIGHT, phase: 'roll', dice: null, pieces: { [LIGHT]: Array(7).fill(-1), [DARK]: Array(7).fill(-1) }, borneOff: { [LIGHT]: 0, [DARK]: 0 }, winner: null, lastAction: null }; }
  function rollDice(random = Math.random) { const dice = Array.from({ length: 4 }, () => random() < .5 ? 0 : 1); return { dice, total: dice.reduce((sum, value) => sum + value, 0) }; }
  function shared(position) { return position >= 4 && position <= 11; }
  function onRosette(position) { return ROSSETTES.has(position); }
  function clone(state) { return { ...state, dice: state.dice ? { ...state.dice, dice: [...state.dice.dice] } : null, pieces: { [LIGHT]: [...state.pieces[LIGHT]], [DARK]: [...state.pieces[DARK]] }, borneOff: { ...state.borneOff }, lastAction: state.lastAction ? { ...state.lastAction } : null }; }

  function legalMoves(state, player = state.turn) {
    if (state.phase !== 'move' || state.winner || !state.dice?.total) return [];
    const roll = state.dice.total;
    return state.pieces[player].flatMap((position, piece) => {
      const destination = position + roll;
      if (destination > PATH_LENGTH) return [];
      if (destination === PATH_LENGTH) return [{ piece, from: position, to: destination, bearOff: true }];
      if (state.pieces[player].includes(destination)) return [];
      const opponent = other(player);
      const opponentPiece = shared(destination) ? state.pieces[opponent].findIndex((otherPosition) => otherPosition === destination) : -1;
      if (opponentPiece >= 0 && destination === PROTECTED_ROSETTE) return [];
      return [{ piece, from: position, to: destination, capture: opponentPiece >= 0 ? opponentPiece : null, bearOff: false }];
    });
  }

  function applyRoll(state, random = Math.random) {
    if (state.phase !== 'roll' || state.winner) throw new Error('Wurf ist jetzt nicht möglich');
    const next = clone(state);
    next.dice = rollDice(random);
    next.lastAction = { type: 'roll', player: state.turn, ...next.dice };
    if (next.dice.total === 0) { next.turn = other(state.turn); next.phase = 'roll'; next.lastAction.pass = true; return next; }
    next.phase = 'move';
    if (!legalMoves(next).length) { next.turn = other(state.turn); next.phase = 'roll'; next.lastAction.pass = true; }
    return next;
  }

  function sameMove(first, second) { return first.piece === second.piece && first.from === second.from && first.to === second.to; }
  function applyMove(state, move) {
    const legal = legalMoves(state).find((candidate) => sameMove(candidate, move));
    if (!legal) throw new Error('Ungültiger Zug');
    const next = clone(state);
    const player = state.turn;
    next.pieces[player][legal.piece] = legal.to;
    if (legal.capture !== null) next.pieces[other(player)][legal.capture] = -1;
    if (legal.bearOff) next.borneOff[player] += 1;
    if (next.borneOff[player] === 7) next.winner = player;
    const rosette = !legal.bearOff && onRosette(legal.to);
    next.phase = next.winner ? 'finished' : 'roll';
    if (!next.winner && !rosette) next.turn = other(player);
    next.dice = null;
    next.lastAction = { type: 'move', player, ...legal, rosette };
    return next;
  }

  function evaluate(state, perspective) {
    if (state.winner) return state.winner === perspective ? 10000 : -10000;
    const value = (player) => state.borneOff[player] * 35 + state.pieces[player].reduce((sum, position) => sum + Math.max(position, 0) * 1.8, 0);
    return value(perspective) - value(other(perspective));
  }

  function tacticalEvaluate(state, perspective) {
    if (state.winner) return state.winner === perspective ? 10000 : -10000;
    const opponent = other(perspective);
    const progress = (player) => state.borneOff[player] * 100 + state.pieces[player].reduce((sum, position) => sum + Math.max(position, 0) * 2, 0);
    const protectedCount = (player) => state.pieces[player].filter((position) => position >= 0 && onRosette(position)).length;
    const captures = (player) => {
      const rolled = prepareRoll(state, { dice: [1, 0, 0, 0], total: 1 });
      return legalMoves({ ...rolled, turn: player }).filter((move) => move.capture !== null).length;
    };
    const blockedEntries = (player) => state.pieces[other(player)].filter((position) => position < 0).length > 0
      ? [1, 2, 3, 4].filter((roll) => state.pieces[player].includes(roll - 1)).length
      : 0;
    const mobility = (player) => {
      const rolled = prepareRoll(state, { dice: [1, 0, 0, 0], total: 1 });
      return legalMoves({ ...rolled, turn: player }).length;
    };
    return progress(perspective) - progress(opponent)
      + (protectedCount(perspective) - protectedCount(opponent)) * 16
      + (captures(perspective) - captures(opponent)) * 28
      + (blockedEntries(opponent) - blockedEntries(perspective)) * 12
      + (mobility(perspective) - mobility(opponent)) * 3;
  }

  function diceOutcomes() {
    return Array.from({ length: 16 }, (_, mask) => {
      const dice = Array.from({ length: 4 }, (_, index) => (mask >> index) & 1);
      return { dice, total: dice.reduce((sum, value) => sum + value, 0) };
    });
  }

  function prepareRoll(state, outcome) {
    const next = clone(state);
    next.dice = { dice: [...outcome.dice], total: outcome.total };
    next.phase = outcome.total > 0 ? 'move' : 'roll';
    next.lastAction = null;
    if (next.phase === 'move' && !legalMoves(next).length) { next.turn = other(next.turn); next.phase = 'roll'; }
    else if (next.phase === 'roll') next.turn = other(next.turn);
    return next;
  }

  function ultraExpectedAfterAction(state, perspective, depth) {
    if (state.winner || depth <= 0) return tacticalEvaluate(state, perspective);
    const outcomes = diceOutcomes();
    return outcomes.reduce((sum, outcome) => {
      const rolled = prepareRoll(state, outcome);
      return sum + ultraSelect(rolled, perspective, depth);
    }, 0) / outcomes.length;
  }

  function ultraSelect(state, perspective, depth) {
    if (state.winner) return tacticalEvaluate(state, perspective);
    if (state.phase !== 'move') return ultraExpectedAfterAction(state, perspective, depth - 1);
    const moves = legalMoves(state);
    if (!moves.length) return tacticalEvaluate(state, perspective);
    const values = moves.map((move) => ultraExpectedAfterAction(applyMove(state, move), perspective, depth - 1));
    return state.turn === perspective ? Math.max(...values) : Math.min(...values);
  }

  function ultraBestMove(state) {
    const moves = legalMoves(state);
    if (!moves.length) return null;
    const perspective = state.turn;
    return moves.map((move) => ({ move, value: ultraExpectedAfterAction(applyMove(state, move), perspective, 2) }))
      .sort((left, right) => right.value - left.value)[0].move;
  }

  function bestMove(state, difficulty = 'medium') {
    const moves = legalMoves(state);
    if (!moves.length) return null;
    if (difficulty === 'easy') return moves[Math.floor(Math.random() * moves.length)];
    if (difficulty === 'ultra') return ultraBestMove(state);
    const player = state.turn;
    const ranked = moves.map((move) => ({ move, score: evaluate(applyMove(state, move), player) })).sort((a, b) => b.score - a.score);
    return difficulty === 'medium' ? ranked[Math.floor(Math.random() * Math.min(2, ranked.length))].move : ranked[0].move;
  }

  function boardCoordinate(player, position) {
    const row = player === LIGHT ? 0 : 2;
    if (position < 4) return { row, col: 3 - position };
    if (position < 12) return { row: 1, col: position - 4 };
    return { row, col: 19 - position };
  }

  function mount(document) {
    const elements = { board: document.getElementById('board'), dice: document.getElementById('dice'), roll: document.getElementById('roll'), total: document.getElementById('roll-total'), status: document.getElementById('status'), turn: document.getElementById('turn-indicator'), turnName: document.getElementById('turn-name'), mode: document.getElementById('mode'), humanSide: document.getElementById('human-side'), difficulty: document.getElementById('difficulty'), humanSideControl: document.getElementById('human-side-control'), difficultyControl: document.getElementById('difficulty-control'), lightReserve: document.getElementById('light-reserve'), darkReserve: document.getElementById('dark-reserve'), lightOff: document.getElementById('light-off'), darkOff: document.getElementById('dark-off'), moves: document.getElementById('moves'), moveCount: document.getElementById('move-count'), undo: document.getElementById('undo'), newGame: document.getElementById('new-game'), clearSave: document.getElementById('clear-save'), confirm: document.getElementById('confirm-new'), confirmNewGame: document.getElementById('confirm-new-game') };
    if (!elements.board) return;
    const storageKey = 'royal-game-of-ur-v1';
    let settings = { mode: 'local', humanSide: LIGHT, difficulty: 'medium' };
    let history = [];
    let state = load();
    let selectedPiece = null;
    let thinking = false;

    function load() {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved?.state && PLAYERS.every((player) => Array.isArray(saved.state.pieces?.[player]) && saved.state.pieces[player].length === 7)) { settings = { ...settings, ...saved.settings }; history = saved.history || []; return saved.state; }
      } catch (_) { localStorage.removeItem(storageKey); }
      return createGame();
    }
    function save() { localStorage.setItem(storageKey, JSON.stringify({ state, settings, history })); }
    function isHumanTurn() { return settings.mode === 'local' || state.turn === settings.humanSide; }
    function name(player) { return player === LIGHT ? 'Helle Steine' : 'Dunkle Steine'; }
    function coordinateMatches(player, position, row, col) { const target = boardCoordinate(player, position); return target.row === row && target.col === col; }
    function displayedPieces(row, col) { return PLAYERS.flatMap((player) => state.pieces[player].flatMap((position, piece) => position >= 0 && position < PATH_LENGTH && coordinateMatches(player, position, row, col) ? [{ player, piece, position }] : [])); }
    function rosetteAt(row, col) { return PLAYERS.some((player) => [3, 7, 13].some((position) => coordinateMatches(player, position, row, col))); }
    function renderDice() {
      elements.dice.replaceChildren();
      (state.dice?.dice || [0, 0, 0, 0]).forEach((value) => { const die = document.createElement('span'); die.className = `die ${value ? '' : 'zero'}`; die.textContent = value; elements.dice.append(die); });
      elements.total.textContent = state.dice ? String(state.dice.total) : '–';
    }
    function renderMoves() {
      elements.moves.replaceChildren();
      history.forEach((snapshot) => { const action = snapshot.after.lastAction; const item = document.createElement('li'); item.textContent = action.type === 'roll' ? `${name(action.player)} würfeln ${action.dice.join(' + ')} = ${action.total}${action.pass ? ' · kein Zug' : ''}` : `${name(action.player)}: ${action.from < 0 ? 'Reserve' : action.from + 1} → ${action.bearOff ? 'ausgetragen' : action.to + 1}${action.capture !== null ? ' · geschlagen' : ''}${action.rosette ? ' · Rosette, weiterer Wurf' : ''}`; elements.moves.append(item); });
      elements.moveCount.textContent = `${history.filter((snapshot) => snapshot.after.lastAction.type === 'move').length} Züge`;
      elements.moves.lastElementChild?.scrollIntoView({ block: 'nearest' });
    }
    function render() {
      elements.mode.value = settings.mode; elements.humanSide.value = settings.humanSide; elements.difficulty.value = settings.difficulty;
      const computer = settings.mode === 'computer'; elements.humanSideControl.classList.toggle('hidden', !computer); elements.difficultyControl.classList.toggle('hidden', !computer);
      elements.board.replaceChildren();
      const availableMoves = legalMoves(state);
      const moves = selectedPiece === null ? availableMoves : availableMoves.filter((move) => move.piece === selectedPiece);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) {
        const present = row === 1 || col < 4 || col > 5;
        const square = document.createElement('button'); square.type = 'button'; square.className = present ? 'space' : 'space empty'; square.setAttribute('role', 'gridcell');
        if (!present) { elements.board.append(square); continue; }
        if (row === 2) square.classList.add('private-dark'); if (row === 1) square.classList.add('shared'); if (rosetteAt(row, col)) square.classList.add('rosette');
        const occupants = displayedPieces(row, col); occupants.forEach((occupant) => { const token = document.createElement('span'); token.className = `piece ${occupant.player}`; token.setAttribute('aria-hidden', 'true'); square.append(token); });
        if (occupants.some((occupant) => occupant.player === state.turn && availableMoves.some((move) => move.piece === occupant.piece))) square.classList.add('movable');
        if (occupants.some((occupant) => occupant.player === state.turn && occupant.piece === selectedPiece)) square.classList.add('selected');
        if (moves.some((move) => !move.bearOff && coordinateMatches(state.turn, move.to, row, col))) square.classList.add('target');
        if (state.lastAction?.type === 'move' && ((!state.lastAction.bearOff && coordinateMatches(state.lastAction.player, state.lastAction.to, row, col)) || (state.lastAction.from >= 0 && coordinateMatches(state.lastAction.player, state.lastAction.from, row, col)))) square.classList.add('last-move');
        square.disabled = state.winner || thinking || !isHumanTurn() || state.phase !== 'move';
        square.setAttribute('aria-label', `Feld ${row + 1}-${col + 1}${occupants.length ? `, ${name(occupants[0].player)}` : ''}`);
        square.addEventListener('click', () => choose(row, col)); elements.board.append(square);
      }
      renderDice(); renderMoves();
      PLAYERS.forEach((player) => { const reserve = state.pieces[player].filter((position) => position < 0).length; (player === LIGHT ? elements.lightReserve : elements.darkReserve).textContent = reserve; (player === LIGHT ? elements.lightOff : elements.darkOff).textContent = state.borneOff[player]; });
      elements.turn.className = `turn-indicator ${state.turn === DARK ? 'dark' : ''}`; elements.turnName.textContent = name(state.turn);
      elements.undo.disabled = !history.length || thinking; elements.roll.disabled = state.phase !== 'roll' || !isHumanTurn() || thinking || Boolean(state.winner);
      if (state.winner) elements.status.textContent = `${name(state.winner)} gewinnen die Partie.`;
      else if (thinking) elements.status.textContent = 'Computer würfelt und plant seinen Zug …';
      else if (state.phase === 'move') elements.status.textContent = selectedPiece === null ? `${name(state.turn)}: Wähle einen leuchtenden Stein oder ein markiertes Einsetzfeld für ${state.dice.total} Schritt${state.dice.total === 1 ? '' : 'e'}.` : `${name(state.turn)}: Wähle das markierte Zielfeld.`;
      else elements.status.textContent = `${name(state.turn)} sind am Zug. Würfle die vier Tetraeder.`;
    }
    function act(next) { history.push({ before: state, after: next }); state = next; selectedPiece = null; save(); render(); if (!state.winner && settings.mode === 'computer' && state.turn !== settings.humanSide) computerTurn(); }
    function doRoll(random) { act(applyRoll(state, random)); }
    function choose(row, col) {
      const own = displayedPieces(row, col).find((occupant) => occupant.player === state.turn);
      if (own) {
        selectedPiece = own.piece;
        render();
        const bearOff = legalMoves(state).find((move) => move.piece === selectedPiece && move.bearOff);
        if (bearOff) act(applyMove(state, bearOff));
        return;
      }
      const target = legalMoves(state).find((move) => (selectedPiece === null || move.piece === selectedPiece) && !move.bearOff && coordinateMatches(state.turn, move.to, row, col));
      if (target) { act(applyMove(state, target)); return; }
      selectedPiece = null;
      render();
    }
    function computerTurn() {
      thinking = true;
      render();
      setTimeout(() => {
        if (state.phase === 'roll') {
          const before = state;
          state = applyRoll(state);
          history.push({ before, after: state });
          selectedPiece = null;
          save();
          if (state.turn !== other(settings.humanSide) || state.phase !== 'move' || state.winner) { thinking = false; render(); return; }
          computerTurn();
          return;
        }
        const move = bestMove(state, settings.difficulty);
        thinking = false;
        if (move) act(applyMove(state, move)); else render();
      }, 450);
    }
    function reset() { settings = { mode: elements.mode.value, humanSide: elements.humanSide.value, difficulty: elements.difficulty.value }; state = createGame(); history = []; selectedPiece = null; thinking = false; save(); render(); if (settings.mode === 'computer' && state.turn !== settings.humanSide) computerTurn(); }
    elements.roll.addEventListener('click', () => doRoll()); elements.mode.addEventListener('change', () => { settings.mode = elements.mode.value; render(); });
    elements.newGame.addEventListener('click', () => history.length && !state.winner && elements.confirm.showModal ? elements.confirm.showModal() : reset()); elements.confirmNewGame.addEventListener('click', reset);
    elements.undo.addEventListener('click', () => { if (history.length && !thinking) { state = history.pop().before; if (settings.mode === 'computer' && history.length && state.turn !== settings.humanSide) state = history.pop().before; selectedPiece = null; save(); render(); } });
    elements.clearSave.addEventListener('click', () => { localStorage.removeItem(storageKey); reset(); });
    render(); if (settings.mode === 'computer' && state.turn !== settings.humanSide) computerTurn();
  }

  return { LIGHT, DARK, PLAYERS, ROSSETTES, PROTECTED_ROSETTE, PATH_LENGTH, createGame, rollDice, shared, onRosette, legalMoves, applyRoll, applyMove, bestMove, evaluate, evaluateTactical: tacticalEvaluate, diceOutcomes, boardCoordinate, mount };
});

if (typeof document !== 'undefined') window.RoyalGameOfUr.mount(document);