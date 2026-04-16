// hud.js — 界面渲染（HUD / 背包 / 种植网格 / 商店）

import {
  LANES, SLOTS, plantLibrary,
  STAGE_NAMES, STAGE_RATIOS, PLANT_STAGES,
  PLAYER_BASE_CARRY, CARRY_UPGRADE_COST, CARRY_UPGRADE_BONUS,
  ZONE_UPGRADE_COST, ZONE_UPGRADE_SLOTS,
  gameConfig,
  getBreakthroughExp, getBreakthroughTime,
  getPlantUpgradeCostBase, getPlantUpgradeCostMult, getPlantUpgradeStatMult,
  getZoneBaseSlots,
} from "./config.js";
import { gs } from "./state.js";
import {
  elLog, elPhaseChip, elRoundNum, elDayTimer, elTimerChip,
  elLives, elScore, elPlantingGrid, elBackpackItems, elBackpackCount,
  elGold, elShopPlantUpgrades,
} from "./state.js";
import { escHtml, getImg, buildSvgFallback, uid } from "./utils.js";
import { waveList } from "./config.js";

// ─────────────────── Backpack badge helper ───────────
function updateBackpackBadge() {
  var badge = document.getElementById("backpackCountBadge");
  if (badge) badge.textContent = gs.backpack.length;
}

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

// ─────────────────── Drag state ──────────────────────
let _dragBpId = null;      // backpack item id being dragged
let _dragGridSlot = null;  // grid slot index being dragged (for grid-to-grid feed)

// ─────────────────── Feed logic (shared by drag-drop) ─
export function feedPlant(slotIdx, backpackId) {
  const plant = gs.grid[slotIdx];
  if (!plant) return false;
  if (plant.isDormant) {
    addLog(plant.name + " 正在休眠中，无法喂养！", "dodge");
    return false;
  }

  const bpIdx = gs.backpack.findIndex(function(b) { return b.id === backpackId; });
  if (bpIdx === -1) return false;

  const feedItem = gs.backpack[bpIdx];
  if (feedItem.plantIdx !== plant.plantIdx) {
    addLog("只能用同名植物喂养！", "dodge");
    return false;
  }

  const feedStage = feedItem.stage || 1;
  const plantStage = plant.stage || 1;
  if (feedStage !== plantStage) {
    addLog("只能用同等级（" + STAGE_NAMES[plantStage - 1] + "）的植物喂养！", "dodge");
    return false;
  }

  if (plantStage >= PLANT_STAGES) {
    addLog(plant.name + " 已经是完全体，无法继续喂养！", "dodge");
    return false;
  }
  if (plant.isBreakingThrough) {
    addLog(plant.name + " 正在突破中，无法喂养！", "dodge");
    return false;
  }

  const expNeeded = getBreakthroughExp()[plantStage - 1] || 3;
  plant.breakthroughExp = (plant.breakthroughExp || 0) + 1;

  // Consume the fed plant from backpack
  gs.backpack.splice(bpIdx, 1);
  gs.selectedId = null;

  if (plant.breakthroughExp >= expNeeded) {
    plant.isBreakingThrough = true;
    plant.breakthroughTimer = getBreakthroughTime();
    plant.stage = plantStage + 1;
    addLog("🔥 " + plant.name + " 突破经验已满！开始突破（" + getBreakthroughTime() + "秒）…", "end");
  } else {
    addLog("🌿 喂养 " + plant.name + " +1 突破经验（" + plant.breakthroughExp + "/" + expNeeded + "）", "end");
  }
  renderBackpack();
  renderGrid();
  return true;
}

// Check if a backpack item can feed a grid plant
function canFeedPlant(backpackItem, plant) {
  if (!plant || !backpackItem) return false;
  if (plant.isDormant) return false;
  if (backpackItem.plantIdx !== plant.plantIdx) return false;
  if ((backpackItem.stage || 1) !== (plant.stage || 1)) return false;
  if ((plant.stage || 1) >= PLANT_STAGES) return false;
  if (plant.isBreakingThrough) return false;
  return true;
}

