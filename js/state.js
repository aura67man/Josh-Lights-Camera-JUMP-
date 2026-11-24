// state.js - scene stack + flow hooks (filled in by scenes.js) to avoid circular imports
export const Scenes = {
  stack: [],
  set(s) { this.stack = [s]; if (s.enter) s.enter(); },
  push(s) { this.stack.push(s); if (s.enter) s.enter(); },
  pop() { const s = this.stack.pop(); const t = this.top(); if (t && t.resume) t.resume(); return s; },
  top() { return this.stack[this.stack.length - 1]; },
  update(dt) { const t = this.top(); if (t) t.update(dt); },
  render(c) {
    // draw from the last opaque scene upward so overlays (pause, game over) sit on top
    let i = this.stack.length - 1;
    while (i > 0 && this.stack[i].overlay) i--;
    for (; i < this.stack.length; i++) this.stack[i].render(c);
  },
};
export const Flow = {};
