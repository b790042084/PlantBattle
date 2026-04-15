// =============================================================
//  植物战队 — 日夜循环防守模式
//  Day phase : collect plants in 收集区 (30 s)
//  Night phase: monsters advance from 刷怪区 into 种植区
//               planted plants auto-attack using full stats
// =============================================================

const STORAGE_KEY = "plant-battle-td-v1";
const APP_VERSION = "v0.0.0-86a9c7f";

// ─────────────────── Plant Library ───────────────────
const plantLibrary = [
  { name: "坚果墙",   image: "", role: "defender", attackMode: "melee",  hp: 1800, atk:  60, df: 80, crit: 0.08, critDmg: 1.5, dodge: 0.05, skillName: "硬壳格挡", skillCoef: 1.2, skillCd: 2, skillType: "shield"  },
  { name: "豌豆射手", image: "", role: "attacker", attackMode: "ranged", hp:  900, atk: 180, df: 30, crit: 0.20, critDmg: 1.5, dodge: 0.00, skillName: "三连豌豆", skillCoef: 1.8, skillCd: 2, skillType: "normal"  },
  { name: "寒冰射手", image: "", role: "attacker", attackMode: "ranged", hp: 1000, atk: 150, df: 40, crit: 0.15, critDmg: 1.5, dodge: 0.00, skillName: "寒冰重击", skillCoef: 1.6, skillCd: 1, skillType: "slow"    },
  { name: "铁桶坚果", image: "", role: "defender", attackMode: "melee",  hp: 2000, atk:  70, df: 90, crit: 0.08, critDmg: 1.5, dodge: 0.03, skillName: "反伤硬化", skillCoef: 1.2, skillCd: 2, skillType: "shield"  },
  { name: "毒液花",   image: "", role: "attacker", attackMode: "area",   hp:  850, atk: 170, df: 35, crit: 0.18, critDmg: 1.5, dodge: 0.00, skillName: "毒刺爆发", skillCoef: 1.9, skillCd: 3, skillType: "poison"  },
  { name: "机枪豌豆", image: "", role: "attacker", attackMode: "ranged", hp: 1100, atk: 140, df: 45, crit: 0.12, critDmg: 1.5, dodge: 0.00, skillName: "弹幕扫射", skillCoef: 1.7, skillCd: 2, skillType: "normal"  },
];

// ─────────────────── Monster Types ───────────────────
const monsterTypes = [
  { name: "普通僵尸", emoji: "🧟", hp: 300,  atk:  35, speed: 0.27, attackInterval: 1600, reward: 10 },
  { name: "快速僵尸", emoji: "🏃", hp: 200,  atk:  25, speed: 0.55, attackInterval: 1200, reward: 15 },
  { name: "铁桶僵尸", emoji: "🪣", hp: 650,  atk:  55, speed: 0.17, attackInterval: 2000, reward: 25 },
  { name: "巨型僵尸", emoji: "👾", hp: 1100, atk:  80, speed: 0.13, attackInterval: 2500, reward: 40 },
];

// ─────────────────── Wave Types ─────────────────────
const waveTypes = [
  { name: "缓慢海浪", speed: 0.2,  spawnInterval: 7000, weight: 20, color: "#0096ff" },
  { name: "普通海浪", speed: 0.4,  spawnInterval: 5000, weight: 50, color: "#0096ff" },
  { name: "快速海浪", speed: 0.6,  spawnInterval: 3500, weight: 20, color: "#ff6600" },
  { name: "极速海浪", speed: 0.9,  spawnInterval: 2000, weight: 10, color: "#ff0033" },
];

function sanitizeWave(w) {
  w.name          = String(w.name || "海浪").trim() || "海浪";
  w.speed         = Math.max(0.05,            toNum(w.speed,  0.4));
  w.spawnInterval = Math.max(500, Math.floor(toNum(w.spawnInterval, 5000)));
  w.weight        = Math.max(0,   Math.floor(toNum(w.weight,   50)));
  w.color         = String(w.color || "#0096ff").trim() || "#0096ff";
}
waveTypes.forEach(sanitizeWave);

// ─────────────────── Plant Spawn Configs ───────────────
const plantSpawnConfigs = [
  { name: "缓慢刷新", spawnInterval: 8000,  weight: 15 },
  { name: "普通刷新", spawnInterval: 5500,  weight: 50 },
  { name: "快速刷新", spawnInterval: 3000,  weight: 20 },
  { name: "极速刷新", spawnInterval: 1500,  weight: 15 },
];

function sanitizePlantSpawn(p) {
  p.name          = String(p.name || "植物刷新").trim() || "植物刷新";
  p.spawnInterval = Math.max(500, Math.floor(toNum(p.spawnInterval, 5500)));
  p.weight        = Math.max(0,   Math.floor(toNum(p.weight,   50)));
}
plantSpawnConfigs.forEach(sanitizePlantSpawn);

// ─────────────────── Wave List Config ────────────────
// waveList[i] = array of { monsterIdx, count } for wave i+1
const waveList = [
  [{ monsterIdx: 0, count: 5 }],
  [{ monsterIdx: 0, count: 4 }, { monsterIdx: 1, count: 2 }],
  [{ monsterIdx: 0, count: 3 }, { monsterIdx: 2, count: 2 }, { monsterIdx: 3, count: 1 }],
];

function sanitizeWaveEntry(entry) {
  entry.monsterIdx = Math.max(0, Math.floor(toNum(entry.monsterIdx, 0)));
  entry.count      = Math.max(0, Math.floor(toNum(entry.count, 0)));
}

function sanitizeMonster(m) {
  m.name           = String(m.name  || "怪物").trim() || "怪物";
  m.emoji          = String(m.emoji || "🧟").trim()  || "🧟";
  m.hp             = Math.max(1,   Math.floor(toNum(m.hp,   300)));
  m.atk            = Math.max(1,   Math.floor(toNum(m.atk,   35)));
  m.speed          = Math.max(0.01,            toNum(m.speed,  0.27));
  m.attackInterval = Math.max(100, Math.floor(toNum(m.attackInterval, 1600)));
  m.reward         = Math.max(0,   Math.floor(toNum(m.reward,  10)));
}
monsterTypes.forEach(sanitizeMonster);

// ─────────────────── Game Config ─────────────────────
const gameConfig = { dayDuration: 30, duskDuration: 15, nightDuration: 0, initialLives: 5 };
function sanitizeGameConfig(c) {
  c.dayDuration   = Math.max(5,  Math.floor(toNum(c.dayDuration,   30)));
  c.duskDuration  = Math.max(5,  Math.floor(toNum(c.duskDuration,  15)));
  c.nightDuration = Math.max(0,  Math.floor(toNum(c.nightDuration,  0)));
  c.initialLives  = Math.max(1,  Math.floor(toNum(c.initialLives,   5)));
}
sanitizeGameConfig(gameConfig);

// ─────────────────── Constants ───────────────────────
const LANES             = 5;
const ROWS              = 2;
const SLOTS             = LANES * ROWS;
const SPAWN_INTERVAL    = 5500;
const MAX_SPAWNED       = 5;
const COMBAT_TICK       = 900;
const POISON_TICK       = 1200;
const MONSTER_ZONE_H    = 130;
const PLANTING_ROW_H    = 130;
const BATTLE_H          = MONSTER_ZONE_H + ROWS * PLANTING_ROW_H; // 390
const Y_ROW                  = [1.0, 2.0];
const Y_BASE                 = 3.0;
const ROUND_SCALE_FACTOR     = 0.15;  // HP/ATK difficulty increase per round
const DEFENSE_REDUCTION      = 0.45;  // fraction of plant DEF applied to monster ATK
const POISON_DMG_MULTIPLIER  = 0.25;  // poison DoT = attacker.atk × this
const POISON_DURATION_BONUS  = 2;     // extra ticks added on top of plant's skillCd
const SLOW_DURATION_MS       = 2000;  // ms per (skillCd + 1) unit for slow duration
const SHIELD_GAIN_MULTIPLIER = 0.85;  // shield gained = atk × skillCoef × this

const COLLECTION_ROWS = 15;  // Number of rows in collection zone
const STRIPE_HEIGHT = 100 / COLLECTION_ROWS;  // Height of each stripe (%)     

// Helper function to determine if a Y position is in a black stripe
function isBlackStripe(yPercent) {
  const stripeIndex = Math.floor(yPercent / STRIPE_HEIGHT);
  return stripeIndex % 2 === 1;  // Odd indices are black
}

// ─────────────────── Utility ─────────────────────────
let _id = 0;
const uid = () => ++_id;

