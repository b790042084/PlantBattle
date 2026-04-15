// day.js — 白天与黄昏阶段逻辑

import {
  waveTypes, plantSpawnConfigs, plantLibrary,
  COLLECTION_ROWS, STRIPE_HEIGHT, SPAWN_ROW, MAX_SPAWNED,
  gameConfig, LANES, isBlackStripe,
} from "./config.js";
import { gs, elCollect, elCollectHint } from "./state.js";
import { uid, getImg, buildSvgFallback } from "./utils.js";
import { addLog, updateHUD, renderGrid, renderBackpack } from "./hud.js";
import {
  createPlayer, removePlayer, renderCarriedPlants,
  depositCarriedPlants, updatePlayerPosition,
} from "./player.js";
// Note: circular import — startNight is only called at runtime inside setTimeout
import { startNight } from "./night.js";

// ─────────────────── Interval handles ────────────────
let playerMoveInterval = null;
let waveUpdateInterval = null;
let waveSpawnInterval  = null;

// ─────────────────── Wave helpers ────────────────────
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

// ─────────────────── Wave system ─────────────────────
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
  // Check carry capacity
  if (gs.carried.length >= gs.player.maxCarry) {
    return; // Can't carry more
  }
  const sp   = gs.spawned[idx];
  const pDef = plantLibrary[sp.plantIdx];
  sp.el.classList.add("collected");
  setTimeout(function() { sp.el.remove(); }, 350);
  gs.spawned.splice(idx, 1);
  // Add to carried (above head) with stage 1 (seedling)
  gs.carried.push({ id: uid(), plantIdx: sp.plantIdx, stage: 1, plantLevel: 0 });
  renderCarriedPlants();
  addLog("拾取了 " + pDef.name + "（幼苗）！回到出生区存入背包（" + gs.carried.length + "/" + gs.player.maxCarry + "）", "end");
}

// ─────────────────── Player movement ─────────────────
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

// ─────────────────── Day Phase ───────────────────────
export function startDay() {
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
  addLog("[PLANT] 植物刷新配置: " + gs.currentPlantSpawnConfig.name + " (" + gs.currentPlantSpawnConfig.spawnInterval + "ms)", "end");

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
  removePlayer();
  gs.spawned.forEach(function(s) { s.el.remove(); });
  gs.spawned     = [];
  gs.waves.forEach(function(w) { if (w.el) w.el.remove(); });
  gs.waves = [];
  // Deposit any remaining carried plants to backpack at end of day
  if (gs.carried.length > 0) {
    gs.carried.forEach(function(c) {
      gs.backpack.push({ id: uid(), plantIdx: c.plantIdx, stage: c.stage || 1, plantLevel: c.plantLevel || 0 });
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
export function startDusk() {
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
