// hud.js — 界面渲染（HUD / 背包 / 种植网格 / 商店）

import {
  LANES, SLOTS, plantLibrary,
  STAGE_NAMES, STAGE_RATIOS, PLANT_STAGES,
  PLAYER_BASE_CARRY, CARRY_UPGRADE_COST, CARRY_UPGRADE_BONUS,
  ZONE_BASE_SLOTS, ZONE_UPGRADE_COST, ZONE_UPGRADE_SLOTS,
  PLANT_UPGRADE_COST_BASE, PLANT_UPGRADE_COST_MULT, PLANT_UPGRADE_STAT_MULT,
} from "./config.js";
import { gs } from "./state.js";
import {
  elLog, elPhaseChip, elRoundNum, elDayTimer, elTimerChip,
  elLives, elScore, elPlantingGrid, elBackpackItems, elBackpackCount,
  elGold, elShopPlantUpgrades,
} from "./state.js";
import { escHtml, getImg, buildSvgFallback, uid } from "./utils.js";
import { waveList } from "./config.js";

// ─────────────────── Logging ─────────────────────────
export function addLog(text, type) {
  if (type === undefined) type = "hit";
  const d = document.createElement("div");
  d.className   = "log-line log-" + type;
  d.textContent = text;
  elLog.appendChild(d);
  elLog.scrollTop = elLog.scrollHeight;
}

// ─────────────────── HUD ─────────────────────────────
export function updateBackground() {
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

export function updateHUD() {
  elRoundNum.textContent = gs.round + (waveList.length > 0 ? " / " + waveList.length : "");
  if (elLives) elLives.textContent = gs.lives;
  if (elScore) elScore.textContent = gs.score;
  if (elGold)  elGold.textContent  = gs.gold;
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
  // Update shop displays
  updateShopDisplay();
}

// ─────────────────── Grid ────────────────────────────
export function initGrid() {
  elPlantingGrid.innerHTML = "";
  // Use activeSlots to determine how many grid slots to show
  const totalSlots = Math.min(gs.activeSlots, SLOTS);
  // Update grid template columns based on active slots
  const cols = Math.min(totalSlots, LANES);
  elPlantingGrid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
  const rows = Math.ceil(totalSlots / cols);
  elPlantingGrid.style.gridTemplateRows = "repeat(" + rows + ", 1fr)";
  for (let i = 0; i < totalSlots; i++) {
    const s = document.createElement("div");
    s.className    = "plant-slot";
    s.dataset.slot = i;
    s.addEventListener("click", onSlotClick);
    elPlantingGrid.appendChild(s);
  }
  renderGrid();
}

export function renderGrid() {
  const totalSlots = Math.min(gs.activeSlots, SLOTS);
  const cols = Math.min(totalSlots, LANES);
  for (let i = 0; i < totalSlots; i++) {
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

      // Stage badge
      const stageIdx = (plant.stage || 1) - 1;
      const stageName = STAGE_NAMES[stageIdx] || STAGE_NAMES[PLANT_STAGES - 1];
      const stageClass = plant.stage >= PLANT_STAGES ? "stage-full" : "";
      const stageBadge = '<div class="slot-stage-badge ' + stageClass + '">' + stageName + '</div>';

      // Gold per sec badge
      const effectiveGold = Math.floor((pDef.goldPerSec || 0) * (STAGE_RATIOS[stageIdx] || 1));
      const goldBadge = effectiveGold > 0 ? '<div class="slot-gold-badge">💰' + effectiveGold + '/s</div>' : '';

      // Level badge
      const levelBadge = (plant.plantLevel || 0) > 0 ? '<div class="slot-level-badge">Lv.' + plant.plantLevel + '</div>' : '';

      el.innerHTML =
        shieldBadge + stageBadge + goldBadge + levelBadge +
        '<img class="slot-img" src="' + img + '" alt="' + escHtml(pDef.name) +
          '" onerror="this.onerror=null;this.src=\'' + fb + '\'">' +
        '<div class="slot-name">'   + escHtml(pDef.name) + "</div>" +
        '<div class="slot-hpbar"><div class="slot-hpfill ' + cls + '" style="width:' + (ratio*100) + '%"></div></div>' +
        '<div class="slot-hptext">' + Math.max(0,plant.hp) + "/" + plant.maxHp +
          (statusParts.length ? " · " + statusParts.join(" ") : "") + "</div>";
    } else {
      const col = i % cols + 1;
      const row = Math.floor(i / cols) + 1;
      el.innerHTML = '<div class="slot-empty">' + (canHL ? "点击\n放置" : col + "-" + row) + "</div>";
    }
  }
}