function escHtml(t) {
  return String(t ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function toNum(v, fb) { const n = Number(v); return Number.isFinite(n) ? n : fb; }

function buildSvgFallback(name, role) {
  const bg  = role === "defender" ? "#8d6e63" : role === "support" ? "#6c5ce7" : "#2b8a3e";
  const txt = escHtml((name || "植").slice(0, 2));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="${bg}"/><text x="40" y="52" font-size="26" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif">${txt}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function getImg(p) {
  return p.image && String(p.image).trim() ? p.image.trim() : buildSvgFallback(p.name, p.role);
}

function sanitizePlant(p) {
  p.name       = String(p.name  || "植物").trim() || "植物";
  p.image      = String(p.image || "").trim();
  if (!["defender","attacker","support"].includes(p.role)) p.role = "attacker";
  if (!["melee","ranged","area"].includes(p.attackMode))   p.attackMode = p.role === "defender" ? "melee" : "ranged";
  p.hp       = Math.max(1,    Math.floor(toNum(p.hp,      1000)));
  p.atk      = Math.max(1,    Math.floor(toNum(p.atk,      100)));
  p.df       = Math.max(0,    Math.floor(toNum(p.df,         0)));
  p.crit     = Math.min(1, Math.max(0,   toNum(p.crit,    0.10)));
  p.critDmg  = Math.max(1,               toNum(p.critDmg,  1.5));
  p.dodge    = Math.min(.95, Math.max(0, toNum(p.dodge,   0.00)));
  p.skillName= String(p.skillName || "技能").trim() || "技能";
  p.skillCoef= Math.max(1,               toNum(p.skillCoef, 1.5));
  p.skillCd  = Math.max(0, Math.floor(   toNum(p.skillCd,    2)));
  if (!["normal","poison","shield","slow"].includes(p.skillType)) p.skillType = "normal";
}
plantLibrary.forEach(sanitizePlant);

function roleLabel(r) { return r === "defender" ? "防御" : r === "support" ? "辅助" : "输出"; }
function modeLabel(m) { return m === "melee" ? "近战" : m === "area" ? "范围" : "远程"; }

// ─────────────────── DOM refs ─────────────────────────
const elLog           = document.getElementById("log");
const elPhaseChip     = document.getElementById("phaseChip");
const elRoundNum      = document.getElementById("roundNum");
const elDayTimer      = document.getElementById("dayTimer");
const elTimerChip     = document.getElementById("timerChip");
const elLives         = document.getElementById("livesDisplay");
const elScore         = document.getElementById("scoreDisplay");
const elPlantingGrid  = document.getElementById("plantingGrid");
const elBackpackItems = document.getElementById("backpackItems");
const elBackpackCount = document.getElementById("backpackCount");
const elCollect       = document.getElementById("collectionZone");
const elBattleArea    = document.getElementById("battleArea");
const elCollectHint   = document.getElementById("collectionHint");
const elLibraryList   = document.getElementById("plantLibraryList");
const elLibraryBody   = document.getElementById("libraryBody");
const elLibraryToggle = document.getElementById("libraryToggle");
const elVersion       = document.getElementById("versionDisplay");

// Monster library
const elMonsterLibraryList     = document.getElementById("monsterLibraryList");
const elMonsterLibraryBody     = document.getElementById("monsterLibraryBody");
const elMonsterLibraryToggle   = document.getElementById("monsterLibraryToggle");

// Wave library
const elWaveLibraryList        = document.getElementById("waveLibraryList");
const elWaveLibraryBody        = document.getElementById("waveLibraryBody");
const elWaveLibraryToggle      = document.getElementById("waveLibraryToggle");

// Plant spawn library
const elPlantSpawnLibraryList  = document.getElementById("plantSpawnLibraryList");
const elPlantSpawnLibraryBody  = document.getElementById("plantSpawnLibraryBody");
const elPlantSpawnLibraryToggle = document.getElementById("plantSpawnLibraryToggle");

// Round monster config
const elRoundConfigBody   = document.getElementById("roundConfigBody");
const elRoundConfigToggle = document.getElementById("roundConfigToggle");
const elRoundConfigForm   = document.getElementById("roundConfigForm");

// Game basic config
const elGameConfigBody   = document.getElementById("gameConfigBody");
const elGameConfigToggle = document.getElementById("gameConfigToggle");
const elGameConfigForm   = document.getElementById("gameConfigForm");

// Show current version in the HUD
if (elVersion) elVersion.textContent = APP_VERSION;

// ─────────────────── Game State ──────────────────────
const gs = {
  phase:       "idle",
  round:       0,
  score:       0,
  lives:       5,
  phaseLeft:   0,
  phaseHandle: null,
  spawnHandle: null,

  spawned:     [],
  backpack:    [],
  selectedId:  null,

  grid:     Array(SLOTS).fill(null),
  monsters: [],
  mQueue:   [],
  nextSpawn: 0,

  animId:     null,
  lastFrame:  0,
  lastCombat: 0,
  lastPoison: 0,
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
  },
  keys: {},
  waves: [], // active waves in collection zone
  waveSpawnTimer: 0,
  waveHitCooldown: 0, // timestamp until which player is immune to wave damage (0 = no immunity)
  carried: [], // plants carried above player head, not yet in backpack
  currentPlantSpawnConfig: null, // Currently active plant spawn configuration
};

const SPAWN_ROW = 14; // Bottom row is the spawn/birth zone

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

// ─────────────────── Logging ─────────────────────────
function addLog(text, type) {
  if (type === undefined) type = "hit";
  const d = document.createElement("div");
  d.className   = "log-line log-" + type;
  d.textContent = text;
  elLog.appendChild(d);
  elLog.scrollTop = elLog.scrollHeight;
}

// ─────────────────── HUD ─────────────────────────────
function updateBackground() {
  const body = document.body;
  body.classList.remove("bg-day", "bg-dusk", "bg-night");

  if (gs.phase === "day") {
    body.classList.add("bg-day");
  } else if (gs.phase === "dusk") {
    body.classList.add("bg-dusk");
  } else if (gs.phase === "night") {
    body.classList.add("bg-night");
  }
}

function updateHUD() {
  elRoundNum.textContent = gs.round + (waveList.length > 0 ? " / " + waveList.length : "");
  if (elLives) elLives.textContent = gs.lives;
  if (elScore) elScore.textContent = gs.score;
  const labels = {
    idle:"等待开始",
    day:"白天 — 收集中",
    dusk:"黄昏 — 摆放植物",
    night:"夜晚 — 刷怪中",
    gameover:"游戏结束",
    victory:"🏆 通关胜利！"
  };
  elPhaseChip.textContent = labels[gs.phase] || gs.phase;
  elPhaseChip.className   = "chip phase-chip phase-" + gs.phase;

  const showTimer = gs.phase === "day" || gs.phase === "dusk";
  elTimerChip.style.display = showTimer ? "" : "none";
  if (showTimer) elDayTimer.textContent = gs.phaseLeft;

  // Update body background based on phase
  updateBackground();
}

// ─────────────────── Grid ────────────────────────────
function initGrid() {
  elPlantingGrid.innerHTML = "";
  for (let i = 0; i < SLOTS; i++) {
    const s = document.createElement("div");
    s.className    = "plant-slot";
    s.dataset.slot = i;
    s.addEventListener("click", onSlotClick);
    elPlantingGrid.appendChild(s);
  }
  renderGrid();
}

function renderGrid() {
  for (let i = 0; i < SLOTS; i++) {
    const el    = elPlantingGrid.children[i];
    if (!el) continue;
    const plant = gs.grid[i];
    const canHL = gs.selectedId !== null && !plant && gs.phase === "dusk";

    el.className = "plant-slot" +
      (plant ? " has-plant"      : "") +
      (canHL ? " slot-highlight" : "");

    if (plant) {
      const ratio = Math.max(0, plant.hp) / plant.maxHp;
      const cls   = ratio < 0.25 ? "crit" : ratio < 0.5 ? "low" : "";
      const pDef  = plantLibrary[plant.plantIdx];
      const img   = escHtml(getImg(pDef));
      const fb    = escHtml(buildSvgFallback(pDef.name, pDef.role));
      const shieldBadge = plant.shield > 0
        ? '<div class="slot-shield-badge">🛡' + plant.shield + "</div>" : "";
      const statusParts = [];
      if (plant.poisonTurns > 0) statusParts.push("💧" + plant.poisonTurns);
      if (plant.slowTurns   > 0) statusParts.push("❄"  + plant.slowTurns);
      el.innerHTML =
        shieldBadge +
        '<img class="slot-img" src="' + img + '" alt="' + escHtml(pDef.name) +
          '" onerror="this.onerror=null;this.src=\'' + fb + '\'">' +
        '<div class="slot-name">'   + escHtml(pDef.name) + "</div>" +
        '<div class="slot-hpbar"><div class="slot-hpfill ' + cls + '" style="width:' + (ratio*100) + '%"></div></div>' +
        '<div class="slot-hptext">' + Math.max(0,plant.hp) + "/" + plant.maxHp +
          (statusParts.length ? " · " + statusParts.join(" ") : "") + "</div>";
    } else {
      const col = i % LANES + 1;
      const row = Math.floor(i / LANES) + 1;
      el.innerHTML = '<div class="slot-empty">' + (canHL ? "点击\n放置" : col + "-" + row) + "</div>";
    }
  }
}

function onSlotClick(e) {
  const idx   = parseInt(e.currentTarget.dataset.slot, 10);
  const plant = gs.grid[idx];

  if (plant) {
    if (gs.phase === "dusk") {
      gs.grid[idx] = null;
      gs.backpack.push({ id: uid(), plantIdx: plant.plantIdx });
      addLog(plant.name + " 已取回到背包", "dodge");
      renderBackpack();
      renderGrid();
    }
    return;
  }
  if (gs.phase !== "dusk" || !gs.selectedId) return;

  const bpIdx = gs.backpack.findIndex(function(b) { return b.id === gs.selectedId; });
  if (bpIdx === -1) { gs.selectedId = null; renderBackpack(); return; }

  const item  = gs.backpack.splice(bpIdx, 1)[0];
  const pDef  = plantLibrary[item.plantIdx];
  const baseInterval = pDef.attackMode === "melee" ? 2200 : pDef.attackMode === "area" ? 2000 : 1600;

  gs.grid[idx] = Object.assign({}, pDef, {
    id:             uid(),
    plantIdx:       item.plantIdx,
    maxHp:          pDef.hp,
    hp:             pDef.hp,
    shield:         0,
    poisonTurns:    0,
    poisonDmg:      0,
    slowTurns:      0,
    currentCd:      0,
    lane:           idx % LANES,
    row:            Math.floor(idx / LANES),
    slotIdx:        idx,
    lastAttackTime: 0,
    attackInterval: baseInterval,
  });

  gs.selectedId = null;
  addLog(pDef.name + " 已种植到 " + (idx % LANES + 1) + "-" + (Math.floor(idx / LANES) + 1) + " 位置", "end");
  renderBackpack();
  renderGrid();
}

// ─────────────────── Backpack ────────────────────────
function renderBackpack() {
  if (elBackpackCount) elBackpackCount.textContent = gs.backpack.length + " 个植物";
  elBackpackItems.innerHTML = gs.backpack.map(function(item) {
    const p   = plantLibrary[item.plantIdx];
    const img = escHtml(getImg(p));
    const fb  = escHtml(buildSvgFallback(p.name, p.role));
    const sel = item.id === gs.selectedId;
    return '<div class="bp-item' + (sel ? " bp-selected" : "") + '" data-id="' + item.id + '">' +
      '<img src="' + img + '" alt="' + escHtml(p.name) + '" onerror="this.onerror=null;this.src=\'' + fb + '\'">' +
      '<div class="bp-name">' + escHtml(p.name) + "</div>" +
      '<div class="bp-stat">HP ' + p.hp + ' ATK ' + p.atk + "</div>" +
      "</div>";
  }).join("");

  elBackpackItems.querySelectorAll(".bp-item").forEach(function(el) {
    el.addEventListener("click", function() {
      const id = parseInt(el.dataset.id, 10);
      gs.selectedId = gs.selectedId === id ? null : id;
      renderBackpack();
      renderGrid();
      if (gs.selectedId !== null) {
        const it = gs.backpack.find(function(b) { return b.id === id; });
        if (it) addLog("已选中 " + plantLibrary[it.plantIdx].name + "，点击种植区空格放置", "dodge");
      }
    });
  });
}

// ─────────────────── Collection Zone ─────────────────
let elPlayer = null;

function createPlayer() {
  if (elPlayer) elPlayer.remove();
  elPlayer = document.createElement("div");
  elPlayer.className = "player-character";
  elPlayer.innerHTML = '<span class="player-emoji">🧑</span><div class="carried-plants"></div>';
  elCollect.appendChild(elPlayer);
  updatePlayerPosition();
}

function renderCarriedPlants() {
  if (!elPlayer) return;
  const container = elPlayer.querySelector(".carried-plants");
  if (!container) return;
  container.innerHTML = "";
  gs.carried.forEach(function(c) {
    const pDef = plantLibrary[c.plantIdx];
    const img = document.createElement("img");
    img.src = getImg(pDef);
    img.alt = pDef.name;
    img.className = "carried-plant-icon";
    img.title = pDef.name;
    img.onerror = function() { img.src = buildSvgFallback(pDef.name, pDef.role); };
    container.appendChild(img);
  });
}

function depositCarriedPlants() {
  if (gs.carried.length === 0) return;
  const names = gs.carried.map(function(c) { return plantLibrary[c.plantIdx].name; });
  const toDeposit = gs.carried.slice();
  gs.carried = [];
  renderCarriedPlants();

  // Animate each plant flying from player to backpack
  const playerRect = elPlayer ? elPlayer.getBoundingClientRect() : null;
  const bpRect = elBackpackItems.getBoundingClientRect();

  toDeposit.forEach(function(c, i) {
    const pDef = plantLibrary[c.plantIdx];
    // Create flying element
    const fly = document.createElement("div");
    fly.className = "fly-to-backpack";
    const img = document.createElement("img");
    img.src = getImg(pDef);
    img.onerror = function() { img.src = buildSvgFallback(pDef.name, pDef.role); };
    fly.appendChild(img);
    document.body.appendChild(fly);

    // Start position: player head
    const startX = playerRect ? playerRect.left + playerRect.width / 2 : window.innerWidth / 2;
    const startY = playerRect ? playerRect.top : window.innerHeight / 2;
    // End position: backpack area
    const endX = bpRect.left + Math.min(40 + i * 50, bpRect.width - 20);
    const endY = bpRect.top + bpRect.height / 2;

    fly.style.left = startX + "px";
    fly.style.top = startY + "px";

    // Stagger the animation slightly for each plant
    setTimeout(function() {
      fly.style.transition = "left 0.5s cubic-bezier(.2,.8,.3,1), top 0.5s cubic-bezier(.2,.8,.3,1), transform 0.5s ease, opacity 0.5s ease";
      fly.style.left = endX + "px";
      fly.style.top = endY + "px";
      fly.style.transform = "translate(-50%,-50%) scale(0.5)";
      fly.style.opacity = "0.3";
    }, i * 80);

    // Remove flying element and add to backpack after animation
    setTimeout(function() {
      fly.remove();
      gs.backpack.push({ id: uid(), plantIdx: c.plantIdx });
      renderBackpack();
      // Mark the last added item for pop animation
      const items = elBackpackItems.querySelectorAll(".bp-item");
      const lastItem = items[items.length - 1];
      if (lastItem) lastItem.classList.add("bp-item-new");
    }, i * 80 + 520);
  });

  addLog("回到出生区！存入背包：" + names.join("、"), "end");
}

function updatePlayerPosition() {
  if (!elPlayer) return;

  // Handle jump animation
  let yOffset = 0;
  if (gs.player.isJumping) {
    gs.player.jumpProgress += 0.1;
    if (gs.player.jumpProgress >= 1) {
      gs.player.isJumping = false;
      gs.player.jumpProgress = 0;
      // Change row after jump
      const dy = (gs.keys["arrowup"] || gs.keys["w"]) ? -1 : (gs.keys["arrowdown"] || gs.keys["s"]) ? 1 : 0;
      gs.player.row = Math.max(0, Math.min(COLLECTION_ROWS - 1, gs.player.row + dy));
    } else {
      // Jump arc
      yOffset = -Math.sin(gs.player.jumpProgress * Math.PI) * 15;
    }
  }

  // Position based on row (15 stripes, each 6.67% height)
  const targetY = gs.player.row * STRIPE_HEIGHT + STRIPE_HEIGHT / 2;
  gs.player.y = targetY;

  elPlayer.style.left = gs.player.x + "%";
  elPlayer.style.top = gs.player.y + "%";
  elPlayer.style.transform = "translate(-50%, calc(-50% + " + yOffset + "px))";
}

function movePlayer() {
  if (gs.phase !== "day") return;

  let dx = 0;

  // Only horizontal movement, vertical via jumping
  if (gs.keys["arrowleft"] || gs.keys["a"]) dx -= 1;
  if (gs.keys["arrowright"] || gs.keys["d"]) dx += 1;

  // Update horizontal position with boundaries
  gs.player.x = Math.max(5, Math.min(95, gs.player.x + dx * gs.player.speed));

  updatePlayerPosition();
  checkPlantCollisions();
  checkWaveCollisions();

  // Check if player returned to spawn zone with carried plants
  if (gs.player.row === SPAWN_ROW && gs.carried.length > 0) {
    depositCarriedPlants();
  }
}

// Helper: Pick a wave type by weight
function getRandomWaveType() {
  const totalWeight = waveTypes.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight <= 0) return waveTypes[0] || { speed: 0.4, spawnInterval: 5000 };
  
  let random = Math.random() * totalWeight;
  for (let i = 0; i < waveTypes.length; i++) {
    random -= waveTypes[i].weight;
    if (random <= 0) return waveTypes[i];
  }
  return waveTypes[waveTypes.length - 1];
}

