// night.js — 夜晚战斗阶段逻辑

import {
  waveList, monsterTypes,
  ROUND_SCALE_FACTOR, LANES, ROWS, SLOTS,
  Y_ROW, Y_BASE, MONSTER_ZONE_H, PLANTING_ROW_H,
  COMBAT_TICK, POISON_TICK, GOLD_TICK_MS,
  DEFENSE_REDUCTION, POISON_DMG_MULTIPLIER, POISON_DURATION_BONUS,
  SLOW_DURATION_MS, SHIELD_GAIN_MULTIPLIER,
  STAGE_RATIOS, PLANT_STAGES, STAGE_NAMES,
  getPlantUpgradeStatMult,
  getZoneBaseSlots,
  ATTACK_RANGE,
  gameConfig, plantLibrary,
  PLAYER_BASE_CARRY,
} from "./config.js";
import { gs, elCollect, elCollectHint, elBattleArea, elPlantingGrid } from "./state.js";
import { uid, escHtml } from "./utils.js";
import { addLog, updateHUD, renderGrid, initGrid, renderBackpack } from "./hud.js";
// Note: circular import — startDay is only called at runtime inside setTimeout
import { startDay } from "./day.js";

// ─────────────────── Build queue ─────────────────────
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

// ─────────────────── Night Phase ─────────────────────
export function startNight() {
  gs.phase     = "night";
  gs.monsters  = [];
  gs.mQueue    = buildQueue();
  gs.nextSpawn  = performance.now() + 1200;
  gs.lastFrame  = performance.now();
  gs.lastCombat = performance.now();
  gs.lastPoison = performance.now();
  gs.lastGoldTick = performance.now();
  if (elCollectHint) elCollectHint.style.display = "none";
  // Add dark fog over collection zone
  elCollect.classList.add("fog-active");
  updateHUD();
  var nightMsg = "════ 夜晚开始！本关共 " + gs.mQueue.length + " 只怪物（第 " + gs.round + " 关 / 共 " + waveList.length + " 关）";
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
  const activeCols = LANES;
  const activeRows = ROWS;
  for (let mi = 0; mi < gs.monsters.length; mi++) {
    const m = gs.monsters[mi];
    if (m.dead) continue;

    if (m.eating) {
      const slotIdx = m.eatRow * activeCols + m.lane;
      const target  = gs.grid[slotIdx];
      if (!target || target.hp <= 0 || target.isDormant) {
        m.eating  = false;
        m.eatRow  = -1;
        renderGrid();
        if (m.el) m.el.classList.remove("eating");
      } else {
        monsterAttack(m, target, ts, slotIdx);
      }
    } else {
      const effectiveSpeed = ts < m.slowUntil ? m.speed * 0.35 : m.speed;
      m.y += effectiveSpeed * dt;

      let blocked = false;
      for (let r = 0; r < activeRows; r++) {
        if (m.y >= Y_ROW[r]) {
          const slotIdx = r * activeCols + m.lane;
          const plant   = gs.grid[slotIdx];
          if (plant && plant.hp > 0 && !plant.isDormant) {
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
      }
    }
  }

  // Plant attacks on tick
  if (ts - gs.lastCombat >= COMBAT_TICK) {
    gs.lastCombat = ts;
    doPlantAttacks(ts);
  }

  // Gold generation and breakthrough timer per second
  if (ts - gs.lastGoldTick >= GOLD_TICK_MS) {
    gs.lastGoldTick = ts;
    doGoldGeneration();
    doBreakthroughTick();
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
  const activeCols = LANES;
  const el = document.createElement("div");
  el.className  = "monster";
  el.dataset.id = m.id;
  el.style.left = ((m.lane + 0.5) / activeCols * 100) + "%";
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
    // Only reset breakthrough EXP when plant is killed
    if ((plant.breakthroughExp || 0) > 0 && !plant.isBreakingThrough) {
      plant.breakthroughExp = 0;
      addLog(plant.name + " 被击倒，突破经验值已清零！", "crit");
    }
    plant.isDormant = true;
    m.eating         = false;
    m.eatRow         = -1;
    if (m.el) m.el.classList.remove("eating");
    addLog(plant.name + " 被击倒了！进入休眠状态…", "crit");
    renderGrid();
  }
}

// ─────────────────── Plant attacks monsters ──────────
function doPlantAttacks(ts) {
  const totalSlots = SLOTS;
  for (let i = 0; i < totalSlots; i++) {
    const plant = gs.grid[i];
    if (!plant || plant.hp <= 0 || plant.isDormant) continue;
    if (ts - plant.lastAttackTime < plant.attackInterval) continue;
    plant.lastAttackTime = ts;

    if (plant.slowTurns > 0) plant.slowTurns -= 1;

    // Plant position: lane (x), Y_ROW[row] (y)
    const px = plant.lane;
    const py = Y_ROW[plant.row] || Y_ROW[0];
    const range = ATTACK_RANGE[plant.attackMode] || ATTACK_RANGE.ranged;

    // Find all alive monsters within attack range
    const inRange = gs.monsters.filter(function(m) {
      if (m.dead) return false;
      const dx = px - m.lane;
      const dy = py - m.y;
      return Math.sqrt(dx * dx + dy * dy) <= range;
    });
    if (!inRange.length) continue;

    // Target closest monster (highest y value = nearest to plants)
    const target = inRange.reduce(function(a, b) { return a.y > b.y ? a : b; });

    if (plant.attackMode === "area") {
      // Area: attack all monsters within range
      inRange.forEach(function(mt) { plantAttack(plant, mt, ts, mt === target); });
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
    gs.gold  += (target.reward || 10);
    updateHUD();
    addLog("✨ " + plant.name + " 击败了 " + target.name + "！+" + (target.reward || 10) + "分/💰", "end");
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
      gs.gold  += (m.reward || 10);
      updateHUD();
      addLog(m.name + " 因中毒倒下！+" + (m.reward || 10) + "分/💰", "end");
    }
  }
}

// ─────────────────── Gold Generation ─────────────────
function doGoldGeneration() {
  let totalGold = 0;
  for (let i = 0; i < SLOTS; i++) {
    const plant = gs.grid[i];
    if (!plant || plant.hp <= 0 || plant.isDormant) continue;
    const pDef = plantLibrary[plant.plantIdx];
    const effectiveStage = plant.isBreakingThrough ? (plant.stage || 1) - 1 : (plant.stage || 1);
    const stageIdx = Math.max(0, effectiveStage - 1);
    const stageRatio = STAGE_RATIOS[stageIdx] || STAGE_RATIOS[0];
    const goldAmount = Math.floor((pDef.goldPerSec || 0) * stageRatio);
    if (goldAmount > 0) totalGold += goldAmount;
  }
  if (totalGold > 0) {
    gs.gold += totalGold;
    updateHUD();
  }
}

// ─────────────────── Breakthrough Timer ──────────────
function doBreakthroughTick() {
  let changed = false;
  for (let i = 0; i < SLOTS; i++) {
    const plant = gs.grid[i];
    if (!plant || plant.hp <= 0 || plant.isDormant) continue;
    if (!plant.isBreakingThrough) continue;

    plant.breakthroughTimer = (plant.breakthroughTimer || 0) - 1;
    if (plant.breakthroughTimer <= 0) {
      // Breakthrough complete — advance stage and apply new stats
      plant.isBreakingThrough = false;
      plant.breakthroughTimer = 0;
      plant.breakthroughExp = 0;

      const newStageIdx = (plant.stage || 1) - 1;
      const newRatio = STAGE_RATIOS[newStageIdx] || 1;
      const pDef = plantLibrary[plant.plantIdx];
      const levelMult = 1 + (plant.plantLevel || 0) * getPlantUpgradeStatMult();

      // Apply new stage stats
      const newMaxHp = Math.floor(pDef.hp * newRatio * levelMult);
      const hpDiff = newMaxHp - plant.maxHp;
      plant.maxHp = newMaxHp;
      plant.hp = Math.min(plant.maxHp, plant.hp + Math.max(0, hpDiff));
      plant.atk = Math.floor(pDef.atk * newRatio * levelMult);
      plant.df = Math.floor(pDef.df * newRatio * levelMult);

      addLog("🌟 " + plant.name + " 突破完成！进化为 " + STAGE_NAMES[newStageIdx] + "！", "end");
      changed = true;
    }
  }
  if (changed) {
    renderGrid();
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
  addLog("🏆 恭喜通关！全部 " + waveList.length + " 关怪物已击败！最终分数：" + gs.score, "end");
}

export function endNight() {
  if (gs.nightHandle) { clearTimeout(gs.nightHandle); gs.nightHandle = null; }
  if (gs.animId) { cancelAnimationFrame(gs.animId); gs.animId = null; }
  elBattleArea.querySelectorAll(".monster,.projectile-fx,.area-burst").forEach(function(e) { e.remove(); });
  gs.monsters = [];
  gs.mQueue   = [];
  addLog("🎉 第 " + gs.round + " 关胜利！当前分数：" + gs.score, "end");
  if (gs.round >= waveList.length) {
    victory();
    return;
  }
  gs.round += 1;
  setTimeout(startDay, 2200);
}

export function endGame() {
  if (gs.nightHandle)  { clearTimeout(gs.nightHandle);   gs.nightHandle  = null; }
  if (gs.animId)     { cancelAnimationFrame(gs.animId);  gs.animId     = null; }
  if (gs.phaseHandle)  { clearInterval(gs.phaseHandle);       gs.phaseHandle  = null; }
  if (gs.spawnHandle){ clearInterval(gs.spawnHandle);     gs.spawnHandle = null; }
  gs.phase = "gameover";
  updateHUD();
  addLog("💀 游戏结束！最终分数：" + gs.score + "，坚持了 " + gs.round + " 关", "end");
}

// ─────────────────── Full Reset ──────────────────────
export function fullReset() {
  if (gs.nightHandle)  { clearTimeout(gs.nightHandle);   gs.nightHandle  = null; }
  if (gs.animId)     { cancelAnimationFrame(gs.animId);  gs.animId     = null; }
  if (gs.phaseHandle)  { clearInterval(gs.phaseHandle);       gs.phaseHandle  = null; }
  if (gs.spawnHandle){ clearInterval(gs.spawnHandle);     gs.spawnHandle = null; }
  gs.phase       = "idle";
  gs.round       = 0;
  gs.score       = 0;
  gs.gold        = 0;
  gs.lives       = gameConfig.initialLives;
  gs.phaseLeft   = 0;
  gs.spawned     = [];
  gs.backpack    = [];
  gs.selectedId  = null;
  gs.carried     = [];
  gs.lastGoldTick = 0;

  // Reset player attributes
  gs.player.maxCarry = PLAYER_BASE_CARRY;
  gs.player.carryLevel = 0;

  // Reset planting zone
  gs.plantingZoneLevel = 0;
  gs.activeSlots = gameConfig.zoneBaseSlots;
  gs.grid        = Array(SLOTS).fill(null);
  // Reset unlocked slots to initial
  gs.unlockedSlots = Array(SLOTS).fill(false);
  (gameConfig.initialUnlockedSlots || [2, 7]).forEach(function(idx) {
    if (idx >= 0 && idx < SLOTS) gs.unlockedSlots[idx] = true;
  });
  gs.slotUnlockCredits = 0;

  gs.monsters    = [];
  gs.mQueue      = [];
  elCollect.querySelectorAll(".spawned-plant").forEach(function(e) { e.remove(); });
  elBattleArea.querySelectorAll(".monster,.projectile-fx,.area-burst").forEach(function(e) { e.remove(); });
  if (elCollectHint) elCollectHint.style.display = "";
  initGrid();
  renderBackpack();
  updateHUD();
}
