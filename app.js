// =============================================================
//  植物战队 — 日夜循环防守模式
//  Day phase : collect plants in 收集区 (30 s)
//  Night phase: monsters advance from 刷怪区 into 种植区
//               planted plants auto-attack using full stats
// =============================================================

const STORAGE_KEY = "plant-battle-td-v1";
const APP_VERSION = "v0.0.0-1ceb91c";

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

// ─────────────────── Constants ───────────────────────
const LANES             = 5;
const ROWS              = 2;
const SLOTS             = LANES * ROWS;
const DAY_DURATION      = 30;
const PLACEMENT_DURATION = 15;
const DUSK_DURATION     = 10;
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
};

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

  if (gs.phase === "day" || gs.phase === "placement") {
    body.classList.add("bg-day");
  } else if (gs.phase === "dusk") {
    body.classList.add("bg-dusk");
  } else if (gs.phase === "night") {
    body.classList.add("bg-night");
  }
}

function updateHUD() {
  elRoundNum.textContent = gs.round;
  if (elLives) elLives.textContent = gs.lives;
  if (elScore) elScore.textContent = gs.score;
  const labels = {
    idle:"等待开始",
    day:"白天 — 收集中",
    placement:"摆放植物",
    dusk:"黄昏 — 准备中",
    night:"夜晚 — 刷怪中",
    gameover:"游戏结束"
  };
  elPhaseChip.textContent = labels[gs.phase] || gs.phase;
  elPhaseChip.className   = "chip phase-chip phase-" + gs.phase;

  const showTimer = gs.phase === "day" || gs.phase === "placement" || gs.phase === "dusk";
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
    const canHL = gs.selectedId !== null && !plant && gs.phase === "placement";

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
    if (gs.phase === "placement") {
      gs.grid[idx] = null;
      gs.backpack.push({ id: uid(), plantIdx: plant.plantIdx });
      addLog(plant.name + " 已取回到背包", "dodge");
      renderBackpack();
      renderGrid();
    }
    return;
  }
  if (gs.phase !== "placement" || !gs.selectedId) return;

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
function spawnCollectionPlant() {
  if (gs.phase !== "day") return;
  if (gs.spawned.length >= MAX_SPAWNED) return;

  const plantIdx = Math.floor(Math.random() * plantLibrary.length);
  const pDef     = plantLibrary[plantIdx];
  const id       = uid();
  const x        = 8  + Math.random() * 78;
  const y        = 12 + Math.random() * 68;

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
  el.addEventListener("click", function() { collectPlant(id); });
  elCollect.appendChild(el);
  gs.spawned.push({ id: id, plantIdx: plantIdx, el: el });

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
  gs.backpack.push({ id: uid(), plantIdx: sp.plantIdx });
  renderBackpack();
  addLog("收集了 " + pDef.name + "！", "end");
}

// ─────────────────── Day Phase ───────────────────────
function startDay() {
  gs.phase   = "day";
  gs.phaseLeft = DAY_DURATION;
  gs.spawned = [];
  elCollect.querySelectorAll(".spawned-plant").forEach(function(e) { e.remove(); });
  if (elCollectHint) elCollectHint.style.display = "";

  updateHUD();
  addLog("════ 第 " + gs.round + " 回合 — 白天开始！" + DAY_DURATION + " 秒收集时间 ════", "round");

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
  gs.spawnHandle = setInterval(spawnCollectionPlant, SPAWN_INTERVAL);
}

function endDay() {
  clearInterval(gs.spawnHandle);
  gs.spawnHandle = null;
  gs.spawned.forEach(function(s) { s.el.remove(); });
  gs.spawned     = [];
  gs.selectedId  = null;
  if (elCollectHint) elCollectHint.style.display = "none";
  addLog("白天结束！进入摆放植物阶段…", "round");
  renderBackpack();
  renderGrid();
  setTimeout(startPlacement, 2000);
}

// ─────────────────── Placement Phase ─────────────────
function startPlacement() {
  gs.phase = "placement";
  gs.phaseLeft = PLACEMENT_DURATION;
  updateHUD();
  addLog("════ 摆放植物阶段！" + PLACEMENT_DURATION + " 秒布置防线 ════", "round");

  gs.phaseHandle = setInterval(function() {
    gs.phaseLeft -= 1;
    updateHUD();
    if (gs.phaseLeft <= 0) {
      clearInterval(gs.phaseHandle);
      gs.phaseHandle = null;
      endPlacement();
    }
  }, 1000);
}