// Helper: Pick a plant spawn config by weight
function getRandomPlantSpawnConfig() {
  const totalWeight = plantSpawnConfigs.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return plantSpawnConfigs[0] || { spawnInterval: 5500 };
  
  let random = Math.random() * totalWeight;
  for (let i = 0; i < plantSpawnConfigs.length; i++) {
    random -= plantSpawnConfigs[i].weight;
    if (random <= 0) return plantSpawnConfigs[i];
  }
  return plantSpawnConfigs[plantSpawnConfigs.length - 1];
}

// Wave system
function spawnWave() {
  if (gs.phase !== "day") {
    addLog("[WAVE] spawnWave 被调用，但阶段不是 day，阶段: " + gs.phase, "dodge");
    return;
  }

  const waveType = getRandomWaveType();
  const wave = {
    id: uid(),
    y: 0,
    speed: waveType.speed,
    el: null,
  };

  const el = document.createElement("div");
  el.className = "wave";
  el.dataset.id = wave.id;
  el.style.top = "0%";
  el.style.display = "block";
  // Apply wave color from config
  const c = waveType.color || "#0096ff";
  el.style.background = "linear-gradient(180deg, " + c + "e6 0%, " + c + "cc 40%, " + c + "b3 100%)";
  el.style.boxShadow = "0 0 8px " + c + "b3, inset 0 2px 4px rgba(255,255,255,0.5)";
  elCollect.appendChild(el);
  wave.el = el;

  gs.waves.push(wave);
  addLog("[WAVE] 生成新海浪 ID:" + wave.id + " 速度:" + wave.speed.toFixed(2) + " 类型:" + waveType.name + " 当前海浪数:" + gs.waves.length, "dodge");
  console.log("Wave spawned:", wave, "Type:", waveType, "Container:", elCollect, "Wave element:", el);
  
  // Schedule next wave spawning based on selected wave type's interval
  if (waveSpawnInterval) clearInterval(waveSpawnInterval);
  waveSpawnInterval = setInterval(spawnWave, waveType.spawnInterval);
}

function updateWaves() {
  if (gs.phase !== "day") return;

  // Update wave positions
  for (let i = gs.waves.length - 1; i >= 0; i--) {
    const wave = gs.waves[i];
    wave.y += wave.speed;

    if (wave.el) {
      wave.el.style.top = wave.y + "%";
    } else {
      addLog("[WAVE] 警告：海浪 ID:" + wave.id + " 没有 el 元素", "crit");
    }

    // Remove waves that have gone off screen
    if (wave.y > 100) {
      if (wave.el) wave.el.remove();
      addLog("[WAVE] 海浪 ID:" + wave.id + " 已离屏移除", "dodge");
      gs.waves.splice(i, 1);
    }
  }
}

function checkWaveCollisions() {
  if (gs.phase !== "day") return;

  // Invincibility window after being hit - prevents multiple hits from one wave
  if (performance.now() < gs.waveHitCooldown) return;

  const playerY = gs.player.y;
  
  // Only take damage if in black stripe
  if (!isBlackStripe(playerY)) return;

  for (const wave of gs.waves) {
    const distance = Math.abs(wave.y - playerY);
    // Check if wave is at player's position (±8% tolerance)
    const COLLISION_TOLERANCE = STRIPE_HEIGHT * 1.2;  // Adaptive collision tolerance
    if (distance < COLLISION_TOLERANCE) {
      // Hit by wave - reset to bottom and grant 1.5s of immunity
      // Drop all carried plants when hit by wave
      if (gs.carried.length > 0) {
        addLog("被海浪击中！携带的植物掉落了！", "crit");
        gs.carried = [];
        renderCarriedPlants();
      }
      gs.player.x = 50;
      gs.player.row = SPAWN_ROW;  // Reset to spawn zone
      gs.player.y = 95;    // Bottom position
      gs.waveHitCooldown = performance.now() + 1500;
      updatePlayerPosition();
      addLog("被海浪击中！回到出生区 (海浪Y:" + wave.y.toFixed(1) + "% 玩家Y:" + playerY.toFixed(1) + "%)", "dodge");
      break;
    }
  }
}

function checkPlantCollisions() {
  if (gs.phase !== "day") return;

  const collectionRect = elCollect.getBoundingClientRect();
  const playerSize = gs.player.size;
  const playerX = (gs.player.x / 100) * collectionRect.width;
  const playerY = (gs.player.y / 100) * collectionRect.height;

  for (let i = gs.spawned.length - 1; i >= 0; i--) {
    const sp = gs.spawned[i];
    const plantX = parseFloat(sp.el.style.left) / 100 * collectionRect.width;
    const plantY = parseFloat(sp.el.style.top) / 100 * collectionRect.height;

    const dist = Math.sqrt(Math.pow(playerX - plantX, 2) + Math.pow(playerY - plantY, 2));
    const collectDist = playerSize;

    if (dist < collectDist) {
      collectPlant(sp.id);
    }
  }
}

function spawnCollectionPlant() {
  if (gs.phase !== "day") return;
  if (gs.spawned.length >= MAX_SPAWNED) return;

  const plantIdx = Math.floor(Math.random() * plantLibrary.length);
  const pDef     = plantLibrary[plantIdx];
  const id       = uid();
  const x        = 8  + Math.random() * 78;
  
  // Only spawn plants in black stripes
  let y;
  do {
    y = Math.random() * 100;
  } while (!isBlackStripe(y));

  const el = document.createElement("div");
  el.className   = "spawned-plant";
  el.style.left  = x + "%";
  el.style.top   = y + "%";
  el.dataset.id  = id;

  const img = document.createElement("img");
  img.src         = getImg(pDef);
  img.alt         = pDef.name;
  img.onerror     = function() { img.src = buildSvgFallback(pDef.name, pDef.role); };

  const lbl = document.createElement("div");
  lbl.className   = "spawned-label";
  lbl.textContent = pDef.name;

  el.appendChild(img);
  el.appendChild(lbl);
  elCollect.appendChild(el);
  gs.spawned.push({ id: id, plantIdx: plantIdx, el: el, x: x, y: y });

  setTimeout(function() {
    const idx = gs.spawned.findIndex(function(s) { return s.id === id; });
    if (idx !== -1) { gs.spawned[idx].el.remove(); gs.spawned.splice(idx, 1); }
  }, 13000);
}