// Check if a grid plant can feed another grid plant
function canGridFeedPlant(sourcePlant, targetPlant) {
  if (!sourcePlant || !targetPlant) return false;
  if (targetPlant.isDormant || sourcePlant.isDormant) return false;
  if (sourcePlant.plantIdx !== targetPlant.plantIdx) return false;
  if ((sourcePlant.stage || 1) !== (targetPlant.stage || 1)) return false;
  if ((targetPlant.stage || 1) >= PLANT_STAGES) return false;
  if (targetPlant.isBreakingThrough) return false;
  return true;
}

// Feed one grid plant into another (consuming the source)
function feedPlantFromGrid(targetSlotIdx, sourceSlotIdx) {
  const target = gs.grid[targetSlotIdx];
  const source = gs.grid[sourceSlotIdx];
  if (!target || !source) return false;
  if (!canGridFeedPlant(source, target)) return false;

  const plantStage = target.stage || 1;
  const expNeeded = getBreakthroughExp()[plantStage - 1] || 3;
  target.breakthroughExp = (target.breakthroughExp || 0) + 1;

  // Remove the source plant from grid
  gs.grid[sourceSlotIdx] = null;

  if (target.breakthroughExp >= expNeeded) {
    target.isBreakingThrough = true;
    target.breakthroughTimer = getBreakthroughTime();
    target.stage = plantStage + 1;
    addLog("🔥 " + target.name + " 突破经验已满！开始突破（" + getBreakthroughTime() + "秒）…", "end");
  } else {
    addLog("🌿 喂养 " + target.name + " +1 突破经验（" + target.breakthroughExp + "/" + expNeeded + "）", "end");
  }
  renderGrid();
  return true;
}

// ─────────────────── Swap / Move in grid ─────────────
function swapPlantsInGrid(slotA, slotB) {
  const cols = LANES;
  const temp  = gs.grid[slotA];
  gs.grid[slotA] = gs.grid[slotB];
  gs.grid[slotB] = temp;

  // Update positional metadata for both slots
  if (gs.grid[slotA]) {
    gs.grid[slotA].lane    = slotA % cols;
    gs.grid[slotA].row     = Math.floor(slotA / cols);
    gs.grid[slotA].slotIdx = slotA;
  }
  if (gs.grid[slotB]) {
    gs.grid[slotB].lane    = slotB % cols;
    gs.grid[slotB].row     = Math.floor(slotB / cols);
    gs.grid[slotB].slotIdx = slotB;
  }

  const nameA = gs.grid[slotA] ? gs.grid[slotA].name : "空";
  const nameB = gs.grid[slotB] ? gs.grid[slotB].name : "空";
  if (gs.grid[slotA] && gs.grid[slotB]) {
    addLog("🔄 " + nameA + " 与 " + nameB + " 交换了位置", "end");
  } else {
    const moved = gs.grid[slotA] || gs.grid[slotB];
    const toSlot = gs.grid[slotA] ? slotA : slotB;
    addLog("➡️ " + moved.name + " 移动到 " + (toSlot % cols + 1) + "-" + (Math.floor(toSlot / cols) + 1), "end");
  }
  renderGrid();
}

function createGridPlantFromBackpackItem(item, idx) {
  const pDef  = plantLibrary[item.plantIdx];
  const baseInterval = pDef.attackMode === "melee" ? 2200 : pDef.attackMode === "area" ? 2000 : 1600;
  const stage = item.stage || 1;
  const stageRatio = STAGE_RATIOS[Math.min(stage, PLANT_STAGES) - 1] || 1;
  const plantLevel = item.plantLevel || 0;
  const levelMult = 1 + plantLevel * getPlantUpgradeStatMult();
  const effectiveHp  = Math.floor(pDef.hp  * stageRatio * levelMult);
  const effectiveAtk = Math.floor(pDef.atk * stageRatio * levelMult);
  const effectiveDf  = Math.floor(pDef.df  * stageRatio * levelMult);
  const cols = LANES;
  return Object.assign({}, pDef, {
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
    breakthroughExp:   item.breakthroughExp || 0,
    isBreakingThrough: false,
    breakthroughTimer: 0,
  });
}