export function onSlotClick(e) {
  const idx   = parseInt(e.currentTarget.dataset.slot, 10);
  const plant = gs.grid[idx];

  if (plant) {
    if (gs.phase === "dusk") {
      gs.grid[idx] = null;
      gs.backpack.push({ id: uid(), plantIdx: plant.plantIdx, stage: plant.stage || PLANT_STAGES, plantLevel: plant.plantLevel || 0 });
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

  // Apply growth stage ratio and plant level multiplier
  const stage = item.stage || 1;
  const stageRatio = STAGE_RATIOS[Math.min(stage, PLANT_STAGES) - 1] || 1;
  const plantLevel = item.plantLevel || 0;
  const levelMult = 1 + plantLevel * PLANT_UPGRADE_STAT_MULT;
  const effectiveHp  = Math.floor(pDef.hp  * stageRatio * levelMult);
  const effectiveAtk = Math.floor(pDef.atk * stageRatio * levelMult);
  const effectiveDf  = Math.floor(pDef.df  * stageRatio * levelMult);

  const cols = Math.min(gs.activeSlots, LANES);
  gs.grid[idx] = Object.assign({}, pDef, {
    id:             uid(),
    plantIdx:       item.plantIdx,
    maxHp:          effectiveHp,
    hp:             effectiveHp,
    atk:            effectiveAtk,
    df:             effectiveDf,
    shield:         0,
    poisonTurns:    0,
    poisonDmg:      0,
    slowTurns:      0,
    currentCd:      0,
    lane:           idx % cols,
    row:            Math.floor(idx / cols),
    slotIdx:        idx,
    lastAttackTime: 0,
    attackInterval: baseInterval,
    stage:          stage,
    plantLevel:     plantLevel,
    growthTimer:    0,
  });

  gs.selectedId = null;
  addLog(pDef.name + "(" + STAGE_NAMES[stage - 1] + (plantLevel > 0 ? " Lv." + plantLevel : "") + ") 已种植到 " + (idx % cols + 1) + "-" + (Math.floor(idx / cols) + 1) + " 位置", "end");
  renderBackpack();
  renderGrid();
}

// ─────────────────── Backpack ────────────────────────
export function renderBackpack() {
  if (elBackpackCount) elBackpackCount.textContent = gs.backpack.length + " 个植物";
  elBackpackItems.innerHTML = gs.backpack.map(function(item) {
    const p   = plantLibrary[item.plantIdx];
    const img = escHtml(getImg(p));
    const fb  = escHtml(buildSvgFallback(p.name, p.role));
    const sel = item.id === gs.selectedId;

    // Growth stage info
    const stage = item.stage || 1;
    const stageRatio = STAGE_RATIOS[Math.min(stage, PLANT_STAGES) - 1] || 1;
    const stageName = STAGE_NAMES[Math.min(stage, PLANT_STAGES) - 1] || STAGE_NAMES[0];
    const stageClass = stage >= PLANT_STAGES ? "stage-4" : "";

    // Plant level info
    const plantLevel = item.plantLevel || 0;
    const levelMult = 1 + plantLevel * PLANT_UPGRADE_STAT_MULT;

    const effectiveHp  = Math.floor(p.hp  * stageRatio * levelMult);
    const effectiveAtk = Math.floor(p.atk * stageRatio * levelMult);

    return '<div class="bp-item' + (sel ? " bp-selected" : "") + '" data-id="' + item.id + '">' +
      '<img src="' + img + '" alt="' + escHtml(p.name) + '" onerror="this.onerror=null;this.src=\'' + fb + '\'">' +
      '<div class="bp-name">' + escHtml(p.name) + "</div>" +
      '<div class="bp-stage ' + stageClass + '">' + stageName + ' (' + Math.round(stageRatio * 100) + '%)</div>' +
      (plantLevel > 0 ? '<div class="bp-level">Lv.' + plantLevel + '</div>' : '') +
      '<div class="bp-stat">HP ' + effectiveHp + ' ATK ' + effectiveAtk + "</div>" +
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

// ─────────────────── Shop / Upgrades ─────────────────

export function getCarryUpgradeCost() {
  const lvl = gs.player.carryLevel;
  return lvl < CARRY_UPGRADE_COST.length ? CARRY_UPGRADE_COST[lvl] : -1;
}

export function getZoneUpgradeCost() {
  const lvl = gs.plantingZoneLevel;
  return lvl < ZONE_UPGRADE_COST.length ? ZONE_UPGRADE_COST[lvl] : -1;
}

export function getPlantUpgradeCost(plantLevel) {
  return Math.floor(PLANT_UPGRADE_COST_BASE * Math.pow(PLANT_UPGRADE_COST_MULT, plantLevel || 0));
}

export function upgradeCarry() {
  const cost = getCarryUpgradeCost();
  if (cost < 0) { addLog("携带数量已达最大等级！", "dodge"); return; }
  if (gs.gold < cost) { addLog("金钱不足！需要 " + cost + " 金钱", "dodge"); return; }
  gs.gold -= cost;
  gs.player.carryLevel += 1;
  gs.player.maxCarry = PLAYER_BASE_CARRY + gs.player.carryLevel * CARRY_UPGRADE_BONUS;
  addLog("携带数量升级！当前上限：" + gs.player.maxCarry, "end");
  updateHUD();
}

export function upgradeZone() {
  const cost = getZoneUpgradeCost();
  if (cost < 0) { addLog("种植区已达最大等级！", "dodge"); return; }
  if (gs.gold < cost) { addLog("金钱不足！需要 " + cost + " 金钱", "dodge"); return; }
  gs.gold -= cost;
  gs.plantingZoneLevel += 1;
  gs.activeSlots = Math.min(ZONE_BASE_SLOTS + gs.plantingZoneLevel * ZONE_UPGRADE_SLOTS, SLOTS);
  // Resize grid array if needed
  while (gs.grid.length < gs.activeSlots) gs.grid.push(null);
  addLog("种植区升级！当前格子数：" + gs.activeSlots, "end");
  initGrid();
  updateHUD();
}

export function upgradePlantInBackpack(backpackId) {
  const bpIdx = gs.backpack.findIndex(function(b) { return b.id === backpackId; });
  if (bpIdx === -1) { addLog("找不到该植物！", "dodge"); return; }
  const item = gs.backpack[bpIdx];
  const cost = getPlantUpgradeCost(item.plantLevel || 0);
  if (gs.gold < cost) { addLog("金钱不足！需要 " + cost + " 金钱", "dodge"); return; }
  gs.gold -= cost;
  item.plantLevel = (item.plantLevel || 0) + 1;
  const pDef = plantLibrary[item.plantIdx];
  addLog(pDef.name + " 升级到 Lv." + item.plantLevel + "！", "end");
  renderBackpack();
  updateHUD();
}

export function updateShopDisplay() {
  // Carry upgrade
  const carryLvl = document.getElementById("carryLevelDisplay");
  const carryCost = document.getElementById("carryCostDisplay");
  const carryBtn = document.getElementById("btnUpgradeCarry");
  if (carryLvl) carryLvl.textContent = "等级 " + gs.player.carryLevel + " · 当前上限 " + gs.player.maxCarry;
  const cc = getCarryUpgradeCost();
  if (carryCost) carryCost.textContent = cc >= 0 ? cc : "MAX";
  if (carryBtn) carryBtn.disabled = cc < 0 || gs.gold < cc;

  // Zone upgrade
  const zoneLvl = document.getElementById("zoneLevelDisplay");
  const zoneCost = document.getElementById("zoneCostDisplay");
  const zoneBtn = document.getElementById("btnUpgradeZone");
  if (zoneLvl) zoneLvl.textContent = "等级 " + gs.plantingZoneLevel + " · 当前格子 " + gs.activeSlots;
  const zc = getZoneUpgradeCost();
  if (zoneCost) zoneCost.textContent = zc >= 0 ? zc : "MAX";
  if (zoneBtn) zoneBtn.disabled = zc < 0 || gs.gold < zc;

  // Plant upgrades in backpack
  if (elShopPlantUpgrades) {
    if (gs.backpack.length === 0) {
      elShopPlantUpgrades.innerHTML = '<div style="font-size:12px;color:#aaa;padding:4px;">背包中没有植物</div>';
    } else {
      elShopPlantUpgrades.innerHTML = gs.backpack.map(function(item) {
        const p = plantLibrary[item.plantIdx];
        const img = escHtml(getImg(p));
        const fb = escHtml(buildSvgFallback(p.name, p.role));
        const lvl = item.plantLevel || 0;
        const cost = getPlantUpgradeCost(lvl);
        const stage = item.stage || 1;
        const stageName = STAGE_NAMES[Math.min(stage, PLANT_STAGES) - 1];
        const canBuy = gs.gold >= cost;
        return '<div class="shop-plant-item">' +
          '<img src="' + img + '" alt="' + escHtml(p.name) + '" onerror="this.onerror=null;this.src=\'' + fb + '\'">' +
          '<div class="shop-plant-info">' +
            '<div class="shop-plant-name">' + escHtml(p.name) + ' (' + stageName + ')' + (lvl > 0 ? ' Lv.' + lvl : '') + '</div>' +
            '<div class="shop-plant-stats">HP+' + Math.round(PLANT_UPGRADE_STAT_MULT*100) + '% ATK+' + Math.round(PLANT_UPGRADE_STAT_MULT*100) + '% DEF+' + Math.round(PLANT_UPGRADE_STAT_MULT*100) + '%</div>' +
          '</div>' +
          '<button class="shop-buy-btn btn-upgrade-plant" data-bp-id="' + item.id + '"' + (canBuy ? '' : ' disabled') + '>升级 ' + cost + '💰</button>' +
        '</div>';
      }).join("");

      // Attach click events
      elShopPlantUpgrades.querySelectorAll(".btn-upgrade-plant").forEach(function(btn) {
        btn.addEventListener("click", function() {
          const bpId = parseInt(btn.dataset.bpId, 10);
          upgradePlantInBackpack(bpId);
        });
      });
    }
  }
}