function collectPlant(id) {
  const idx = gs.spawned.findIndex(function(s) { return s.id === id; });
  if (idx === -1) return;
  const sp   = gs.spawned[idx];
  const pDef = plantLibrary[sp.plantIdx];
  sp.el.classList.add("collected");
  setTimeout(function() { sp.el.remove(); }, 350);
  gs.spawned.splice(idx, 1);
  // Add to carried (above head), not directly to backpack
  gs.carried.push({ id: uid(), plantIdx: sp.plantIdx });
  renderCarriedPlants();
  addLog("拾取了 " + pDef.name + "！回到出生区存入背包", "end");
}

// ─────────────────── Day Phase ───────────────────────
let playerMoveInterval = null;
let waveUpdateInterval = null;
let waveSpawnInterval = null;

function startDay() {
  gs.phase   = "day";
  gs.phaseLeft = gameConfig.dayDuration;
  gs.spawned = [];
  gs.waves = [];
  gs.carried = [];
  gs.player.x = 50;
  gs.player.y = 95;    // Start at bottom
  gs.player.row = SPAWN_ROW;  // Spawn zone row
  gs.player.isJumping = false;

  // Remove dark fog
  elCollect.classList.remove("fog-active");
  gs.waveHitCooldown = 0;
  addLog("[DEBUG] startDay 开始初始化", "round");
  console.log("[DEBUG] elCollect:", elCollect);
  elCollect.querySelectorAll(".spawned-plant").forEach(function(e) { e.remove(); });
  elCollect.querySelectorAll(".wave").forEach(function(e) { e.remove(); });
  elCollect.querySelectorAll(".stripe-label").forEach(function(e) { e.remove(); });
  if (elCollectHint) elCollectHint.style.display = "";

  // Render stripe safety/danger labels on the right side
  for (let r = 0; r < COLLECTION_ROWS; r++) {
    const lbl = document.createElement("div");
    lbl.className = "stripe-label";
    if (r === SPAWN_ROW) {
      lbl.textContent = "🏠 出生区";
      lbl.classList.add("stripe-spawn");
    } else {
      const isDanger = r % 2 === 1; // odd = black = danger
      lbl.textContent = isDanger ? "⚠ 危险" : "✓ 安全";
      if (isDanger) {
        lbl.classList.add("stripe-danger");
      } else {
        lbl.classList.add("stripe-safe");
      }
    }
    lbl.style.top = (r * STRIPE_HEIGHT) + "%";
    lbl.style.height = STRIPE_HEIGHT + "%";
    elCollect.appendChild(lbl);
  }

  // Create player character
  createPlayer();

  // Start player movement loop
  if (playerMoveInterval) clearInterval(playerMoveInterval);
  playerMoveInterval = setInterval(movePlayer, 16); // ~60fps

  // Start wave system
  if (waveUpdateInterval) clearInterval(waveUpdateInterval);
  waveUpdateInterval = setInterval(updateWaves, 16); // ~60fps

  if (waveSpawnInterval) clearInterval(waveSpawnInterval);
  addLog("[WAVE] 立即生成第一波海浪", "dodge");
  spawnWave(); // Immediately spawn first wave - spawnWave will handle scheduling next waves

  // Select plant spawn config for this day and start spawning
  gs.currentPlantSpawnConfig = getRandomPlantSpawnConfig();
  console.log("[PLANT] 选定的植物刷新配置:", gs.currentPlantSpawnConfig);
  addLog("[PLANT] 植物刷新配置: " + gs.currentPlantSpawnConfig.name + " (" + gs.currentPlantSpawnConfig.spawnInterval + "ms)", "plant");

  updateHUD();
  addLog("════ 第 " + gs.round + " 回合 — 白天开始！" + gameConfig.dayDuration + " 秒收集时间 ════", "round");

  gs.phaseHandle = setInterval(function() {
    gs.phaseLeft -= 1;
    updateHUD();
    if (gs.phaseLeft <= 0) {
      clearInterval(gs.phaseHandle);
      gs.phaseHandle = null;
      endDay();
    }
  }, 1000);

  spawnCollectionPlant();
  gs.spawnHandle = setInterval(spawnCollectionPlant, gs.currentPlantSpawnConfig.spawnInterval);
}

function endDay() {
  clearInterval(gs.spawnHandle);
  gs.spawnHandle = null;
  if (playerMoveInterval) {
    clearInterval(playerMoveInterval);
    playerMoveInterval = null;
  }
  if (waveUpdateInterval) {
    clearInterval(waveUpdateInterval);
    waveUpdateInterval = null;
  }
  if (waveSpawnInterval) {
    clearInterval(waveSpawnInterval);
    waveSpawnInterval = null;
  }
  if (elPlayer) {
    elPlayer.remove();
    elPlayer = null;
  }
  gs.spawned.forEach(function(s) { s.el.remove(); });
  gs.spawned     = [];
  gs.waves.forEach(function(w) { if (w.el) w.el.remove(); });
  gs.waves = [];
  // Deposit any remaining carried plants to backpack at end of day
  if (gs.carried.length > 0) {
    gs.carried.forEach(function(c) {
      gs.backpack.push({ id: uid(), plantIdx: c.plantIdx });
    });
    addLog("白天结束，携带的植物自动存入背包。", "end");
    gs.carried = [];
  }
  gs.selectedId  = null;
  if (elCollectHint) elCollectHint.style.display = "none";
  addLog("白天结束！进入黄昏…", "round");
  renderBackpack();
  renderGrid();
  setTimeout(startDusk, 2000);
}

// ─────────────────── Dusk Phase ──────────────────────
function startDusk() {
  gs.phase = "dusk";
  gs.phaseLeft = gameConfig.duskDuration;
  updateHUD();
  addLog("════ 黄昏时分！摆放植物，" + gameConfig.duskDuration + " 秒后夜晚降临 ════", "round");

  gs.phaseHandle = setInterval(function() {
    gs.phaseLeft -= 1;
    updateHUD();
    if (gs.phaseLeft <= 0) {
      clearInterval(gs.phaseHandle);
      gs.phaseHandle = null;
      endDusk();
    }
  }, 1000);
}

function endDusk() {
  gs.selectedId = null;
  renderBackpack();
  renderGrid();
  addLog("黄昏结束！夜晚开始…", "round");
  setTimeout(startNight, 2000);
}