function createBackpackItemFromGridPlant(plant) {
  return {
    id: uid(),
    plantIdx: plant.plantIdx,
    stage: plant.stage || 1,
    plantLevel: plant.plantLevel || 0,
    breakthroughExp: plant.breakthroughExp || 0
  };
}

// ─────────────────── Grid ────────────────────────────
export function initGrid() {
  elPlantingGrid.innerHTML = "";
  // Always show all SLOTS (5 cols × 2 rows)
  elPlantingGrid.style.gridTemplateColumns = "repeat(" + LANES + ", 1fr)";
  elPlantingGrid.style.gridTemplateRows = "repeat(2, 1fr)";
  for (let i = 0; i < SLOTS; i++) {
    const s = document.createElement("div");
    s.className    = "plant-slot";
    s.dataset.slot = i;
    s.addEventListener("click", onSlotClick);
    // Drag-drop: allow dropping backpack plants or grid plants onto grid slots
    s.addEventListener("dragover", onSlotDragOver);
    s.addEventListener("dragleave", onSlotDragLeave);
    s.addEventListener("drop", onSlotDrop);
    // Grid plant drag: start dragging a grid plant for grid-to-grid feed
    s.addEventListener("dragstart", onSlotDragStart);
    s.addEventListener("dragend", onSlotDragEnd);
    elPlantingGrid.appendChild(s);
  }
  renderGrid();
}

