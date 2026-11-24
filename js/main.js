// main.js - boot: canvas, input, font, sprites, saved settings, scene loop
import { initCanvas, startLoop } from './engine.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { initFont } from './font.js';
import { initSprites } from './sprites.js';
import { Save } from './save.js';
import { Scenes, Flow } from './state.js';
import { Toasts } from './ui.js';
import { startGame } from './scenes.js';

initCanvas();
Input.init();
initFont();
initSprites();
Save.loadSettings();
Save.load();
Audio.settings = Save.settings;
// Browsers only allow audio after a user gesture: start it on the first key/click.
Input.onFirstGesture = () => { Audio.init(); Audio.apply(Save.settings); Audio.resume(); };

startGame();
window.__joshBooted = true;
window.JOSH = { Scenes, Flow, Save }; // handy for debugging in the console

startLoop(
  (dt) => { Input.update(dt); Scenes.update(dt); Toasts.update(dt); },
  (c) => { Scenes.render(c); Toasts.render(c); },
);