// ─────────────────── Night Phase ─────────────────────
function buildQueue() {
  const waveIdx = gs.round - 1;
  const waveDef = waveList[waveIdx] || [];
  const arr     = [];
  const scale   = 1 + waveIdx * ROUND_SCALE_FACTOR;
  waveDef.forEach(function(entry) {
    const ti = entry.monsterIdx;
    const t  = monsterTypes[ti];
    if (!t) return;
    for (let i = 0; i < entry.count; i++) {
      arr.push({
        id:             uid(),
        typeIdx:        ti,
        name:           t.name,
        emoji:          t.emoji,
        hp:             Math.floor(t.hp  * scale),
        maxHp:          Math.floor(t.hp  * scale),
        atk:            Math.floor(t.atk * scale),
        speed:          t.speed,
        attackInterval: t.attackInterval,
        reward:         t.reward,
        lane:           Math.floor(Math.random() * LANES),
        y:              0,
        eating:         false,
        eatRow:         -1,
        lastAttack:     0,
        slowUntil:      0,
        poisonTurns:    0,
        poisonDmg:      0,
        dead:           false,
        el:             null,
      });
    }
  });
  // Shuffle so monsters of different types are interleaved
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function startNight() {
  gs.phase     = "night";
  gs.monsters  = [];
  gs.mQueue    = buildQueue();
  gs.nextSpawn  = performance.now() + 1200;
  gs.lastFrame  = performance.now();
  gs.lastCombat = performance.now();
  gs.lastPoison = performance.now();
  if (elCollectHint) elCollectHint.style.display = "none";
  // Add dark fog over collection zone
  elCollect.classList.add("fog-active");
  updateHUD();
  var nightMsg = "════ 夜晚开始！本波共 " + gs.mQueue.length + " 只怪物（第 " + gs.round + " 波 / 共 " + waveList.length + " 波）";
  if (gameConfig.nightDuration > 0) {
    nightMsg += "，限时 " + gameConfig.nightDuration + " 秒";
    gs.nightHandle = setTimeout(endNight, gameConfig.nightDuration * 1000);
  }
  nightMsg += " ════";
  addLog(nightMsg, "round");
  gs.animId = requestAnimationFrame(nightLoop);
}

// ─────────────────── Night Loop ──────────────────────
function nightLoop(ts) {
  if (gs.phase !== "night") return;

  const dt = Math.min((ts - gs.lastFrame) / 1000, 0.1);
  gs.lastFrame = ts;

  // Spawn from queue
  if (gs.mQueue.length > 0 && ts >= gs.nextSpawn) {
    doSpawn(gs.mQueue.shift());
    gs.nextSpawn = ts + 3000 + Math.random() * 2000;
  }

  // Move / eat monsters
  for (let mi = 0; mi < gs.monsters.length; mi++) {
    const m = gs.monsters[mi];
    if (m.dead) continue;

    if (m.eating) {
      const slotIdx = m.eatRow * LANES + m.lane;
      const target  = gs.grid[slotIdx];
      if (!target || target.hp <= 0) {
        m.eating  = false;
        m.eatRow  = -1;
        gs.grid[slotIdx] = null;
        renderGrid();
        if (m.el) m.el.classList.remove("eating");
      } else {
        monsterAttack(m, target, ts, slotIdx);
      }
    } else {
      const effectiveSpeed = ts < m.slowUntil ? m.speed * 0.35 : m.speed;
      m.y += effectiveSpeed * dt;

      let blocked = false;
      for (let r = 0; r < ROWS; r++) {
        if (m.y >= Y_ROW[r]) {
          const slotIdx = r * LANES + m.lane;
          const plant   = gs.grid[slotIdx];
          if (plant && plant.hp > 0) {
            m.y      = Y_ROW[r];
            m.eating = true;
            m.eatRow = r;
            if (m.el) m.el.classList.add("eating");
            blocked = true;
            break;
          }
        }
      }

      if (!blocked && m.y >= Y_BASE) {
        m.y    = Y_BASE;
        m.dead = true;
        gs.lives -= 1;
        updateHUD();
        addLog("⚠ " + m.name + " 穿越了防线！剩余生命：" + gs.lives, "crit");
        if (m.el) { m.el.remove(); m.el = null; }
        if (gs.lives <= 0) { endGame(); return; }
      }
    }
  }

  // Plant attacks on tick
  if (ts - gs.lastCombat >= COMBAT_TICK) {
    gs.lastCombat = ts;
    doPlantAttacks(ts);
  }

  // Poison ticks
  if (ts - gs.lastPoison >= POISON_TICK) {
    gs.lastPoison = ts;
    doPoison();
  }

  // Clean dead monsters
  gs.monsters = gs.monsters.filter(function(m) {
    if (m.dead && m.el) { m.el.remove(); m.el = null; }
    return !m.dead;
  });

  updateMonsterPositions();
  renderGrid();

  if (gs.monsters.length === 0 && gs.mQueue.length === 0) { endNight(); return; }

  gs.animId = requestAnimationFrame(nightLoop);
}

// ─────────────────── Spawn Monster ───────────────────
function doSpawn(m) {
  const el = document.createElement("div");
  el.className  = "monster";
  el.dataset.id = m.id;
  el.style.left = ((m.lane + 0.5) / LANES * 100) + "%";
  el.style.top  = "0px";
  el.innerHTML  =
    '<div class="monster-emoji">'  + m.emoji          + "</div>" +
    '<div class="monster-name">'   + escHtml(m.name)   + "</div>" +
    '<div class="monster-hpbar"><div class="monster-hpfill" style="width:100%"></div></div>' +
    '<div class="monster-status"></div>';
  elBattleArea.appendChild(el);
  m.el = el;
  gs.monsters.push(m);
}

// ─────────────────── Monster positions ───────────────
function yToPx(y) {
  if (y <= 1) return y * MONSTER_ZONE_H;
  return MONSTER_ZONE_H + (y - 1) * PLANTING_ROW_H;
}

function updateMonsterPositions() {
  for (let i = 0; i < gs.monsters.length; i++) {
    const m = gs.monsters[i];
    if (!m.el) continue;
    m.el.style.top = yToPx(m.y) + "px";
    const fill = m.el.querySelector(".monster-hpfill");
    if (fill) fill.style.width = Math.max(0, m.hp / m.maxHp) * 100 + "%";
    const statEl = m.el.querySelector(".monster-status");
    if (statEl) {
      const parts = [];
      if (m.slowUntil > performance.now()) parts.push("❄减速");
      if (m.poisonTurns > 0)               parts.push("💧" + m.poisonTurns);
      statEl.textContent = parts.join(" ");
    }
  }
}

// ─────────────────── Monster attacks plant ───────────
function monsterAttack(m, plant, ts, slotIdx) {
  if (ts - m.lastAttack < m.attackInterval) return;
  m.lastAttack = ts;

  let dmg = Math.max(1, m.atk - Math.floor(plant.df * DEFENSE_REDUCTION));

  if (plant.shield > 0) {
    const absorbed = Math.min(plant.shield, dmg);
    plant.shield  -= absorbed;
    dmg           -= absorbed;
    if (dmg <= 0) {
      addLog(m.name + " 攻击 " + plant.name + " — 护盾全吸收！(盾剩 " + plant.shield + ")", "dodge");
      return;
    }
  }

  plant.hp = Math.max(0, plant.hp - dmg);
  addLog(m.name + " 攻击 " + plant.name + " -" + dmg + (plant.shield > 0 ? " (盾剩" + plant.shield + ")" : ""), "hit");

  if (plant.hp <= 0) {
    gs.grid[slotIdx] = null;
    m.eating         = false;
    m.eatRow         = -1;
    if (m.el) m.el.classList.remove("eating");
    addLog(plant.name + " 被击倒了！", "crit");
    renderGrid();
  }
}

// ─────────────────── Plant attacks monsters ──────────
function doPlantAttacks(ts) {
  for (let i = 0; i < SLOTS; i++) {
    const plant = gs.grid[i];
    if (!plant || plant.hp <= 0) continue;
    if (ts - plant.lastAttackTime < plant.attackInterval) continue;
    plant.lastAttackTime = ts;

    const lane = i % LANES;
    if (plant.slowTurns > 0) plant.slowTurns -= 1;

    const laneMs = gs.monsters.filter(function(m) { return !m.dead && m.lane === lane; });
    if (!laneMs.length) continue;

    // Target closest monster (highest y value = nearest to plants)
    const target = laneMs.reduce(function(a, b) { return a.y > b.y ? a : b; });

    if (plant.attackMode === "area") {
      // Area: attack all monsters in lane
      laneMs.forEach(function(mt) { plantAttack(plant, mt, ts, mt === target); });
    } else {
      plantAttack(plant, target, ts, true);
    }
  }
}

// ─────────────────── Plant single attack ─────────────
function plantAttack(plant, target, ts, fireFx) {
  let usingSkill = false;
  let coef       = 1;
  if (plant.currentCd === 0 && plant.skillCoef > 1) {
    usingSkill      = true;
    coef            = plant.skillCoef;
    plant.currentCd = plant.skillCd;
  } else if (plant.currentCd > 0) {
    plant.currentCd -= 1;
  }

  let dmg     = Math.floor(plant.atk * coef);
  let critTag = "";
  if (Math.random() < plant.crit) {
    dmg     = Math.floor(dmg * plant.critDmg);
    critTag = "【暴击】";
  }
  dmg = Math.max(1, dmg);

  target.hp = Math.max(0, target.hp - dmg);

  const skillTag = usingSkill ? " 【" + plant.skillName + "】" : "";
  addLog(plant.name + skillTag + " → " + target.name + " -" + dmg + critTag, critTag ? "crit" : "hit");

  if (usingSkill) applyPlantSkill(plant, target);
  if (fireFx)     fireProjFx(plant, target);

  if (target.hp <= 0) {
    target.dead = true;
    if (target.eating) { target.eating = false; target.eatRow = -1; }
    gs.score += (target.reward || 10);
    updateHUD();
    addLog("✨ " + plant.name + " 击败了 " + target.name + "！+" + (target.reward || 10) + "分", "end");
  }
}

// ─────────────────── Skill effects ───────────────────
function applyPlantSkill(plant, monster) {
  const type = plant.skillType;
  if (type === "poison") {
    const turns = plant.skillCd + POISON_DURATION_BONUS;
    const dpt   = Math.floor(plant.atk * POISON_DMG_MULTIPLIER);
    monster.poisonTurns = Math.max(monster.poisonTurns, turns);
    monster.poisonDmg   = Math.max(monster.poisonDmg,   dpt);
    addLog(monster.name + " 进入中毒状态（" + turns + " 次，每次 -" + dpt + "）", "crit");
  } else if (type === "slow") {
    const dur = (plant.skillCd + 1) * SLOW_DURATION_MS;
    monster.slowUntil = Math.max(monster.slowUntil, performance.now() + dur);
    addLog(monster.name + " 被减速 " + (dur / 1000) + "s！", "dodge");
  } else if (type === "shield") {
    const gain = Math.floor(plant.atk * plant.skillCoef * SHIELD_GAIN_MULTIPLIER);
    plant.shield += gain;
    addLog(plant.name + " 获得护盾 +" + gain + "（总计 " + plant.shield + "）", "end");
  }
  // skillType "normal": extra damage already applied via skillCoef
}

// ─────────────────── Poison ticks ────────────────────
function doPoison() {
  for (let i = 0; i < gs.monsters.length; i++) {
    const m = gs.monsters[i];
    if (m.dead || m.poisonTurns <= 0 || !m.poisonDmg) continue;
    m.hp = Math.max(0, m.hp - m.poisonDmg);
    m.poisonTurns -= 1;
    addLog(m.name + " 中毒持续伤害 -" + m.poisonDmg + "（剩余 " + m.poisonTurns + " 次）", "dodge");
    if (m.hp <= 0) {
      m.dead = true;
      if (m.eating) { m.eating = false; m.eatRow = -1; }
      gs.score += (m.reward || 10);
      updateHUD();
      addLog(m.name + " 因中毒倒下！+" + (m.reward || 10) + "分", "end");
    }
  }
}

// ─────────────────── Projectile FX ───────────────────
function fireProjFx(plant, monster) {
  if (!monster.el) return;
  const slotEl = elPlantingGrid.children[plant.slotIdx];
  if (!slotEl) return;

  const wrapRect = elBattleArea.getBoundingClientRect();
  const slotRect = slotEl.getBoundingClientRect();
  const monRect  = monster.el.getBoundingClientRect();

  const x1 = slotRect.left + slotRect.width  / 2 - wrapRect.left;
  const y1 = slotRect.top  + slotRect.height / 2 - wrapRect.top;
  const x2 = monRect.left  + monRect.width   / 2 - wrapRect.left;
  const y2 = monRect.top   + monRect.height  / 2 - wrapRect.top;

  const mode = plant.attackMode;
  const dot  = document.createElement("div");
  dot.className = "projectile-fx " + mode;
  dot.style.setProperty("--x1", x1 + "px");
  dot.style.setProperty("--y1", y1 + "px");
  dot.style.setProperty("--x2", x2 + "px");
  dot.style.setProperty("--y2", y2 + "px");
  dot.style.setProperty("--dur", "340ms");
  dot.style.left = x1 + "px";
  dot.style.top  = y1 + "px";
  elBattleArea.appendChild(dot);
  dot.addEventListener("animationend", function() { dot.remove(); }, { once: true });

  if (mode === "area") {
    const burst = document.createElement("div");
    burst.className = "area-burst";
    burst.style.left = x2 + "px";
    burst.style.top  = y2 + "px";
    burst.style.setProperty("--dur", "420ms");
    elBattleArea.appendChild(burst);
    burst.addEventListener("animationend", function() { burst.remove(); }, { once: true });
  }
}

// ─────────────────── Night End / Victory / Game Over ─
function victory() {
  if (gs.animId)     { cancelAnimationFrame(gs.animId);  gs.animId     = null; }
  if (gs.phaseHandle){ clearInterval(gs.phaseHandle);    gs.phaseHandle = null; }
  elBattleArea.querySelectorAll(".monster,.projectile-fx,.area-burst").forEach(function(e) { e.remove(); });
  gs.monsters = [];
  gs.phase = "victory";
  updateHUD();
  addLog("🏆 恭喜通关！全部 " + waveList.length + " 波怪物已击败！最终分数：" + gs.score, "end");
}

function endNight() {
  if (gs.nightHandle) { clearTimeout(gs.nightHandle); gs.nightHandle = null; }
  if (gs.animId) { cancelAnimationFrame(gs.animId); gs.animId = null; }
  elBattleArea.querySelectorAll(".monster,.projectile-fx,.area-burst").forEach(function(e) { e.remove(); });
  gs.monsters = [];
  gs.mQueue   = [];
  addLog("🎉 第 " + gs.round + " 波胜利！当前分数：" + gs.score, "end");
  if (gs.round >= waveList.length) {
    victory();
    return;
  }
  gs.round += 1;
  setTimeout(startDay, 2200);
}

function endGame() {
  if (gs.nightHandle)  { clearTimeout(gs.nightHandle);   gs.nightHandle  = null; }
  if (gs.animId)     { cancelAnimationFrame(gs.animId);  gs.animId     = null; }
  if (gs.phaseHandle)  { clearInterval(gs.phaseHandle);       gs.phaseHandle  = null; }
  if (gs.spawnHandle){ clearInterval(gs.spawnHandle);     gs.spawnHandle = null; }
  gs.phase = "gameover";
  updateHUD();
  addLog("💀 游戏结束！最终分数：" + gs.score + "，坚持了 " + gs.round + " 回合", "end");
}

// ─────────────────── Start / Reset ───────────────────
function fullReset() {
  if (gs.nightHandle)  { clearTimeout(gs.nightHandle);   gs.nightHandle  = null; }
  if (gs.animId)     { cancelAnimationFrame(gs.animId);  gs.animId     = null; }
  if (gs.phaseHandle)  { clearInterval(gs.phaseHandle);       gs.phaseHandle  = null; }
  if (gs.spawnHandle){ clearInterval(gs.spawnHandle);     gs.spawnHandle = null; }
  gs.phase       = "idle";
  gs.round       = 0;
  gs.score       = 0;
  gs.lives       = gameConfig.initialLives;
  gs.phaseLeft   = 0;
  gs.spawned     = [];
  gs.backpack    = [];
  gs.selectedId  = null;
  gs.grid        = Array(SLOTS).fill(null);
  gs.monsters    = [];
  gs.mQueue      = [];
  elCollect.querySelectorAll(".spawned-plant").forEach(function(e) { e.remove(); });
  elBattleArea.querySelectorAll(".monster,.projectile-fx,.area-burst").forEach(function(e) { e.remove(); });
  if (elCollectHint) elCollectHint.style.display = "";
  initGrid();
  renderBackpack();
  updateHUD();
}

document.getElementById("btnStart").addEventListener("click", function() {
  if (gs.phase !== "idle" && gs.phase !== "gameover" && gs.phase !== "victory") return;
  if (waveList.length === 0) { addLog("请先在「每波怪物配置」中添加至少一波！", "dodge"); return; }
  fullReset();
  gs.round = 1;
  startDay();
});

document.getElementById("btnReset").addEventListener("click", function() {
  fullReset();
  elLog.innerHTML = "";
  addLog("游戏已重置。点击「开始游戏」进入第一回合！", "round");
});

document.getElementById("btnClearLog").addEventListener("click", function() {
  elLog.innerHTML = "";
});

// ─────────────────── Save / Load ─────────────────────
document.getElementById("btnSaveConfig").addEventListener("click", function() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
      plantLibrary:      plantLibrary, 
      monsterTypes:      monsterTypes, 
      waveTypes:         waveTypes,
      plantSpawnConfigs: plantSpawnConfigs,
      waveList:          waveList,
      gameConfig:        gameConfig
    }));
    addLog("植物库 & 怪物库 & 海浪库 & 植物刷新配置 & 波次配置 & 游戏基础配置已保存到本地浏览器。", "end");
  } catch(e) {
    addLog("保存失败（file:// 协议不支持 localStorage）", "dodge");
    console.warn("localStorage error:", e);
  }
});