export function renderGrid() {
  const cols = LANES;
  for (let i = 0; i < SLOTS; i++) {
    const el    = elPlantingGrid.children[i];
    if (!el) continue;

    // Check if slot is locked
    if (!gs.unlockedSlots[i]) {
      el.className = "plant-slot slot-locked" + (gs.slotUnlockCredits > 0 ? " slot-unlockable" : "");
      el.draggable = false;
      el.innerHTML = '<div class="slot-lock-icon">🔒</div>' +
        (gs.slotUnlockCredits > 0 ? '<div class="slot-lock-hint">点击解锁</div>' : '');
      continue;
    }

    const plant = gs.grid[i];
    const canHL = gs.selectedId !== null && !plant;

    el.className = "plant-slot" +
      (plant ? " has-plant"      : "") +
      (plant && plant.isDormant ? " slot-dormant" : "") +
      (canHL ? " slot-highlight" : "");

    if (plant) {
      const ratio = Math.max(0, plant.hp) / plant.maxHp;
      const cls   = plant.isDormant ? "dormant" : ratio < 0.25 ? "crit" : ratio < 0.5 ? "low" : "";
      const pDef  = plantLibrary[plant.plantIdx];
      const img   = escHtml(getImg(pDef));
      const fb    = escHtml(buildSvgFallback(pDef.name, pDef.role));
      const shieldBadge = plant.shield > 0
        ? '<div class="slot-shield-badge">🛡' + plant.shield + "</div>" : "";
      const statusParts = [];
      if (plant.isDormant) statusParts.push("💤休眠");
      if (plant.poisonTurns > 0) statusParts.push("💧" + plant.poisonTurns);
      if (plant.slowTurns   > 0) statusParts.push("❄"  + plant.slowTurns);

      // Stage badge
      const stageIdx = (plant.stage || 1) - 1;
      const stageName = STAGE_NAMES[stageIdx] || STAGE_NAMES[PLANT_STAGES - 1];
      const stageClass = plant.stage >= PLANT_STAGES ? "stage-full" : "";
      const stageBadge = '<div class="slot-stage-badge ' + stageClass + '">' + stageName + '</div>';

      // Gold per sec badge (use pre-breakthrough stage during breakthrough)
      const goldStageIdx = plant.isBreakingThrough ? Math.max(0, stageIdx - 1) : stageIdx;
      const effectiveGold = Math.floor((pDef.goldPerSec || 0) * (STAGE_RATIOS[goldStageIdx] || STAGE_RATIOS[0]));
      const goldBadge = effectiveGold > 0 ? '<div class="slot-gold-badge">💰' + effectiveGold + '/s</div>' : '';

      // Level badge
      const levelBadge = (plant.plantLevel || 0) > 0 ? '<div class="slot-level-badge">Lv.' + plant.plantLevel + '</div>' : '';

      // Upgrade button on plant card
      const upgradeCost = getPlantUpgradeCost(plant.plantLevel || 0);
      const canAfford = gs.gold >= upgradeCost;
      const upgradeBtn = '<button class="slot-upgrade-btn" data-slot="' + i + '"' +
        (canAfford && !plant.isDormant ? '' : ' disabled') + '>⬆' + upgradeCost + '💰</button>';

      // Breakthrough EXP / progress badge
      let breakthroughBadge = '';
      const currentStage = plant.stage || 1;
      if (plant.isBreakingThrough) {
        // Show breakthrough countdown
        breakthroughBadge = '<div class="slot-bt-badge bt-active">⏳突破 ' + (plant.breakthroughTimer || 0) + 's</div>';
      } else if (currentStage < PLANT_STAGES) {
        // Show EXP progress
        const expNeeded = getBreakthroughExp()[currentStage - 1] || 3;
        const exp = plant.breakthroughExp || 0;
        breakthroughBadge = '<div class="slot-bt-badge">' +
          '<div class="slot-bt-bar"><div class="slot-bt-fill" style="width:' + (exp / expNeeded * 100) + '%"></div></div>' +
          '<span class="slot-bt-text">' + exp + '/' + expNeeded + '</span></div>';
      }

      el.innerHTML =
        shieldBadge + stageBadge + goldBadge + levelBadge +
        '<img class="slot-img" src="' + img + '" alt="' + escHtml(pDef.name) +
          '" onerror="this.onerror=null;this.src=\'' + fb + '\'">' +
        '<div class="slot-name">'   + escHtml(pDef.name) + "</div>" +
        upgradeBtn +
        breakthroughBadge +
        '<div class="slot-hpbar"><div class="slot-hpfill ' + cls + '" style="width:' + (ratio*100) + '%"></div></div>' +
        '<div class="slot-hptext">' + Math.max(0,plant.hp) + "/" + plant.maxHp +
          (statusParts.length ? " · " + statusParts.join(" ") : "") + "</div>";

      // Attach upgrade button click handler
      const upgradeEl = el.querySelector(".slot-upgrade-btn");
      if (upgradeEl) {
        upgradeEl.addEventListener("click", function(e) {
          e.stopPropagation();
          upgradePlantOnGrid(i);
        });
      }

      // Make grid plant draggable for grid-to-grid feed
      if (!plant.isDormant) {
        el.draggable = true;
      } else {
        el.draggable = false;
      }
    } else {
      el.draggable = false;
      const col = i % cols + 1;
      const row = Math.floor(i / cols) + 1;
      el.innerHTML = '<div class="slot-empty">' + (canHL ? "点击\n放置" : col + "-" + row) + "</div>";
    }
  }
}

