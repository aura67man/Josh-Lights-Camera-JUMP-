// story.js - all the words: Josh's jokes, cutscenes, boss banter, hidden Sebastian lines, credits
import { Input } from './input.js';

// Replace {action} tokens with the player's current key binding.
export function fmt(t) { return t.replace(/\{(\w+)\}/g, (m, a) => (Input.binds[a] ? '[' + Input.bindLabel(a) + ']' : m)); }

export const JOKES = {
  start: [
    'LIGHTS! CAMERA! ME!', 'QUIET ON SET! ...THAT MEANS YOU, BAD GUYS.', 'TIME TO MAKE A SCENE. LITERALLY.',
    'ACTION! AND BY ACTION, I MEAN JUMPING.', 'PLACES, EVERYONE! ESPECIALLY ME.', 'THIS SCENE IS GONNA BE REEL-Y GOOD.',
  ],
  level: [
    'WELCOME TO THE DRAMA HALL, WHERE EVERY ENTRANCE IS A GRAND ENTRANCE!',
    'BACKLOT STREET! THESE BUILDINGS ARE ALL FRONT. LIKE FINAL CUT.',
    "HAUNTED SET? DON'T WORRY, I'VE GOT NERVES OF... JELLY.",
    'SPACE: THE FINAL FRONTIER. ALSO THE FINAL SCENE BEFORE LUNCH.',
    "THIS TOWN AIN'T BIG ENOUGH FOR THE BOTH OF US... AND MY EGO.",
    "RED CARPET, HERE I COME! DON'T STEP ON MY CAPE. I DON'T HAVE A CAPE.",
  ],
  rice: [
    'RICE TO MEET YOU!', "THAT'S A GRAIN-D SLAM!", 'RICE AND SHINE!', "I'M ON A ROLL. A RICE ROLL.",
    'THIS IS GRAIN-BREAKING CINEMA.', 'STEAMED TO PERFECTION!', "I'M STARCH-STRUCK!", 'SHORT GRAIN, LONG CAREER!',
    'EVERY GRAIN COUNTS. MARCUS COUNTS THEM TWICE.', 'THAT RICE WAS A BIT CORNY. WAIT, WRONG GRAIN.',
  ],
  bowl: [
    'BOWLED OVER BY THIS ONE!', "A WHOLE BOWL? I'M RICE-ING TO THE OCCASION!", 'RICE IS NICE, BUT A PREMIERE IS TWICE AS NICE.',
    'THIS BOWL DESERVES ITS OWN CLOSE-UP.', 'BOWL-D MOVE, LEAVING THAT LYING AROUND.', 'A BOWL! MY BUDGET JUST WENT BLOCKBUSTER.',
  ],
  heart: [
    'A HEART-FELT PERFORMANCE!', 'I NEEDED THAT. EMOTIONALLY AND PHYSICALLY.', 'MY HEART GOES ON! ...WRONG MOVIE.',
    'HEALTHY AGAIN. THE SHOW MUST GO ON!',
  ],
  cooker: [
    'A GOLDEN RICE COOKER! THE OSCAR OF KITCHENWARE!', "GOLDEN COOKER! NOW THAT'S A PROP WITH A STORY.",
    "SOMEBODY CALL MARCUS. THIS IS A COLLECTOR'S ITEM!",
  ],
  kill: [
    'CUT!', "THAT'S A WRAP FOR YOU!", 'AND... SCENE!', "YOU'VE BEEN EDITED OUT.", 'EXIT, STAGE LEFT!',
    'YOUR CONTRACT HAS BEEN TERMINATED.', 'ROTTEN REVIEW: ZERO STARS FOR YOU.', 'YOU JUST GOT CLAPPER-BOARDED.',
    "DON'T CALL US, WE'LL CALL YOU.", 'THAT ROLE HAS BEEN RECAST.', 'STRAIGHT TO THE CUTTING ROOM FLOOR.', 'BOX OFFICE BOMB!',
    "SHOULD'VE READ THE SCRIPT.", 'PLOT TWIST: YOU LOSE.', 'BREAK A LEG! ...OH. YOU DID.', 'THANKS FOR AUDITIONING!',
    'SPOILER ALERT: I WIN.', 'THAT WAS YOUR FINAL TAKE.', 'YOUR SCENE STEALING DAYS ARE OVER.',
  ],
  hurt: [
    "OW! THAT WASN'T IN THE SCRIPT!", 'OUCH! I NEED A STUNT DOUBLE!', "I'LL... WALK IT OFF. DRAMATICALLY.",
    'MY AGENT WILL HEAR ABOUT THIS!', "EVERYBODY'S A CRITIC!", 'HEY! WATCH THE FACE, IT\'S MY GOOD ANGLE!',
    'THAT HURT MORE THAN A BAD REVIEW.', 'MEDIC! OR A MAKEUP ARTIST!', "I'M FINE! IT'S CALLED METHOD ACTING!",
    'OW, MY DIGNITY!', 'THAT ONE GOES IN THE BLOOPER REEL.', "NOTE TO SELF: DON'T DO THAT AGAIN.", 'WHO WROTE THIS SCENE?!',
  ],
  dash: ['TAKE TWO!', 'REWIND!', 'FAST FORWARD!', "LET'S TRY THAT AGAIN, FASTER!"],
  special: ['STRIKE A POSE!', 'BEHOLD... MY DRAMATIC POSE!', 'THE SPOTLIGHT IS MINE!', 'FREEZE FRAME!', "NOBODY MOVE. I'M ACTING."],
  checkpoint: ['CAMERA ROLLING! THANKS, AYDEN.', 'SAVED BY THE SHOT!', 'IF I MESS UP, WE FIX IT IN POST.'],
  assist: ['CRAIG! STUNT ASSIST!', 'CUE THE STUNT GUY!', 'BRING IN THE PROFESSIONAL!'],
  wave: ["MORE EXTRAS? I DON'T HAVE THE BUDGET FOR THIS!", 'HERE COMES THE CROWD SCENE!', 'PLACES, EVERYONE! FIGHT SCENE!',
    "THEY'RE HERE FOR MY AUTOGRAPH. AGGRESSIVELY."],
  clear: ['CUT! PRINT IT!', "THAT SCENE'S IN THE CAN!", 'MOVING ON TO THE NEXT SHOT!', 'ONE TAKE WONDER!'],
  preboss: ["THIS IS MY BIG SCENE. DON'T UPSTAGE ME.", 'FINAL ACT! CUE THE DRAMATIC MUSIC!',
    'BOSS FIGHT? I WAS BORN FOR THE CLIMAX.', 'TIME TO FACE MY TOUGHEST CRITIC.'],
  bossdown: ['THAT BOSS WAS A REAL CUT ABOVE... THE REST.', 'AND THE AWARD FOR BEST BOSS DEFEAT GOES TO... ME!',
    "THAT'S A WRAP! PRINT IT!", "STANDING OVATION, PLEASE. I'LL WAIT.", 'THAT WAS A BLOCKBUSTER PERFORMANCE!',
    'BOSS? MORE LIKE LOST.'],
  secret: ['A SECRET! THE DIRECTOR\'S CUT HAS EXTRA SCENES!', 'BEHIND THE SCENES FOOTAGE!'],
};