document.getElementById("btnLoadConfig").addEventListener("click", function() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { addLog("未找到已保存配置。", "dodge"); return; }
    const data = JSON.parse(raw);
    if (Array.isArray(data.plantLibrary) && data.plantLibrary.length >= 1) {
      plantLibrary.splice(0, plantLibrary.length);
      data.plantLibrary.forEach(function(p) { plantLibrary.push(p); });
      plantLibrary.forEach(sanitizePlant);
      renderLibrary();
      renderBackpack();
    }
    if (Array.isArray(data.monsterTypes) && data.monsterTypes.length >= 1) {
      monsterTypes.splice(0, monsterTypes.length);
      data.monsterTypes.forEach(function(m) { monsterTypes.push(m); });
      monsterTypes.forEach(sanitizeMonster);
      renderMonsterLibrary();
    }
    if (Array.isArray(data.waveTypes) && data.waveTypes.length >= 1) {
      waveTypes.splice(0, waveTypes.length);
      data.waveTypes.forEach(function(w) { waveTypes.push(w); });
      waveTypes.forEach(sanitizeWave);
      renderWaveLibrary();
    }
    if (Array.isArray(data.plantSpawnConfigs) && data.plantSpawnConfigs.length >= 1) {
      plantSpawnConfigs.splice(0, plantSpawnConfigs.length);
      data.plantSpawnConfigs.forEach(function(p) { plantSpawnConfigs.push(p); });
      plantSpawnConfigs.forEach(sanitizePlantSpawn);
      renderPlantSpawnLibrary();
    }
    if (Array.isArray(data.waveList) && data.waveList.length >= 1) {
      waveList.splice(0, waveList.length);
      data.waveList.forEach(function(w) {
        waveList.push(Array.isArray(w) ? w : []);
      });
      waveList.forEach(function(waveDef) { waveDef.forEach(sanitizeWaveEntry); });
      renderRoundConfig();
    }
    if (data.gameConfig && typeof data.gameConfig === "object") {
      gameConfig.dayDuration   = data.gameConfig.dayDuration;
      gameConfig.duskDuration  = data.gameConfig.duskDuration;
      gameConfig.nightDuration = data.gameConfig.nightDuration;
      gameConfig.initialLives  = data.gameConfig.initialLives;
      sanitizeGameConfig(gameConfig);
      renderGameConfig();
    }
    addLog("配置加载成功！", "end");
  } catch(e) { 
    addLog("配置加载失败（file:// 协议不支持 localStorage）", "dodge");
    console.warn("localStorage error:", e); 
  }
});

// ─────────────────── Plant Library Editor ────────────
elLibraryToggle.addEventListener("click", function() {
  const open = elLibraryBody.style.display === "none";
  elLibraryBody.style.display = open ? "" : "none";
});

const libFields = [
  { key: "name",       label: "名字",     type: "text"   },
  { key: "image",      label: "图片URL",  type: "text"   },
  { key: "role",       label: "定位",     type: "select" },
  { key: "attackMode", label: "攻击方式", type: "select" },
  { key: "hp",         label: "HP",       type: "number", step: "1"    },
  { key: "atk",        label: "ATK",      type: "number", step: "1"    },
  { key: "df",         label: "DEF",      type: "number", step: "1"    },
  { key: "crit",       label: "暴击率",   type: "number", step: "0.01" },
  { key: "critDmg",    label: "暴伤倍率", type: "number", step: "0.1"  },
  { key: "dodge",      label: "闪避率",   type: "number", step: "0.01" },
  { key: "skillName",  label: "技能名称", type: "text"   },
  { key: "skillType",  label: "技能类型", type: "select" },
  { key: "skillCoef",  label: "技能系数", type: "number", step: "0.1"  },
  { key: "skillCd",    label: "技能冷却", type: "number", step: "1"    },
];

const selectOptions = {
  role:       [["defender","防御"],["attacker","输出"],["support","辅助"]],
  attackMode: [["melee","近战突进"],["ranged","远程弹道"],["area","范围爆发"]],
  skillType:  [["normal","普通伤害"],["poison","中毒DoT"],["shield","自身护盾"],["slow","减速怪物"]],
};

function renderLibrary() {
  elLibraryList.innerHTML = plantLibrary.map(function(p, i) {
    const img = escHtml(getImg(p));
    const fb  = escHtml(buildSvgFallback(p.name, p.role));
    const rows = libFields.map(function(f) {
      const fid = "lib-" + i + "-" + f.key;
      if (f.type === "select") {
        const pool = selectOptions[f.key] || [];
        const opts = pool.map(function(kv) {
          return '<option value="' + kv[0] + '"' + (p[f.key] === kv[0] ? " selected" : "") + ">" + kv[1] + "</option>";
        }).join("");
        return "<label>" + escHtml(f.label) + '<select id="' + fid + '">' + opts + "</select></label>";
      }
      return "<label>" + escHtml(f.label) +
        '<input id="' + fid + '" type="' + f.type + '" step="' + (f.step || "1") + '" value="' +
        escHtml(String(p[f.key] !== undefined ? p[f.key] : "")) + '"></label>';
    }).join("");

    return '<div class="library-item" data-idx="' + i + '">' +
      '<div class="library-item-summary">' +
        '<img class="lib-thumb" src="' + img + '" alt="' + escHtml(p.name) + '" onerror="this.onerror=null;this.src=\'' + fb + '\'">' +
        '<span class="lib-name">'  + escHtml(p.name)              + "</span>" +
        '<span class="lib-tag">'   + roleLabel(p.role)             + "</span>" +
        '<span class="lib-stat">HP '  + p.hp   + "</span>" +
        '<span class="lib-stat">ATK ' + p.atk  + "</span>" +
        '<span class="lib-stat">DEF ' + p.df   + "</span>" +
        '<span class="lib-stat">'  + modeLabel(p.attackMode)       + "</span>" +
        '<span class="lib-stat">技能:' + escHtml(p.skillName) + "(" + p.skillType + ")" + "</span>" +
        '<div class="lib-actions">' +
          '<button class="ghost btn-lib-edit" data-idx="'   + i + '">编辑</button>' +
          '<button class="btn-danger btn-lib-del" data-idx="' + i + '">删除</button>' +
        "</div>" +
      "</div>" +
      '<div class="library-item-form" id="lib-form-' + i + '" style="display:none">' +
        rows +
        '<div class="lib-form-actions">' +
          '<button class="btn-lib-save" data-idx="'    + i + '">保存</button>' +
          '<button class="ghost btn-lib-cancel" data-idx="' + i + '">取消</button>' +
        "</div>" +
      "</div>" +
    "</div>";
  }).join("");
}

elLibraryList.addEventListener("click", function(evt) {
  const btn = evt.target;
  if (!(btn instanceof HTMLElement)) return;

  if (btn.classList.contains("btn-lib-edit")) {
    const form = document.getElementById("lib-form-" + btn.dataset.idx);
    if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
    return;
  }
  if (btn.classList.contains("btn-lib-cancel")) {
    const form = document.getElementById("lib-form-" + btn.dataset.idx);
    if (form) form.style.display = "none";
    return;
  }
  if (btn.classList.contains("btn-lib-save")) {
    const idx = parseInt(btn.dataset.idx, 10);
    const p   = plantLibrary[idx];
    libFields.forEach(function(f) {
      const node = document.getElementById("lib-" + idx + "-" + f.key);
      if (!node) return;
      p[f.key] = f.type === "number" ? toNum(node.value, p[f.key]) : node.value;
    });
    sanitizePlant(p);
    // Sync changes into any live planted copies
    for (let s = 0; s < SLOTS; s++) {
      const live = gs.grid[s];
      if (!live || live.plantIdx !== idx) continue;
      ["name","image","role","attackMode","atk","df","crit","critDmg","dodge",
       "skillName","skillCoef","skillCd","skillType"].forEach(function(k) { live[k] = p[k]; });
    }
    renderLibrary();
    renderGrid();
    renderBackpack();
    addLog("植物库已更新：" + p.name, "end");
    return;
  }
  if (btn.classList.contains("btn-lib-del")) {
    const idx = parseInt(btn.dataset.idx, 10);
    if (plantLibrary.length <= 1) { addLog("至少需要保留 1 个植物。", "dodge"); return; }
    const name = plantLibrary[idx].name;
    plantLibrary.splice(idx, 1);
    for (let s = 0; s < SLOTS; s++) {
      const live = gs.grid[s];
      if (!live) continue;
      if (live.plantIdx === idx)  gs.grid[s] = null;
      else if (live.plantIdx > idx) live.plantIdx -= 1;
    }
    gs.backpack = gs.backpack
      .filter(function(b) { return b.plantIdx !== idx; })
      .map(function(b)    { return { id: b.id, plantIdx: b.plantIdx > idx ? b.plantIdx - 1 : b.plantIdx }; });
    renderLibrary();
    renderGrid();
    renderBackpack();
    addLog("已从植物库移除：" + name, "end");
    return;
  }
});