export function onSlotClick(e) {
  const idx   = parseInt(e.currentTarget.dataset.slot, 10);

  // Handle locked slot click
  if (!gs.unlockedSlots[idx]) {
    if (gs.slotUnlockCredits > 0) {
      gs.slotUnlockCredits -= 1;
      gs.unlockedSlots[idx] = true;
      gs.activeSlots = gs.unlockedSlots.filter(function(v) { return v; }).length;
      // Ensure grid array has space
      while (gs.grid.length < SLOTS) gs.grid.push(null);
      addLog("🔓 格子 " + (idx % LANES + 1) + "-" + (Math.floor(idx / LANES) + 1) + " 已解锁！剩余解锁次数：" + gs.slotUnlockCredits, "end");
      renderGrid();
      updateHUD();
    } else {
      addLog("🔒 请先在升级商店购买「解锁格子」！", "dodge");
    }
    return;
  }

  const plant = gs.grid[idx];

  if (plant) {
    if (gs.selectedId) {
      const bpIdx = gs.backpack.findIndex(function(b) { return b.id === gs.selectedId; });
      if (bpIdx !== -1) {
        const selectedItem = gs.backpack[bpIdx];
        if (!feedPlant(idx, selectedItem.id)) {
          const oldPlant = gs.grid[idx];
          gs.backpack.splice(bpIdx, 1, createBackpackItemFromGridPlant(oldPlant));
          gs.grid[idx] = createGridPlantFromBackpackItem(selectedItem, idx);
          addLog("🔄 已与种植区植物交换位置", "end");
          gs.selectedId = null;
          renderBackpack();
          renderGrid();
        }
      } else {
        gs.selectedId = null;
        renderBackpack();
      }
      return;
    }
    if (plant.isDormant) {
      addLog(plant.name + " 正在休眠中，无法取回！", "dodge");
      return;
    }
    if (gs.backpack.length >= gs.player.maxCarry) {
      addLog("背包已满（上限 " + gs.player.maxCarry + "），无法取回植物！", "dodge");
      return;
    }
    // Click on a planted plant → pick it up back to backpack
    gs.grid[idx] = null;
    gs.backpack.push(createBackpackItemFromGridPlant(plant));
    addLog(plant.name + " 已取回到背包", "dodge");
    renderBackpack();
    renderGrid();
    return;
  }
  if (!gs.selectedId) return;

  const bpIdx = gs.backpack.findIndex(function(b) { return b.id === gs.selectedId; });
  if (bpIdx === -1) { gs.selectedId = null; renderBackpack(); return; }

  const item  = gs.backpack.splice(bpIdx, 1)[0];
  const pDef  = plantLibrary[item.plantIdx];
  const stage = item.stage || 1;
  const plantLevel = item.plantLevel || 0;
  gs.grid[idx] = createGridPlantFromBackpackItem(item, idx);

  gs.selectedId = null;
  addLog(pDef.name + "(" + STAGE_NAMES[stage - 1] + (plantLevel > 0 ? " Lv." + plantLevel : "") + ") 已种植到 " + (idx % LANES + 1) + "-" + (Math.floor(idx / LANES) + 1) + " 位置", "end");
  renderBackpack();
  renderGrid();
}

// ─────────────────── Drag-drop handlers ──────────────
function onSlotDragStart(e) {
  const idx = parseInt(e.currentTarget.dataset.slot, 10);
  const plant = gs.grid[idx];
  if (!plant || plant.isDormant) {
    e.preventDefault();
    return;
  }
  _dragGridSlot = idx;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", "grid:" + idx);
  e.currentTarget.classList.add("slot-dragging");
}

function onSlotDragEnd(e) {
  e.currentTarget.classList.remove("slot-dragging");
  _dragGridSlot = null;
  elPlantingGrid.querySelectorAll(".slot-feed-highlight, .slot-highlight, .slot-swap-highlight").forEach(function(s) {
    s.classList.remove("slot-feed-highlight");
    s.classList.remove("slot-highlight");
    s.classList.remove("slot-swap-highlight");
  });
}