// Never repeats the same line back to back; shuffles per category.
export const Joker = {
  last: null, bags: {},
  line(cat) {
    const src = JOKES[cat];
    if (!src || !src.length) return null;
    let bag = this.bags[cat];
    if (!bag || !bag.length) {
      bag = this.bags[cat] = src.slice().sort(() => Math.random() - 0.5);
      if (bag[bag.length - 1] === this.last && bag.length > 1) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    let l = bag.pop();
    if (l === this.last && bag.length) { const alt = bag.pop(); bag.unshift(l); l = alt; }
    this.last = l;
    return l;
  },
};

export const SPEAKERS = {
  josh: 'JOSH', craig: 'CRAIG TYLER', marcus: 'MARCUS BATSHON', ayden: 'AYDEN TIPLER', finn: 'FINN CRONIN',
  sebastian: 'SEBASTIAN HILI', finalcut: 'MAX FINAL CUT', finnAlien: '"ZORP" (FINN)', criticBoss: 'THE HARSH CRITIC',
  spotlight: 'SPOTLIGHT SAM', brutus: 'BOOM MIC BRUTUS', rack: 'PHANTOM COSTUME RACK', wraith: 'THE WARDROBE WRAITH',
  mech: 'MK-II MALFUNCTION', tumbleking: 'THE TUMBLE KING', dusty: 'DEADEYE DUSTY', papprime: 'PAPARAZZO PRIME',
};

// Ayden speaks rarely: one hint the first time you hit a checkpoint in each scene.
export const AYDEN_HINTS = [
  'ROLLING. FALL DOWN, YOU START FROM HERE.',
  'DASH GOES THROUGH THINGS.',
  "SOME WALLS AREN'T WALLS.",
  'POSE WHEN THEY CROWD YOU.',
  'BREATHE. THEN JUMP.',
  'LAST TAKE. MAKE IT COUNT.',
];

export const SEB_LINES = [
  "OH. HI. I'VE BEEN HERE THE WHOLE TIME.",
  "I'M NOT HIDING. I'M A VERY COMMITTED EXTRA.",
  "NICE SET. VERY FAKE. I LOVE IT.",
  "DON'T MIND ME. I'M THE BOOM MIC'S EMOTIONAL SUPPORT.",
  'YEEHAW. ...THAT WAS MY WHOLE LINE.',
  "I'VE SEEN YOUR MOVIE'S ENDING. NO SPOILERS. IT'S GOOD THOUGH.",
];
export const SEB_ALL = "SIX TIMES. THAT'S EITHER TALENT OR A WORRYING HOBBY. TAKE THIS GOLDEN CLAPPERBOARD.";

export const SHOP_LINES = {
  hello: ["WELCOME TO MARCUS'S PROP SHOP! RICE IN, PROPS OUT.", 'BACK AGAIN? I KNEW YOU COULDN\'T RESIST THE MERCH.',
    'FRESH PROPS, BARELY USED. MOSTLY.', 'EVERYTHING MUST GO! EXCEPT ME. I STAY.'],
  buy: ['EXCELLENT CHOICE. THAT PROP HAS SEEN THINGS.', 'PLEASURE DOING BUSINESS! NO REFUNDS.', "THIS ONE'S MY FAVOURITE. DON'T TELL THE OTHERS.",
    'SOLD! TREAT IT BETTER THAN THE LAST GUY DID.'],
  poor: ['NOT ENOUGH RICE, MY FRIEND. COME BACK WITH A BIGGER BOWL.', 'I TAKE RICE, NOT PROMISES.'],
  maxed: ["SOLD OUT! YOU'VE BOUGHT EVERY ONE I HAD."],
};

// In-level dialogue: before/after mini-bosses and bosses
export const BOSS_TALK = {
  spotlight: {
    intro: [{ s: 'josh', t: 'A RUNAWAY SPOTLIGHT? I USUALLY LOVE BEING IN THE SPOTLIGHT...' }, { s: 'josh', t: '...BUT NOT WHEN IT SHOOTS BACK.' }],
    outro: [{ s: 'josh', t: 'LIGHTS OUT! TOO BRIGHT FOR YOUR OWN GOOD.' }],
  },
  harshCritic: {
    intro: [{ s: 'criticBoss', t: 'I AM THE HARSH CRITIC. I HAVE NEVER LIKED ANYTHING. EVER.' }, { s: 'criticBoss', t: 'YOUR FILM? ONE STAR. AND THAT STAR IS FOR THE SNACKS.' },
      { s: 'josh', t: "YOU HAVEN'T EVEN SEEN IT!" }, { s: 'criticBoss', t: "I DON'T NEED TO. I'VE READ FINAL CUT'S NOTES." }],
    outro: [{ s: 'criticBoss', t: 'HMPH. FINE. TWO STARS. ...TWO AND A HALF.' }, { s: 'josh', t: 'SCENE ONE IS IN THE CAN!' }],
  },
  craig: {
    intro: [{ s: 'craig', t: 'HOLD IT! NOBODY DOES STUNTS ON MY BACKLOT WITHOUT PASSING THE CRAIG TYLER TEST.' },
      { s: 'josh', t: "IS IT A WRITTEN TEST? PLEASE SAY IT'S A WRITTEN TEST." }, { s: 'craig', t: "IT'S A FIGHTING TEST. RELAX, I'LL GO EASY ON YOU. ...ISH." }],
    outro: [{ s: 'craig', t: 'HA! NOT BAD, KID! YOU TOOK THOSE FALLS LIKE A PRO.' }, { s: 'craig', t: "ALRIGHT, I'M IN. FINAL CUT'S GOONS TRASHED MY STUNT PIT ANYWAY." },
      { s: 'craig', t: "HIT {assist} WHEN YOU'RE IN TROUBLE AND I'LL COME CRASHING IN. ONCE PER SCENE. LITERALLY CRASHING." },
      { s: 'josh', t: "A STUNT ASSIST! CRAIG, YOU'RE STUNT-SATIONAL." }, { s: 'craig', t: "YEAH, YEAH. DON'T MAKE IT WEIRD." }],
  },
  brutus: {
    intro: [{ s: 'brutus', t: 'THIS STREET IS CLOSED FOR A SEQUEL SHOOT. BOOM MIC BRUTUS SAYS SO.' }, { s: 'josh', t: "YOUR MIC IS IN THE SHOT, BY THE WAY." }, { s: 'brutus', t: 'WHAT?! ...GET HIM!' }],
    outro: [{ s: 'brutus', t: 'I JUST... WANTED TO BE HEARD.' }, { s: 'josh', t: "THAT'S A WRAP ON SCENE TWO!" }],
  },
  rack: {
    intro: [{ s: 'josh', t: 'A HAUNTED COSTUME RACK. OF COURSE. EVERY PRODUCTION HAS ONE.' }],
    outro: [{ s: 'josh', t: 'WARDROBE MALFUNCTION, HANDLED.' }],
  },
  wraith: {
    intro: [{ s: 'wraith', t: 'WHOOOO DARES TO SHOOT A SCENE IN MY WARDROBE?' }, { s: 'josh', t: "I'M JUST HERE TO TRY ON A HAT, HONESTLY." },
      { s: 'wraith', t: 'NO ONE TRIES ON MY HATS. FINAL CUT PROMISED ME A STARRING ROLE IN HAUNTED 9!' }],
    outro: [{ s: 'wraith', t: 'MY... HEMLINE... IS RUINED...' }, { s: 'josh', t: 'SCENE THREE! SPOOKY, BUT DONE.' }],
  },
  finn: {
    intro: [{ s: 'finnAlien', t: 'GREETINGS, EARTHLING. I AM ZORP OF THE NINTH NEBULA.' }, { s: 'josh', t: 'FINN? IS THAT YOU IN THE ALIEN SUIT?' },
      { s: 'finnAlien', t: "THERE IS NO FINN. ONLY ZORP. I'VE BEEN IN CHARACTER FOR THREE DAYS." },
      { s: 'finnAlien', t: 'FINAL CUT PROMISED ME THE LEAD IN HIS NEXT SEQUEL. ALL I HAVE TO DO IS STOP YOUR SCENE!' },
      { s: 'josh', t: 'A SEQUEL TO WHAT?' }, { s: 'finnAlien', t: "...HE DIDN'T SAY. DEFEND YOURSELF!" }],
    outro: [{ s: 'finnAlien', t: 'OKAY, OKAY! BREAKING CHARACTER! MY ANTENNAE ARE BENT.' },
      { s: 'finn', t: "THAT WAS THE BEST SCENE PARTNER I'VE EVER HAD. FINAL CUT NEVER EVEN LEARNED MY NAME." },
      { s: 'josh', t: 'THEN JOIN MY CAST. CO-STAR BILLING. YOUR NAME RIGHT NEXT TO MINE.' },
      { s: 'finn', t: '...ABOVE YOURS?' }, { s: 'josh', t: 'NEXT TO.' },
      { s: 'finn', t: "DEAL! I'LL BE YOUR UNDERSTUDY. IF YOU EVER GO DOWN, I'LL STEP IN. ONCE PER SCENE." }],
  },
  mech: {
    intro: [{ s: 'mech', t: 'UNIT MK-II ONLINE. DIRECTIVE: DELETE ORIGINAL CONTENT. BZZT.' }, { s: 'josh', t: 'A ROBOT WITH NOTES. MY WORST NIGHTMARE.' }],
    outro: [{ s: 'mech', t: 'ERROR... ERROR... ENJOYED... FILM...' }, { s: 'josh', t: 'SCENE FOUR, BEAMED UP!' }],
  },
  tumbleking: {
    intro: [{ s: 'josh', t: 'IS THAT... A TUMBLEWEED WITH A CROWN?' }, { s: 'tumbleking', t: 'ALL HAIL THE TUMBLE KING! ROLL WITH IT, OR GET ROLLED!' }],
    outro: [{ s: 'josh', t: 'LONG LIVE THE KING. SOMEWHERE ELSE, PLEASE.' }],
  },
  dusty: {
    intro: [{ s: 'dusty', t: 'THEY CALL ME DEADEYE DUSTY. BEST STUNT DOUBLE IN THE WEST.' }, { s: 'josh', t: "WHO ARE YOU DOUBLING FOR?" },
      { s: 'dusty', t: "...MYSELF. IT'S A LONG STORY. DRAW, KID!" }],
    outro: [{ s: 'dusty', t: "WELL SHUCKS. YOU'RE QUICKER THAN A SHOOTING SCRIPT." }, { s: 'craig', t: "THAT'S MY BOY! THAT FALL WAS TEXTBOOK!" },
      { s: 'josh', t: 'SCENE FIVE! ONE MORE TO GO!' }],
  },
  papprime: {
    intro: [{ s: 'papprime', t: 'CLICK CLICK CLICK! SMILE FOR THE TABLOIDS, NOBODY!' }, { s: 'josh', t: "NOT NOW, I'M HAVING A HAIR DAY." }],
    outro: [{ s: 'josh', t: "NO PHOTOS. I'M SAVING MY FACE FOR THE BIG SCREEN." }],
  },
  finalcut: {
    intro: [{ s: 'finalcut', t: 'SO THE LITTLE DIRECTOR MADE IT TO THE TOP OF MY TOWER.' },
      { s: 'finalcut', t: 'DO YOU KNOW WHAT AUDIENCES WANT, BOY? THE SAME THING. FOREVER.' },
      { s: 'josh', t: 'AUDIENCES WANT TO FEEL SOMETHING. YOUR MOVIES MAKE ME FEEL LIKE I\'M ON HOLD.' },
      { s: 'finalcut', t: "THEN LET'S SEE HOW YOU HANDLE... THE FINAL CUT!" }],
    phase2: 'BEHOLD THE GREENLIGHT MACHINE! IT ONLY APPROVES SEQUELS!',
    phase3: "IF I CAN'T CUT YOUR FILM, I'LL PROJECT MYSELF INTO IT!",
    outro: [{ s: 'finalcut', t: 'MY... MY NOTES... MAYBE ORIGINAL STORIES ARE... KIND OF FUN?' },
      { s: 'josh', t: "COME TO THE PREMIERE. I'LL SAVE YOU A SEAT." }, { s: 'josh', t: '...IN THE BACK.' }],
  },
};

// Cutscenes. cast: actor -> x. Steps: {s,t} say, {n} narrate, {enter,x}, {exit}, {holo,x}, {fx}, {title,sub}, {movie}
export const CUTSCENES = {
  opening: { bg: 0, music: 'cutscene', cast: { josh: 120 }, steps: [
    { n: 'RELIVERSE STUDIOS. HOME OF THE YOUNG DIRECTORS PREMIERE.' },
    { n: 'AND THIS IS JOSH. HE HAS ONE DREAM: TO DIRECT A MOVIE THE WHOLE WORLD WILL SEE.' },
    { s: 'josh', t: 'PICTURE IT... MY NAME, IN LIGHTS! WELL, IN A FONT. A VERY DRAMATIC FONT.' },
    { enter: 'ayden', x: 175 },
    { s: 'josh', t: 'AYDEN! MY CAMERA OPERATOR! READY TO ROLL?' },
    { s: 'ayden', t: 'ALWAYS.' },
    { enter: 'finn', x: 230 },
    { s: 'finn', t: "OI, JOSH! HEARD YOU ENTERED THE PREMIERE. BOLD. BUT EVERYONE KNOWS I'M THE STAR OF THIS DRAMA CLUB." },
    { s: 'josh', t: 'FINN, YOU CAN BE THE STAR... OF THE BLOOPER REEL.' },
    { fx: 'flash' },
    { holo: 'finalcut', x: 160 },
    { s: 'finalcut', t: 'ATTENTION, LITTLE DREAMERS. I AM MAX FINAL CUT, HEAD OF MEGAPLEX PICTURES.' },
    { s: 'finalcut', t: 'ORIGINALS ARE RISKY. SEQUELS ARE FOREVER. SO MY STUDIO NOTES ARE SHUTTING DOWN EVERY SET ON THIS LOT.' },
    { s: 'finalcut', t: "NO SETS, NO SCENES. NO SCENES, NO PREMIERE. THAT'S A WRAP ON YOUR LITTLE DREAM." },
    { exit: 'finalcut' }, { fx: 'flash' },
    { s: 'josh', t: 'RUDE. AND ALSO... A TERRIBLE PITCH.' },
    { s: 'finn', t: "HE CAN'T DO THAT! ...CAN HE DO THAT? I'M GOING TO GO... THINK ABOUT MY CAREER." },
    { exit: 'finn' },
    { s: 'josh', t: 'NOT IF WE SHOOT EVERY SCENE FIRST. SIX SETS. ONE MOVIE. OPENING NIGHT.' },
    { s: 'ayden', t: "I'LL KEEP THE CAMERA ROLLING. FALL DOWN, YOU START FROM MY LAST SHOT." },
    { s: 'josh', t: 'CHECKPOINTS! AYDEN, YOU LEGEND.' },
    { s: 'josh', t: 'PLACES, EVERYONE! LIGHTS... CAMERA... JUMP!' },
  ] },
  intro0: { bg: 0, music: 'cutscene', cast: { josh: 130, ayden: 190 }, steps: [
    { title: 'SCENE 1', sub: 'SCHOOL DRAMA HALL' },
    { s: 'josh', t: 'THE DRAMA HALL. WHERE IT ALL BEGAN. AND WHERE THE CRITICS HANG OUT, APPARENTLY.' },
    { s: 'ayden', t: '{jump} TO JUMP. AGAIN IN THE AIR. {attack} TO SWING. {throw} TO THROW.' },
    { s: 'josh', t: 'AND {dash} TO DASH! I CALL IT "TAKE TWO". {special} IS MY DRAMATIC POSE.' },
  ] },
  outro0: { bg: 0, music: 'shop', cast: { josh: 120 }, steps: [
    { enter: 'marcus', x: 190 },
    { s: 'marcus', t: "JOSH! OVER HERE! MARCUS'S PROP SHOP IS OPEN FOR BUSINESS." },
    { s: 'marcus', t: "BRING ME RICE AND I'LL BRING YOU PROPS. HEARTS, STUNT BOOTS, A TOUGHER CLAPPERBOARD... THE WORKS." },
    { s: 'josh', t: "YOU TAKE RICE? MARCUS, THAT'S GRAIN-IUS." },
    { s: 'marcus', t: "IT'S THE ONLY CURRENCY THAT NEVER GOES STALE. ...OKAY, IT DOES. SPEND IT FAST." },
  ] },
  intro1: { bg: 1, music: 'cutscene', cast: { josh: 130, ayden: 70 }, steps: [
    { title: 'SCENE 2', sub: 'BACKLOT STREET' },
    { s: 'josh', t: 'BACKLOT STREET. FAKE BUILDINGS, REAL PROBLEMS.' },
    { s: 'josh', t: 'WORD IS THE STUNT COORDINATOR HERE IS... INTENSE.' },
    { s: 'ayden', t: 'HE IS.' },
  ] },
  outro1: { bg: 1, music: 'cutscene', cast: { josh: 120, craig: 175 }, steps: [
    { s: 'craig', t: "THAT BOOM MIC GUY NEVER STOOD A CHANCE. WHERE'D YOU LEARN TO FALL LIKE THAT?" },
    { s: 'josh', t: 'DRAMA CLUB. WE FALL OVER A LOT. MOSTLY ON PURPOSE.' },
    { s: 'craig', t: "HA! NEXT STOP'S THE HORROR SET. DON'T SCREAM. ...OKAY, YOU CAN SCREAM A LITTLE." },
  ] },
  intro2: { bg: 2, music: 'cutscene', cast: { josh: 140 }, steps: [
    { title: 'SCENE 3', sub: 'HAUNTED HORROR SET' },
    { s: 'josh', t: "THE HAUNTED HORROR SET. I'M NOT SCARED. MY KNEES ARE JUST... METHOD ACTING." },
    { enter: 'craig', x: 200 },
    { s: 'craig', t: 'HAUNTED COSTUMES, PROP SKELETONS. ALL FINAL CUT\'S DOING. SMACK \'EM.' },
  ] },
  outro2: { bg: 2, music: 'cutscene', cast: { josh: 120, ayden: 180 }, steps: [
    { s: 'josh', t: 'THREE SCENES DOWN. HALFWAY THERE!' },
    { s: 'ayden', t: '...' },
    { s: 'ayden', t: 'GOOD TAKE.' },
    { s: 'josh', t: 'AYDEN SAID "GOOD TAKE"! I\'M FRAMING THAT.' },
  ] },
  intro3: { bg: 3, music: 'cutscene', cast: { josh: 130, ayden: 70 }, steps: [
    { title: 'SCENE 4', sub: 'SCI-FI SPACESHIP SET' },
    { s: 'josh', t: 'THE SPACESHIP SET! ONE SMALL STEP FOR JOSH, ONE GIANT LEAP FOR CINEMA.' },
    { s: 'ayden', t: "FINN'S HERE. IN A COSTUME." },
    { s: 'josh', t: "OF COURSE HE IS." },
  ] },
  outro3: { bg: 3, music: 'cutscene', cast: { josh: 110, finn: 170 }, steps: [
    { s: 'finn', t: 'SO! AS YOUR NEW CO-STAR, I HAVE SOME NOTES ON MY CHARACTER\'S MOTIVATION...' },
    { s: 'josh', t: 'YOUR MOTIVATION IS "STOP FINAL CUT".' },
    { s: 'finn', t: 'OOH. GRITTY. I LOVE IT.' },
  ] },
  intro4: { bg: 4, music: 'cutscene', cast: { josh: 120, craig: 190 }, steps: [
    { title: 'SCENE 5', sub: 'WESTERN STUNT SET' },
    { s: 'craig', t: 'THIS IS MY SET, KID. REAL STUNTS. BIG FALLS. WATCH THE TUMBLEWEEDS, THEY BITE.' },
    { s: 'josh', t: "TUMBLEWEEDS DON'T BITE." },
    { s: 'craig', t: "THESE ONES DO. FINAL CUT'S PEOPLE GLUED TEETH ON THEM." },
  ] },
  outro4: { bg: 4, music: 'cutscene', cast: { josh: 100, craig: 160, finn: 210 }, steps: [
    { s: 'finn', t: 'ONE SCENE LEFT! THE PREMIERE ITSELF!' },
    { s: 'craig', t: "FINAL CUT'S HOLED UP IN THE STUDIO TOWER. HE'LL THROW EVERYTHING AT YOU." },
    { s: 'josh', t: "THEN LET'S GIVE HIM A SHOW." },
  ] },
  intro5: { bg: 5, music: 'cutscene', cast: { josh: 90, ayden: 140, finn: 185, craig: 230 }, steps: [
    { title: 'SCENE 6', sub: 'THE PREMIERE: RED CARPET & STUDIO TOWER' },
    { enter: 'marcus', x: 275 },
    { s: 'marcus', t: "WE'LL SAVE YOU A SEAT. FRONT ROW. I BROUGHT SNACKS." },
    { s: 'finn', t: "BREAK A LEG! ...NOT LITERALLY. WE'VE HAD ENOUGH OF THAT." },
    { s: 'craig', t: 'GO GET HIM, KID.' },
    { s: 'ayden', t: 'ROLLING.' },
    { s: 'josh', t: 'FINAL SCENE. LIGHTS... CAMERA... JUMP!' },
  ] },
  ending: { bg: 'theatre', music: 'cutscene', cast: {}, audience: true, steps: [
    { n: 'OPENING NIGHT. RELIVERSE STUDIOS. EVERY SEAT IS FULL.' },
    { s: 'marcus', t: 'FRONT ROW, BABY! I MADE THE POPCORN BUCKETS MYSELF. OUT OF PROPS.' },
    { s: 'craig', t: "NOBODY CRY. ...I'M NOT CRYING, YOU'RE CRYING." },
    { s: 'finn', t: "MY NAME IS ON THE POSTER. NEXT TO JOSH'S. I'M FRAMING IT." },
    { s: 'sebastian', t: "I'M IN THE BACK. AS USUAL." },
    { s: 'ayden', t: 'ROLL IT.' },
    { movie: true },
    { fx: 'applause' },
    { enter: 'josh', x: 160 },
    { s: 'josh', t: "I COULDN'T HAVE MADE THIS ALONE. CRAIG DID THE STUNTS. MARCUS MADE THE PROPS." },
    { s: 'josh', t: 'AYDEN SHOT EVERY FRAME. FINN STOLE EVERY SCENE.' },
    { s: 'josh', t: 'AND SEBASTIAN... WAS APPARENTLY THERE THE WHOLE TIME.' },
    { s: 'sebastian', t: 'HI.' },
    { holo: 'finalcut', x: 260 },
    { s: 'finalcut', t: '...FINE. IT WAS GOOD. IS THERE GOING TO BE A SEQUEL?' },
    { s: 'josh', t: "ONLY IF IT'S ORIGINAL." },
    { s: 'ayden', t: "THAT'S A WRAP." },
  ] },
};

export const MOVIE = [
  { bg: 0, t: 'SCENE 1: THE DRAMA HALL' }, { bg: 1, t: 'SCENE 2: BACKLOT BRAWL' }, { bg: 2, t: 'SCENE 3: A HAUNTING PERFORMANCE' },
  { bg: 3, t: 'SCENE 4: SPACE ODD-ACTOR' }, { bg: 4, t: 'SCENE 5: THE GOOD, THE BAD & THE STUNTY' }, { bg: 5, t: 'SCENE 6: THE FINAL CUT' },
];

export const CREDITS = [
  ['JOSH: LIGHTS, CAMERA, JUMP!', 'title'], ['', ''],
  ['DIRECTED BY', 'head'], ['JOSH', ''], ['', ''],
  ['STUNT COORDINATOR', 'head'], ['CRAIG TYLER', ''], ['', ''],
  ['PROPS & RICE ECONOMY', 'head'], ['MARCUS BATSHON', ''], ['', ''],
  ['DIRECTOR OF PHOTOGRAPHY', 'head'], ['AYDEN TIPLER', ''], ['', ''],
  ['CO-STAR (ALSO ZORP)', 'head'], ['FINN CRONIN', ''], ['', ''],
  ['THE WHOLE TIME', 'head'], ['SEBASTIAN HILI', ''], ['', ''],
  ['SPECIAL THANKS', 'head'], ['THE HARSH CRITIC (2 1/2 STARS)', ''], ['DEADEYE DUSTY', ''], ['MAX FINAL CUT (BACK ROW)', ''], ['', ''],
  ['MADE WITH', 'head'], ['HTML5 CANVAS + WEB AUDIO', ''], ['EVERY PIXEL & NOTE MADE IN CODE', ''], ['', ''],
  ['NO RICE WAS WASTED', 'head'], ['IN THE MAKING OF THIS FILM', ''], ['', ''], ['', ''],
  ["THAT'S A WRAP!", 'title'],
];