document.getElementById("btnAddPlant").addEventListener("click", function() {
  const newP = {
    name: "新植物", image: "", role: "attacker", attackMode: "ranged",
    hp: 1000, atk: 150, df: 30, crit: 0.12, critDmg: 1.5, dodge: 0,
    skillName: "技能", skillCoef: 1.5, skillCd: 2, skillType: "normal",
  };
  sanitizePlant(newP);
  plantLibrary.push(newP);
  renderLibrary();
  const newIdx = plantLibrary.length - 1;
  const form   = document.getElementById("lib-form-" + newIdx);
  if (form) form.style.display = "grid";
  // Open library panel if closed
  if (elLibraryBody.style.display === "none") elLibraryBody.style.display = "";
  addLog("新植物已添加，请填写属性后保存。", "end");
});

// ─────────────────── Monster Library Editor ──────────

elMonsterLibraryToggle.addEventListener("click", function() {
  const open = elMonsterLibraryBody.style.display === "none";
  elMonsterLibraryBody.style.display = open ? "" : "none";
});

const monsterFields = [
  { key: "name",           label: "名字",       type: "text"   },
  { key: "emoji",          label: "Emoji",      type: "text"   },
  { key: "hp",             label: "HP",         type: "number", step: "1"    },
  { key: "atk",            label: "ATK",        type: "number", step: "1"    },
  { key: "speed",          label: "移动速度",   type: "number", step: "0.01" },
  { key: "attackInterval", label: "攻击间隔(ms)", type: "number", step: "100" },
  { key: "reward",         label: "击杀奖励",   type: "number", step: "1"    },
];

function renderMonsterLibrary() {
  elMonsterLibraryList.innerHTML = monsterTypes.map(function(m, i) {
    const rows = monsterFields.map(function(f) {
      const fid = "mon-" + i + "-" + f.key;
      return "<label>" + escHtml(f.label) +
        '<input id="' + fid + '" type="' + f.type + '" step="' + (f.step || "1") + '" value="' +
        escHtml(String(m[f.key] !== undefined ? m[f.key] : "")) + '"></label>';
    }).join("");

    return '<div class="library-item monster-item" data-idx="' + i + '">' +
      '<div class="library-item-summary">' +
        '<span class="mon-emoji">' + escHtml(m.emoji) + "</span>" +
        '<span class="lib-name">'  + escHtml(m.name)  + "</span>" +
        '<span class="lib-stat">HP '  + m.hp   + "</span>" +
        '<span class="lib-stat">ATK ' + m.atk  + "</span>" +
        '<span class="lib-stat">速度 ' + m.speed + "</span>" +
        '<span class="lib-stat">间隔 ' + m.attackInterval + 'ms</span>' +
        '<span class="lib-stat">奖励 ' + m.reward + "</span>" +
        '<div class="lib-actions">' +
          '<button class="ghost btn-mon-edit" data-idx="'   + i + '">编辑</button>' +
          '<button class="btn-danger btn-mon-del" data-idx="' + i + '">删除</button>' +
        "</div>" +
      "</div>" +
      '<div class="library-item-form" id="mon-form-' + i + '" style="display:none">' +
        rows +
        '<div class="lib-form-actions">' +
          '<button class="btn-mon-save" data-idx="'    + i + '">保存</button>' +
          '<button class="ghost btn-mon-cancel" data-idx="' + i + '">取消</button>' +
        "</div>" +
      "</div>" +
    "</div>";
  }).join("");
}

elMonsterLibraryList.addEventListener("click", function(evt) {
  const btn = evt.target;
  if (!(btn instanceof HTMLElement)) return;

  if (btn.classList.contains("btn-mon-edit")) {
    const form = document.getElementById("mon-form-" + btn.dataset.idx);
    if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
    return;
  }
  if (btn.classList.contains("btn-mon-cancel")) {
    const form = document.getElementById("mon-form-" + btn.dataset.idx);
    if (form) form.style.display = "none";
    return;
  }
  if (btn.classList.contains("btn-mon-save")) {
    const idx = parseInt(btn.dataset.idx, 10);
    const m   = monsterTypes[idx];
    monsterFields.forEach(function(f) {
      const node = document.getElementById("mon-" + idx + "-" + f.key);
      if (!node) return;
      m[f.key] = f.type === "number" ? toNum(node.value, m[f.key]) : node.value;
    });
    sanitizeMonster(m);
    renderMonsterLibrary();
    renderRoundConfig();
    addLog("怪物库已更新：" + m.name, "end");
    return;
  }
  if (btn.classList.contains("btn-mon-del")) {
    const idx = parseInt(btn.dataset.idx, 10);
    if (monsterTypes.length <= 1) { addLog("至少需要保留 1 个怪物。", "dodge"); return; }
    const name = monsterTypes[idx].name;
    monsterTypes.splice(idx, 1);
    renderMonsterLibrary();
    renderRoundConfig();
    addLog("已从怪物库移除：" + name, "end");
    return;
  }
});

document.getElementById("btnAddMonster").addEventListener("click", function() {
  const newM = {
    name: "新怪物", emoji: "👻", hp: 300, atk: 35,
    speed: 0.27, attackInterval: 1600, reward: 10,
  };
  sanitizeMonster(newM);
  monsterTypes.push(newM);
  renderMonsterLibrary();
  renderRoundConfig();
  const newIdx = monsterTypes.length - 1;
  const form   = document.getElementById("mon-form-" + newIdx);
  if (form) form.style.display = "grid";
  if (elMonsterLibraryBody.style.display === "none") elMonsterLibraryBody.style.display = "";
  addLog("新怪物已添加，请填写属性后保存。", "end");
});

// ─────────────────── Wave Library ───────────────────
elWaveLibraryToggle.addEventListener("click", function() {
  const open = elWaveLibraryBody.style.display === "none";
  elWaveLibraryBody.style.display = open ? "" : "none";
});

const waveFields = [
  { key: "name",          label: "名字",       type: "text"   },
  { key: "speed",         label: "移动速度",   type: "number", step: "0.05" },
  { key: "spawnInterval", label: "刷新间隔(ms)", type: "number", step: "100" },
  { key: "weight",        label: "权重比例(%)", type: "number", step: "1"   },
  { key: "color",         label: "颜色",       type: "color"  },
];

function renderWaveLibrary() {
  elWaveLibraryList.innerHTML = waveTypes.map(function(w, i) {
    const rows = waveFields.map(function(f) {
      const fid = "wave-" + i + "-" + f.key;
      return "<label>" + escHtml(f.label) +
        '<input id="' + fid + '" type="' + f.type + '" step="' + (f.step || "1") + '" value="' +
        escHtml(String(w[f.key] !== undefined ? w[f.key] : "")) + '"></label>';
    }).join("");

    return '<div class="library-item wave-item" data-idx="' + i + '">' +
      '<div class="library-item-summary">' +
        '<span class="lib-name">'  + escHtml(w.name)  + "</span>" +
        '<span class="lib-stat">速度 ' + w.speed + "</span>" +
        '<span class="lib-stat">间隔 ' + w.spawnInterval + 'ms</span>' +
        '<span class="lib-stat">权重 ' + w.weight + '%</span>' +
        '<span class="lib-stat" style="color:' + escHtml(w.color) + '">■ ' + escHtml(w.color) + '</span>' +
        '<div class="lib-actions">' +
          '<button class="ghost btn-wave-edit" data-idx="'   + i + '">编辑</button>' +
          '<button class="btn-danger btn-wave-del" data-idx="' + i + '">删除</button>' +
        "</div>" +
      "</div>" +
      '<div class="library-item-form" id="wave-form-' + i + '" style="display:none">' +
        rows +
        '<div class="lib-form-actions">' +
          '<button class="btn-wave-save" data-idx="'    + i + '">保存</button>' +
          '<button class="ghost btn-wave-cancel" data-idx="' + i + '">取消</button>' +
        "</div>" +
      "</div>" +
    "</div>";
  }).join("");
}

elWaveLibraryList.addEventListener("click", function(evt) {
  const btn = evt.target;
  if (!(btn instanceof HTMLElement)) return;

  if (btn.classList.contains("btn-wave-edit")) {
    const form = document.getElementById("wave-form-" + btn.dataset.idx);
    if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
    return;
  }
  if (btn.classList.contains("btn-wave-cancel")) {
    const form = document.getElementById("wave-form-" + btn.dataset.idx);
    if (form) form.style.display = "none";
    return;
  }
  if (btn.classList.contains("btn-wave-save")) {
    const idx = parseInt(btn.dataset.idx, 10);
    const w   = waveTypes[idx];
    waveFields.forEach(function(f) {
      const node = document.getElementById("wave-" + idx + "-" + f.key);
      if (!node) return;
      w[f.key] = f.type === "number" ? toNum(node.value, w[f.key]) : node.value;
    });
    sanitizeWave(w);
    renderWaveLibrary();
    addLog("海浪库已更新：" + w.name, "end");
    return;
  }
  if (btn.classList.contains("btn-wave-del")) {
    const idx = parseInt(btn.dataset.idx, 10);
    if (waveTypes.length <= 1) { addLog("至少需要保留 1 种海浪类型。", "dodge"); return; }
    const name = waveTypes[idx].name;
    waveTypes.splice(idx, 1);
    renderWaveLibrary();
    addLog("已从海浪库移除：" + name, "end");
    return;
  }
});

document.getElementById("btnAddWave").addEventListener("click", function() {
  const newW = {
    name: "新海浪", speed: 0.4, spawnInterval: 5000, weight: 50,
  };
  sanitizeWave(newW);
  waveTypes.push(newW);
  renderWaveLibrary();
  const newIdx = waveTypes.length - 1;
  const form   = document.getElementById("wave-form-" + newIdx);
  if (form) form.style.display = "grid";
  if (elWaveLibraryBody.style.display === "none") elWaveLibraryBody.style.display = "";
  addLog("新海浪类型已添加，请填写属性后保存。", "end");
});