function onSlotDragOver(e) {
  e.preventDefault();
  const idx   = parseInt(e.currentTarget.dataset.slot, 10);

  // Block interaction on locked slots
  if (!gs.unlockedSlots[idx]) return;

  const plant = gs.grid[idx];

  // Grid-to-grid drag
  if (_dragGridSlot !== null) {
    if (_dragGridSlot === idx) return; // Can't drop on self
    const source = gs.grid[_dragGridSlot];
    if (plant && canGridFeedPlant(source, plant)) {
      e.currentTarget.classList.add("slot-feed-highlight");
    } else if (!plant) {
      // Empty slot: allow move
      e.currentTarget.classList.add("slot-highlight");
    } else {
      // Occupied slot but can't feed: allow swap
      e.currentTarget.classList.add("slot-swap-highlight");
    }
    return;
  }

  // Backpack-to-grid drag
  if (_dragBpId === null) return;
  if (!plant) {
    // Allow drop onto empty slot for placement
    e.currentTarget.classList.add("slot-highlight");
    return;
  }
  // Check if can feed
  const bpItem = gs.backpack.find(function(b) { return b.id === _dragBpId; });
  if (canFeedPlant(bpItem, plant)) {
    e.currentTarget.classList.add("slot-feed-highlight");
  } else {
    e.currentTarget.classList.add("slot-swap-highlight");
  }
}

function onSlotDragLeave(e) {
  e.currentTarget.classList.remove("slot-feed-highlight");
  e.currentTarget.classList.remove("slot-highlight");
  e.currentTarget.classList.remove("slot-swap-highlight");
}

function onSlotDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("slot-feed-highlight");
  e.currentTarget.classList.remove("slot-highlight");
  e.currentTarget.classList.remove("slot-swap-highlight");

  const idx   = parseInt(e.currentTarget.dataset.slot, 10);

  // Block drop on locked slots
  if (!gs.unlockedSlots[idx]) { _dragBpId = null; _dragGridSlot = null; return; }

  const plant = gs.grid[idx];

  // Grid-to-grid drop
  if (_dragGridSlot !== null) {
    if (_dragGridSlot !== idx) {
      if (plant && canGridFeedPlant(gs.grid[_dragGridSlot], plant)) {
        // Feed: same type & stage → consume source
        feedPlantFromGrid(idx, _dragGridSlot);
      } else {
        // Swap (both occupied) or Move (target empty)
        swapPlantsInGrid(_dragGridSlot, idx);
      }
    }
    _dragGridSlot = null;
    return;
  }

  // Backpack-to-grid drop
  if (_dragBpId === null) return;

  if (plant) {
    // Try to feed first; otherwise swap backpack item with planted one
    if (!feedPlant(idx, _dragBpId)) {
      const bpIdx = gs.backpack.findIndex(function(b) { return b.id === _dragBpId; });
      if (bpIdx !== -1) {
        const oldPlant = gs.grid[idx];
        const selectedItem = gs.backpack[bpIdx];
        gs.backpack.splice(bpIdx, 1, createBackpackItemFromGridPlant(oldPlant));
        gs.grid[idx] = createGridPlantFromBackpackItem(selectedItem, idx);
        gs.selectedId = null;
        addLog("🔄 已与种植区植物交换位置", "end");
        renderBackpack();
        renderGrid();
      }
    }
  } else {
    // Place plant on empty slot via drag
    const bpIdx = gs.backpack.findIndex(function(b) { return b.id === _dragBpId; });
    if (bpIdx !== -1) {
      // Simulate placement: set selectedId and call placement logic
      gs.selectedId = _dragBpId;
      // Inline placement
      const item  = gs.backpack.splice(bpIdx, 1)[0];
      const pDef  = plantLibrary[item.plantIdx];
      const stage = item.stage || 1;
      const plantLevel = item.plantLevel || 0;
      gs.grid[idx] = createGridPlantFromBackpackItem(item, idx);
      gs.selectedId = null;
      addLog(pDef.name + "(" + STAGE_NAMES[stage - 1] + (plantLevel > 0 ? " Lv." + plantLevel : "") + ") 已种植到 " + (idx % LANES + 1) + "-" + (Math.floor(idx / LANES) + 1) + " 位置", "end");
      renderBackpack();
      renderGrid();
    }
  }
  _dragBpId = null;
}

