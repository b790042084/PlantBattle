// state.js — 全局 DOM 引用与游戏状态

import { SLOTS, PLAYER_BASE_CARRY, gameConfig } from "./config.js";

// ─────────────────── Helper: build initial unlocked array ─
function buildUnlockedSlots() {
  var arr = Array(SLOTS).fill(false);
  (gameConfig.initialUnlockedSlots || [2, 7]).forEach(function(idx) {
    if (idx >= 0 && idx < SLOTS) arr[idx] = true;
  });
  return arr;
}

// ─────────────────── DOM refs ─────────────────────────
export const elLog           = document.getElementById("log");
export const elPhaseChip     = document.getElementById("phaseChip");
export const elRoundNum      = document.getElementById("roundNum");
export const elDayTimer      = document.getElementById("dayTimer");
export const elTimerChip     = document.getElementById("timerChip");
export const elLives         = document.getElementById("livesDisplay");
export const elScore         = document.getElementById("scoreDisplay");
export const elPlantingGrid  = document.getElementById("plantingGrid");
export const elBackpackItems = document.getElementById("backpackItems");
export const elBackpackCount = document.getElementById("backpackCount");
export const elCollect       = document.getElementById("collectionZone");
export const elBattleArea    = document.getElementById("battleArea");
export const elCollectHint   = document.getElementById("collectionHint");
export const elLibraryList   = document.getElementById("plantLibraryList");
export const elLibraryBody   = document.getElementById("libraryBody");
export const elLibraryToggle = document.getElementById("libraryToggle");
export const elVersion       = document.getElementById("versionDisplay");

// Monster library
export const elMonsterLibraryList     = document.getElementById("monsterLibraryList");
export const elMonsterLibraryBody     = document.getElementById("monsterLibraryBody");
export const elMonsterLibraryToggle   = document.getElementById("monsterLibraryToggle");

// Wave library
export const elWaveLibraryList        = document.getElementById("waveLibraryList");
export const elWaveLibraryBody        = document.getElementById("waveLibraryBody");
export const elWaveLibraryToggle      = document.getElementById("waveLibraryToggle");

// Plant spawn library
export const elPlantSpawnLibraryList  = document.getElementById("plantSpawnLibraryList");
export const elPlantSpawnLibraryBody  = document.getElementById("plantSpawnLibraryBody");
export const elPlantSpawnLibraryToggle = document.getElementById("plantSpawnLibraryToggle");

// Round monster config
export const elRoundConfigBody   = document.getElementById("roundConfigBody");
export const elRoundConfigToggle = document.getElementById("roundConfigToggle");
export const elRoundConfigForm   = document.getElementById("roundConfigForm");

// Game basic config
export const elGameConfigBody   = document.getElementById("gameConfigBody");
export const elGameConfigToggle = document.getElementById("gameConfigToggle");
export const elGameConfigForm   = document.getElementById("gameConfigForm");

// Gold & shop
export const elGold             = document.getElementById("goldDisplay");
export const elShopPlantUpgrades = document.getElementById("shopPlantUpgrades");

// ─────────────────── Game State ──────────────────────
export const gs = {
  phase:       "idle",
  round:       0,
  score:       0,
  lives:       5,
  gold:        0,
  phaseLeft:   0,
  phaseHandle: null,
  spawnHandle: null,

  spawned:     [],
  backpack:    [],    // { id, plantIdx, stage, plantLevel }
  selectedId:  null,

  grid:     Array(SLOTS).fill(null),
  monsters: [],
  mQueue:   [],
  nextSpawn: 0,

  animId:     null,
  lastFrame:  0,
  lastCombat: 0,
  lastPoison: 0,
  lastGoldTick: 0,
  nightHandle: null,

  // Player character for collection
  player: {
    x: 50,  // percentage
    y: 95,  // percentage (starting at bottom)
    row: 14, // which stripe row (0-14) - starting at bottom
    size: 40, // px
    speed: 0.8, // percentage per frame at 60fps
    isJumping: false,
    jumpProgress: 0,
    maxCarry: PLAYER_BASE_CARRY,
    carryLevel: 0,
  },
  keys: {},
  waves: [], // active waves in collection zone
  waveSpawnTimer: 0,
  waveHitCooldown: 0, // timestamp until which player is immune to wave damage (0 = no immunity)
  carried: [], // plants carried above player head, not yet in backpack
  currentPlantSpawnConfig: null, // Currently active plant spawn configuration

  // Planting zone upgrades
  plantingZoneLevel: 0,
  activeSlots: gameConfig.zoneBaseSlots,
  unlockedSlots: buildUnlockedSlots(),
  slotUnlockCredits: 0,
};

// ─────────────────── Keyboard Controls ───────────────
document.addEventListener("keydown", function(e) {
  const key = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    e.preventDefault();
    gs.keys[key] = true;
  }
  // Jump with spacebar - always prevent default to avoid page scroll
  if (e.code === "Space" || e.key === " ") {
    e.preventDefault();
    if (gs.phase === "day" && !gs.player.isJumping) {
      gs.player.isJumping = true;
      gs.player.jumpProgress = 0;
    }
  }
});

document.addEventListener("keyup", function(e) {
  const key = e.key.toLowerCase();
  gs.keys[key] = false;
});