// ─────────────────── Plant Spawn Library ──────────
elPlantSpawnLibraryToggle.addEventListener("click", function() {
  const open = elPlantSpawnLibraryBody.style.display === "none";
  elPlantSpawnLibraryBody.style.display = open ? "" : "none";
});

const plantSpawnFields = [
  { key: "name",          label: "名字",       type: "text"   },
  { key: "spawnInterval", label: "刷新间隔(ms)", type: "number", step: "100" },
  { key: "weight",        label: "权重比例(%)", type: "number", step: "1"   },
];

function renderPlantSpawnLibrary() {
  elPlantSpawnLibraryList.innerHTML = plantSpawnConfigs.map(function(p, i) {
    const rows = plantSpawnFields.map(function(f) {
      const fid = "spawn-" + i + "-" + f.key;
      return "<label>" + escHtml(f.label) +
        '<input id="' + fid + '" type="' + f.type + '" step="' + (f.step || "1") + '" value="' +
        escHtml(String(p[f.key] !== undefined ? p[f.key] : "")) + '"></label>';
    }).join("");

    return '<div class="library-item spawn-item" data-idx="' + i + '">' +
      '<div class="library-item-summary">' +
        '<span class="lib-name">'  + escHtml(p.name)  + "</span>" +
        '<span class="lib-stat">间隔 ' + p.spawnInterval + 'ms</span>' +
        '<span class="lib-stat">权重 ' + p.weight + '%</span>' +
        '<div class="lib-actions">' +
          '<button class="ghost btn-spawn-edit" data-idx="'   + i + '">编辑</button>' +
          '<button class="btn-danger btn-spawn-del" data-idx="' + i + '">删除</button>' +
        "</div>" +
      "</div>" +
      '<div class="library-item-form" id="spawn-form-' + i + '" style="display:none">' +
        rows +
        '<div class="lib-form-actions">' +
          '<button class="btn-spawn-save" data-idx="'    + i + '">保存</button>' +
          '<button class="ghost btn-spawn-cancel" data-idx="' + i + '">取消</button>' +
        "</div>" +
      "</div>" +
    "</div>";
  }).join("");
}

elPlantSpawnLibraryList.addEventListener("click", function(evt) {
  const btn = evt.target;
  if (!(btn instanceof HTMLElement)) return;

  if (btn.classList.contains("btn-spawn-edit")) {
    const form = document.getElementById("spawn-form-" + btn.dataset.idx);
    if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
    return;
  }
  if (btn.classList.contains("btn-spawn-cancel")) {
    const form = document.getElementById("spawn-form-" + btn.dataset.idx);
    if (form) form.style.display = "none";
    return;
  }
  if (btn.classList.contains("btn-spawn-save")) {
    const idx = parseInt(btn.dataset.idx, 10);
    const p   = plantSpawnConfigs[idx];
    plantSpawnFields.forEach(function(f) {
      const node = document.getElementById("spawn-" + idx + "-" + f.key);
      if (!node) return;
      p[f.key] = f.type === "number" ? toNum(node.value, p[f.key]) : node.value;
    });
    sanitizePlantSpawn(p);
    renderPlantSpawnLibrary();
    addLog("植物刷新库已更新：" + p.name, "end");
    return;
  }
  if (btn.classList.contains("btn-spawn-del")) {
    const idx = parseInt(btn.dataset.idx, 10);
    if (plantSpawnConfigs.length <= 1) { addLog("至少需要保留 1 个刷新配置。", "dodge"); return; }
    const name = plantSpawnConfigs[idx].name;
    plantSpawnConfigs.splice(idx, 1);
    renderPlantSpawnLibrary();
    addLog("已从植物刷新库移除：" + name, "end");
    return;
  }
});

document.getElementById("btnAddPlantSpawn").addEventListener("click", function() {
  const newP = {
    name: "新配置", spawnInterval: 5000, weight: 50,
  };
  sanitizePlantSpawn(newP);
  plantSpawnConfigs.push(newP);
  renderPlantSpawnLibrary();
  const newIdx = plantSpawnConfigs.length - 1;
  const form   = document.getElementById("spawn-form-" + newIdx);
  if (form) form.style.display = "grid";
  if (elPlantSpawnLibraryBody.style.display === "none") elPlantSpawnLibraryBody.style.display = "";
  addLog("新植物刷新配置已添加，请填写属性后保存。", "end");
});

// ─────────────────── Wave List Config Editor ──────────
elRoundConfigToggle.addEventListener("click", function() {
  const open = elRoundConfigBody.style.display === "none";
  elRoundConfigBody.style.display = open ? "" : "none";
});

function renderRoundConfig() {
  var html = '';
  waveList.forEach(function(waveDef, waveIdx) {
    html += '<div class="wl-wave-item" data-wave="' + waveIdx + '">';
    html += '<div class="wl-wave-header">';
    html += '<span class="wl-wave-title">第 ' + (waveIdx + 1) + ' 波</span>';
    if (waveList.length > 1) {
      html += '<button class="btn-danger btn-wl-del-wave" data-wave="' + waveIdx + '">删除此波</button>';
    }
    html += '</div>';
    html += '<div class="wl-monster-counts">';
    monsterTypes.forEach(function(m, mIdx) {
      var entry = null;
      for (var ei = 0; ei < waveDef.length; ei++) {
        if (waveDef[ei].monsterIdx === mIdx) { entry = waveDef[ei]; break; }
      }
      var cnt = entry ? entry.count : 0;
      html += '<label class="wl-count-label">' +
        '<span class="wl-count-name">' + m.emoji + ' ' + escHtml(m.name) + '</span>' +
        '<input type="number" min="0" step="1" class="wl-count-input"' +
          ' data-wave="' + waveIdx + '" data-midx="' + mIdx + '" value="' + cnt + '">' +
        '</label>';
    });
    html += '</div>';
    html += '<div class="lib-form-actions">';
    html += '<button class="btn-wl-save-wave" data-wave="' + waveIdx + '">保存此波</button>';
    html += '</div>';
    html += '</div>';
  });
  elRoundConfigForm.innerHTML = html;
  updateHUD();
}

elGameConfigToggle.addEventListener("click", function() {
  const open = elGameConfigBody.style.display === "none";
  elGameConfigBody.style.display = open ? "" : "none";
});

function renderGameConfig() {
  elGameConfigForm.innerHTML =
    '<label>白天时长（秒，最少5）' +
      '<input id="gc-dayDuration" type="number" min="5" step="1" value="' + gameConfig.dayDuration + '">' +
    '</label>' +
    '<label>黄昏时长（秒，最少5）' +
      '<input id="gc-duskDuration" type="number" min="5" step="1" value="' + gameConfig.duskDuration + '">' +
    '</label>' +
    '<label>夜晚最长时限（秒，0 = 无限制）' +
      '<input id="gc-nightDuration" type="number" min="0" step="1" value="' + gameConfig.nightDuration + '">' +
    '</label>' +
    '<label>玩家初始生命值' +
      '<input id="gc-initialLives" type="number" min="1" step="1" value="' + gameConfig.initialLives + '">' +
    '</label>' +
    '<div class="lib-form-actions">' +
      '<button id="btnGameConfigSave">保存</button>' +
    '</div>';

  document.getElementById("btnGameConfigSave").addEventListener("click", function() {
    gameConfig.dayDuration   = toNum(document.getElementById("gc-dayDuration").value,   gameConfig.dayDuration);
    gameConfig.duskDuration  = toNum(document.getElementById("gc-duskDuration").value,  gameConfig.duskDuration);
    gameConfig.nightDuration = toNum(document.getElementById("gc-nightDuration").value, gameConfig.nightDuration);
    gameConfig.initialLives  = toNum(document.getElementById("gc-initialLives").value,  gameConfig.initialLives);
    sanitizeGameConfig(gameConfig);
    renderGameConfig();
    addLog(
      "游戏基础配置已更新：白天 " + gameConfig.dayDuration + "s，黄昏 " + gameConfig.duskDuration + "s，夜晚限时 " +
      (gameConfig.nightDuration > 0 ? gameConfig.nightDuration + "s" : "无限制") +
      "，初始生命 " + gameConfig.initialLives + "。", "end"
    );
  });
}

elRoundConfigForm.addEventListener("click", function(evt) {
  const btn = evt.target;
  if (!(btn instanceof HTMLElement)) return;

  if (btn.classList.contains("btn-wl-save-wave")) {
    const waveIdx = parseInt(btn.dataset.wave, 10);
    const inputs  = elRoundConfigForm.querySelectorAll('.wl-count-input[data-wave="' + waveIdx + '"]');
    const newDef  = [];
    inputs.forEach(function(inp) {
      const mIdx = parseInt(inp.dataset.midx, 10);
      const cnt  = Math.max(0, Math.floor(toNum(inp.value, 0)));
      if (cnt > 0) newDef.push({ monsterIdx: mIdx, count: cnt });
    });
    waveList[waveIdx] = newDef;
    addLog("第 " + (waveIdx + 1) + " 波配置已保存。", "end");
    return;
  }

  if (btn.classList.contains("btn-wl-del-wave")) {
    const waveIdx = parseInt(btn.dataset.wave, 10);
    if (waveList.length <= 1) { addLog("至少需要保留 1 波配置。", "dodge"); return; }
    waveList.splice(waveIdx, 1);
    renderRoundConfig();
    addLog("已删除第 " + (waveIdx + 1) + " 波配置。", "end");
    return;
  }
});

document.getElementById("btnAddWave").addEventListener("click", function() {
  waveList.push([]);
  renderRoundConfig();
  if (elRoundConfigBody.style.display === "none") elRoundConfigBody.style.display = "";
  addLog("已添加第 " + waveList.length + " 波，请配置怪物数量后保存。", "end");
});

// ─────────────────── Boot ────────────────────────────

function initializeGame() {
  // 检查关键 DOM 元素是否已加载
  if (!elCollect || !elPlantingGrid || !elLog) {
    console.error("[INIT] 关键 DOM 元素未加载！", {
      elCollect: elCollect,
      elPlantingGrid: elPlantingGrid,
      elLog: elLog
    });
    setTimeout(initializeGame, 100); // 重试
    return;
  }
  
  console.log("[INIT] 开始初始化游戏");
  renderLibrary();
  renderMonsterLibrary();
  renderWaveLibrary();
  renderPlantSpawnLibrary();
  renderRoundConfig();
  renderGameConfig();
  initGrid();
  renderBackpack();
  updateHUD();
  addLog("欢迎来到植物战队！点击「开始游戏」进入第一回合。", "round");
  console.log("[INIT] 游戏初始化完成");
}

// 确保在 DOM 完全加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  // DOM 已经加载（通常在 HTTP 服务器下）
  initializeGame();
}