// ─────────────────── Backpack ────────────────────────
export function renderBackpack() {
  if (elBackpackCount) elBackpackCount.textContent = gs.backpack.length + " 个植物";
  updateBackpackBadge();
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
    const levelMult = 1 + plantLevel * getPlantUpgradeStatMult();

    const effectiveHp  = Math.floor(p.hp  * stageRatio * levelMult);
    const effectiveAtk = Math.floor(p.atk * stageRatio * levelMult);

    // Breakthrough EXP info
    const bExp = item.breakthroughExp || 0;
    const expNeeded = stage < PLANT_STAGES ? (getBreakthroughExp()[stage - 1] || 3) : 0;
    const bExpInfo = (bExp > 0 && stage < PLANT_STAGES)
      ? '<div class="bp-exp">突破 ' + bExp + '/' + expNeeded + '</div>' : '';

    return '<div class="bp-item' + (sel ? " bp-selected" : "") + '" data-id="' + item.id + '" draggable="true">' +
      '<img src="' + img + '" alt="' + escHtml(p.name) + '" onerror="this.onerror=null;this.src=\'' + fb + '\'" draggable="false">' +
      '<div class="bp-name">' + escHtml(p.name) + "</div>" +
      '<div class="bp-stage ' + stageClass + '">' + stageName + '</div>' +
      (plantLevel > 0 ? '<div class="bp-level">Lv.' + plantLevel + '</div>' : '') +
      '<div class="bp-stat">HP ' + effectiveHp + ' ATK ' + effectiveAtk + "</div>" +
      bExpInfo +
      "</div>";
  }).join("");

  elBackpackItems.querySelectorAll(".bp-item").forEach(function(el) {
    // Click to select for placement
    el.addEventListener("click", function() {
      const id = parseInt(el.dataset.id, 10);
      gs.selectedId = gs.selectedId === id ? null : id;
      renderBackpack();
      renderGrid();
      if (gs.selectedId !== null) {
        const it = gs.backpack.find(function(b) { return b.id === id; });
        if (it) addLog("已选中 " + plantLibrary[it.plantIdx].name + "，点击空格放置或拖动到同名同阶植物喂养突破", "dodge");
      }
    });
    // Drag to feed
    el.addEventListener("dragstart", function(e) {
      const id = parseInt(el.dataset.id, 10);
      _dragBpId = id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(id));
      el.classList.add("bp-dragging");
    });
    el.addEventListener("dragend", function() {
      el.classList.remove("bp-dragging");
      _dragBpId = null;
      // Clean up any lingering highlights
      elPlantingGrid.querySelectorAll(".slot-feed-highlight, .slot-highlight, .slot-swap-highlight").forEach(function(s) {
        s.classList.remove("slot-feed-highlight");
        s.classList.remove("slot-highlight");
        s.classList.remove("slot-swap-highlight");
      });
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
  return Math.floor(getPlantUpgradeCostBase() * Math.pow(getPlantUpgradeCostMult(), plantLevel || 0));
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
  if (cost < 0) { addLog("解锁格子已达最大等级！", "dodge"); return; }
  if (gs.gold < cost) { addLog("金钱不足！需要 " + cost + " 金钱", "dodge"); return; }
  gs.gold -= cost;
  gs.plantingZoneLevel += 1;
  gs.slotUnlockCredits += ZONE_UPGRADE_SLOTS;
  addLog("🔓 获得 " + ZONE_UPGRADE_SLOTS + " 次格子解锁机会！请点击想要解锁的格子。", "end");
  renderGrid();
  updateHUD();
}

export function upgradeCrystal() {
  const cost = getCrystalUpgradeCost();
  if (cost < 0) { addLog("水晶已达最大等级！", "dodge"); return; }
  if (gs.gold < cost) { addLog("金钱不足！需要 " + cost + " 金钱", "dodge"); return; }
  gs.gold -= cost;
  gs.crystal.level += 1;
  const crystalMult = Math.pow(gameConfig.crystalUpgradeHpMult, gs.crystal.level);
  const newMaxHp = Math.floor(gameConfig.crystalBaseHp * crystalMult);
  addLog("💎 水晶升级到 Lv." + gs.crystal.level + "！最大生命值：" + newMaxHp, "end");
  updateHUD();
}

function getCrystalUpgradeCost() {
  const costs = gameConfig.crystalUpgradeCost || [100, 200, 350, 550, 800];
  if (gs.crystal.level >= costs.length) return -1;
  return costs[gs.crystal.level];
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

export function upgradePlantOnGrid(slotIdx) {
  const plant = gs.grid[slotIdx];
  if (!plant) { addLog("该格子没有植物！", "dodge"); return; }
  const cost = getPlantUpgradeCost(plant.plantLevel || 0);
  if (gs.gold < cost) { addLog("金钱不足！需要 " + cost + " 金钱", "dodge"); return; }
  gs.gold -= cost;
  plant.plantLevel = (plant.plantLevel || 0) + 1;
  const pDef = plantLibrary[plant.plantIdx];
  const stage = plant.stage || 1;
  const stageRatio = STAGE_RATIOS[Math.min(stage, PLANT_STAGES) - 1] || 1;
  const levelMult = 1 + plant.plantLevel * getPlantUpgradeStatMult();
  const newMaxHp  = Math.floor(pDef.hp  * stageRatio * levelMult);
  const newAtk    = Math.floor(pDef.atk * stageRatio * levelMult);
  const newDf     = Math.floor(pDef.df  * stageRatio * levelMult);
  const hpDiff = newMaxHp - plant.maxHp;
  plant.maxHp = newMaxHp;
  plant.hp = Math.min(plant.maxHp, plant.hp + Math.max(0, hpDiff));
  plant.atk = newAtk;
  plant.df = newDf;
  addLog(pDef.name + " 升级到 Lv." + plant.plantLevel + "！", "end");
  renderGrid();
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
  const unlockedCount = gs.unlockedSlots.filter(function(v) { return v; }).length;
  if (zoneLvl) zoneLvl.textContent = "等级 " + gs.plantingZoneLevel + " · 已解锁 " + unlockedCount + " / " + SLOTS +
    (gs.slotUnlockCredits > 0 ? " · 待解锁 " + gs.slotUnlockCredits : "");
  const zc = getZoneUpgradeCost();
  if (zoneCost) zoneCost.textContent = zc >= 0 ? zc : "MAX";
  if (zoneBtn) zoneBtn.disabled = zc < 0 || gs.gold < zc;

  // Crystal upgrade
  const crystalLvl = document.getElementById("crystalLevelDisplay");
  const crystalCost = document.getElementById("crystalCostDisplay");
  const crystalBtn = document.getElementById("btnUpgradeCrystal");
  const crystalMult = Math.pow(gameConfig.crystalUpgradeHpMult, gs.crystal.level);
  const crystalMaxHp = Math.floor(gameConfig.crystalBaseHp * crystalMult);
  if (crystalLvl) crystalLvl.textContent = "等级 " + gs.crystal.level + " · 生命值 " + crystalMaxHp;
  const crystalC = getCrystalUpgradeCost();
  if (crystalCost) crystalCost.textContent = crystalC >= 0 ? crystalC : "MAX";
  if (crystalBtn) crystalBtn.disabled = crystalC < 0 || gs.gold < crystalC;

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
            '<div class="shop-plant-stats">HP+' + Math.round(getPlantUpgradeStatMult()*100) + '% ATK+' + Math.round(getPlantUpgradeStatMult()*100) + '% DEF+' + Math.round(getPlantUpgradeStatMult()*100) + '%</div>' +
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
