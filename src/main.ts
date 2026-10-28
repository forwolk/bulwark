import './ui/styles.css';
import { Game } from './core/Game';

const viewport = document.getElementById('viewport');
const ui = document.getElementById('ui');
if (!viewport || !ui) throw new Error('Missing #viewport or #ui root elements');

const game = new Game(viewport, ui);

// Dev-only handle for poking at state from the browser console.
if (import.meta.env.DEV) (window as unknown as { bulwark: Game }).bulwark = game;
