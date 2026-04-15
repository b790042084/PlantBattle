// hud.js — 界面渲染（HUD / 背包 / 种植网格）

import { LANES, SLOTS, plantLibrary } from "./config.js";
import { gs } from "./state.js";
import {
  elLog, elPhaseChip, elRoundNum, elDayTimer, elTimerChip,
  elLives, elScore, elPlantingGrid, elBackpackItems, elBackpackCount,
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
export function initGrid() {
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

export function renderGrid() {
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

export function onSlotClick(e) {
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
export function renderBackpack() {
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
