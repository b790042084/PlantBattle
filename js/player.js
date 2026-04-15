// player.js — 玩家角色：创建、渲染、移动

import { STRIPE_HEIGHT, COLLECTION_ROWS, plantLibrary } from "./config.js";
import { gs, elCollect, elBackpackItems } from "./state.js";
import { getImg, buildSvgFallback, uid } from "./utils.js";
import { addLog, renderBackpack } from "./hud.js";

// ─────────────────── Collection Zone ─────────────────
export let elPlayer = null;

// Reference to backpack floating button for fly animation
function getBackpackBtnRect() {
  var btn = document.getElementById("btnBackpack");
  return btn ? btn.getBoundingClientRect() : null;
}

// ─────────────────── Collection Zone ─────────────────
export let elPlayer = null;

export function createPlayer() {
  if (elPlayer) elPlayer.remove();
  elPlayer = document.createElement("div");
  elPlayer.className = "player-character";
  elPlayer.innerHTML = '<span class="player-emoji">🧑</span><div class="carried-plants"></div>';
  elCollect.appendChild(elPlayer);
  updatePlayerPosition();
}

export function removePlayer() {
  if (elPlayer) {
    elPlayer.remove();
    elPlayer = null;
  }
}

export function renderCarriedPlants() {
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

export function depositCarriedPlants() {
  if (gs.carried.length === 0) return;
  const names = gs.carried.map(function(c) { return plantLibrary[c.plantIdx].name; });
  const toDeposit = gs.carried.slice();
  gs.carried = [];
  renderCarriedPlants();

  // Animate each plant flying from player to backpack button
  const playerRect = elPlayer ? elPlayer.getBoundingClientRect() : null;
  const bpBtnRect = getBackpackBtnRect();

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
    // End position: backpack button
    const endX = bpBtnRect ? bpBtnRect.left + bpBtnRect.width / 2 : window.innerWidth - 40;
    const endY = bpBtnRect ? bpBtnRect.top + bpBtnRect.height / 2 : window.innerHeight - 40;

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
      gs.backpack.push({ id: uid(), plantIdx: c.plantIdx, stage: c.stage || 1, plantLevel: c.plantLevel || 0 });
      renderBackpack();
      // Mark the last added item for pop animation
      const items = elBackpackItems.querySelectorAll(".bp-item");
      const lastItem = items[items.length - 1];
      if (lastItem) lastItem.classList.add("bp-item-new");
    }, i * 80 + 520);
  });

  addLog("回到出生区！存入背包：" + names.join("、"), "end");
}

export function updatePlayerPosition() {
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