function endPlacement() {
  gs.selectedId = null;
  addLog("摆放阶段结束！进入黄昏…", "round");
  renderBackpack();
  renderGrid();
  setTimeout(startDusk, 2000);
}

// ─────────────────── Dusk Phase ──────────────────────
function startDusk() {
  gs.phase = "dusk";
  gs.phaseLeft = DUSK_DURATION;
  updateHUD();
  addLog("════ 黄昏时分！" + DUSK_DURATION + " 秒后夜晚降临 ════", "round");

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
  addLog("黄昏结束！夜晚开始…", "round");
  setTimeout(startNight, 2000);
}

// ─────────────────── Night Phase ─────────────────────
function buildQueue() {
  const count = 5 + (gs.round - 1) * 2;
  const arr   = [];
  for (let i = 0; i < count; i++) {
    const maxType = Math.min(monsterTypes.length - 1, Math.floor(gs.round / 2));
    const ti      = Math.floor(Math.random() * (maxType + 1));
    const t       = monsterTypes[ti];
    const scale   = 1 + (gs.round - 1) * ROUND_SCALE_FACTOR;
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
  updateHUD();
  addLog("════ 夜晚开始！本波共 " + gs.mQueue.length + " 只怪物 ════", "round");
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

// ─────────────────── Night End / Game Over ────────────
function endNight() {
  if (gs.animId) { cancelAnimationFrame(gs.animId); gs.animId = null; }
  elBattleArea.querySelectorAll(".monster,.projectile-fx,.area-burst").forEach(function(e) { e.remove(); });
  gs.monsters = [];
  addLog("🎉 第 " + gs.round + " 回合胜利！当前分数：" + gs.score, "end");
  gs.round += 1;
  setTimeout(startDay, 2200);
}

function endGame() {
  if (gs.animId)     { cancelAnimationFrame(gs.animId);  gs.animId     = null; }
  if (gs.phaseHandle)  { clearInterval(gs.phaseHandle);       gs.phaseHandle  = null; }
  if (gs.spawnHandle){ clearInterval(gs.spawnHandle);     gs.spawnHandle = null; }
  gs.phase = "gameover";
  updateHUD();
  addLog("💀 游戏结束！最终分数：" + gs.score + "，坚持了 " + gs.round + " 回合", "end");
}

// ─────────────────── Start / Reset ───────────────────
function fullReset() {
  if (gs.animId)     { cancelAnimationFrame(gs.animId);  gs.animId     = null; }
  if (gs.phaseHandle)  { clearInterval(gs.phaseHandle);       gs.phaseHandle  = null; }
  if (gs.spawnHandle){ clearInterval(gs.spawnHandle);     gs.spawnHandle = null; }
  gs.phase       = "idle";
  gs.round       = 0;
  gs.score       = 0;
  gs.lives       = 5;
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
  if (gs.phase !== "idle" && gs.phase !== "gameover") return;
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ plantLibrary: plantLibrary, monsterTypes: monsterTypes }));
  addLog("植物库 & 怪物库配置已保存到本地浏览器。", "end");
});

document.getElementById("btnLoadConfig").addEventListener("click", function() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { addLog("未找到已保存配置。", "dodge"); return; }
  try {
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
    addLog("配置加载成功！", "end");
  } catch(e) { addLog("配置解析失败。", "dodge"); }
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
const elMonsterLibraryList   = document.getElementById("monsterLibraryList");
const elMonsterLibraryBody   = document.getElementById("monsterLibraryBody");
const elMonsterLibraryToggle = document.getElementById("monsterLibraryToggle");

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
    addLog("怪物库已更新：" + m.name, "end");
    return;
  }
  if (btn.classList.contains("btn-mon-del")) {
    const idx = parseInt(btn.dataset.idx, 10);
    if (monsterTypes.length <= 1) { addLog("至少需要保留 1 个怪物。", "dodge"); return; }
    const name = monsterTypes[idx].name;
    monsterTypes.splice(idx, 1);
    renderMonsterLibrary();
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
  const newIdx = monsterTypes.length - 1;
  const form   = document.getElementById("mon-form-" + newIdx);
  if (form) form.style.display = "grid";
  if (elMonsterLibraryBody.style.display === "none") elMonsterLibraryBody.style.display = "";
  addLog("新怪物已添加，请填写属性后保存。", "end");
});

// ─────────────────── Boot ────────────────────────────
renderLibrary();
renderMonsterLibrary();
initGrid();
renderBackpack();
updateHUD();
addLog("欢迎来到植物战队！点击「开始游戏」进入第一回合。", "round");
