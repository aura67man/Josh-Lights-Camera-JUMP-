# JOSH: LIGHTS, CAMERA, JUMP!

A 2D side-scrolling pixel platformer that runs in the browser. Josh, a young South Korean boy who dreams of
directing movies, fights through six film-set worlds to finish and premiere his first movie.

Plain HTML5 Canvas + vanilla JavaScript (ES modules). No frameworks, no build step, no external assets:
every sprite is drawn in code, every sound and song is synthesised with the Web Audio API.

## Run it

Browsers block ES modules on `file://` pages, so serve the folder locally:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (If you double-click `index.html` and your browser blocks modules,
the page shows these same instructions.)

## Controls (all rebindable in Options > Controls, saved in your browser)

| Action | Keys | Gamepad |
| --- | --- | --- |
| Move | Arrows / A D | D-pad / left stick |
| Jump (press again in the air to double jump) | Z / Space | A |
| Drop through a platform | Down + Jump | Down + A |
| Clapperboard swing (also breaks cracked "prop walls") | X / J | X |
| Throw film reel | C / K | Y |
| Dash, "Take Two" (invulnerable while dashing) | Left Shift / L | B / RT |
| Dramatic Pose (when the POSE meter is full: stuns everything nearby) | V / I | RB |
| Stunt Assist (Craig crashes across the screen, once per scene) | B / U | LB / LT |
| Pause | Esc / P | Start |

Menus: arrows to move, Enter / Space / Z to confirm, Esc / X to go back. Esc skips cutscenes.

## What's in it

- **6 worlds**: School Drama Hall, Backlot Street, Haunted Horror Set, Sci-Fi Spaceship Set, Western Stunt Set,
  and The Premiere (red carpet + Studio Tower). Each has 3 to 4 escalating enemy waves, a mini-boss midway and a
  multi-phase boss with a health bar. Enemy tiers 1 to 6 scale HP, speed, damage and attack patterns.
- **The crew**: Craig Tyler (stunt coordinator, sparring mini-boss, then Stunt Assist), Marcus Batshon (runs the
  Prop Shop between levels), Ayden Tipler (camera operator, "Camera Rolling" checkpoints and rare hints),
  Finn Cronin (rival, Level 4's "Method Actor" mini-boss, then your Understudy: one free revive per scene)
  and Sebastian Hili (hidden in every level; find all six for a bonus).
- **Rice economy**: rice grains (1) and rice bowls (10) buy extra hearts, longer dash, a stronger clapperboard
  and faster Pose recharge from Marcus. Each level hides a golden Rice Cooker behind a breakable wall.
- **Systems**: save/continue, level select, options (master / music / SFX volume + mute, saved), rebinding with
  reset to defaults, pause menu, game over + retry from checkpoint, level summary with rank, screen shake,
  hit-stop, procedural chiptune per world, New Game+ and level replay after the credits.

## File structure

```
index.html          page + canvas (shows run instructions if modules are blocked)
js/main.js          boot: canvas, input, font, sprites, settings, main loop
js/engine.js        canvas scaling, fixed 60 Hz loop, math/RNG, screen shake, hit-stop, particles, tile physics
js/input.js         rebindable keyboard (localStorage) + gamepad
js/audio.js         Web Audio SFX synth + procedural chiptune sequencer (one track per world, boss themes)
js/sprites.js       pixel-art painter, auto 1px black outlines, humanoid generator, all sprites, tilesets, parallax
js/font.js          built-in bitmap font
js/ui.js            panels, menus, typewriter text boxes with portraits, speech bubbles, HUD, boss bar, toasts
js/story.js         Josh's 100+ jokes, cutscene scripts, boss banter, Sebastian + Ayden lines, credits
js/levels.js        world definitions + seeded level builder (corridors, wave arenas, secrets, checkpoints)
js/player.js        Josh
js/enemies.js       film-themed enemies (23 types, 4 behaviours, tier scaling)
js/bosses.js        12 bosses/mini-bosses with 2-3 phases from a shared attack library
js/game.js          gameplay scene (waves, arenas, pickups, secrets, allies, camera, rendering)
js/scenes.js        title, options, controls, level select, credits, cutscenes, pause, game over,
                    summary, Prop Shop, completion + story flow
js/save.js          save data + settings persistence
js/state.js         scene stack + flow hooks
```
