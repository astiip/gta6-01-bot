// Save and load: cash, story progress and lifetime stats in localStorage.
// The game never needs a server; a save is just a small JSON blob.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: state.player.cash,
      missionIndex: state.missions.index,
      completed: state.missions.completed,
      stats: state.stats,
      player: { x: state.player.x, z: state.player.z, health: state.player.health },
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // No storage available; a fresh game is the fallback.
  }
}

export function freshStats() {
  return {
    carsStolen: 0,
    missionsDone: 0,
    gangDown: 0,
    busted: 0,
    wasted: 0,
    earned: 0,
  };
}
