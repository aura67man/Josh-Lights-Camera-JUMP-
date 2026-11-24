// save.js - progress + settings in localStorage
const KEY = 'josh_lcj_save_v1';
const SKEY = 'josh_lcj_settings_v1';

export function freshSave(ngPlus = 0, carry = null) {
  return {
    v: 1,
    level: 0,            // next story level to play (6 = finished)
    unlocked: 0,         // highest level unlocked for Level Select
    rice: carry ? carry.rice : 0,
    upgrades: carry ? { ...carry.upgrades } : { hearts: 0, dash: 0, clapper: 0, special: 0 },
    cookers: carry ? [...carry.cookers] : [false, false, false, false, false, false],
    sebastian: carry ? [...carry.sebastian] : [false, false, false, false, false, false],
    achievements: carry ? { ...carry.achievements } : {},
    bowlsTotal: carry ? carry.bowlsTotal : 0,
    score: 0,
    best: carry ? [...carry.best] : [null, null, null, null, null, null],
    allies: carry ? { ...carry.allies } : { craig: false, finn: false },
    goldClapper: carry ? !!carry.goldClapper : false,
    completed: carry ? !!carry.completed : false,
    ngPlus,
  };
}

export const Save = {
  data: freshSave(),
  settings: { master: 0.8, music: 0.55, sfx: 0.8, mute: false },
  exists() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); this.data = Object.assign(freshSave(), d); return true; }
    } catch (e) { /* corrupt or blocked storage */ }
    return false;
  },
  store() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
  loadSettings() {
    try { const raw = localStorage.getItem(SKEY); if (raw) Object.assign(this.settings, JSON.parse(raw)); } catch (e) { /* ignore */ }
    return this.settings;
  },
  storeSettings() { try { localStorage.setItem(SKEY, JSON.stringify(this.settings)); } catch (e) { /* ignore */ } },
};
