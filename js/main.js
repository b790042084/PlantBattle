// main.js — 游戏初始化与顶层事件绑定

import {
  STORAGE_KEY, APP_VERSION,
  plantLibrary, monsterTypes, waveTypes, plantSpawnConfigs, waveList, gameConfig,
  sanitizeMonster, sanitizeWave, sanitizePlantSpawn, sanitizeWaveEntry, sanitizeGameConfig,
} from "./config.js";
import { sanitizePlant } from "./utils.js";
import { gs, elLog, elVersion } from "./state.js";
import { addLog, initGrid, renderBackpack, updateHUD } from "./hud.js";
import { startDay } from "./day.js";
import { fullReset } from "./night.js";
import {
  renderLibrary, renderMonsterLibrary, renderWaveLibrary,
  renderPlantSpawnLibrary, renderRoundConfig, renderGameConfig,
} from "./editor.js";

// ─────────────────── Show app version ────────────────
if (elVersion) elVersion.textContent = APP_VERSION;

// ─────────────────── Top-level button handlers ───────
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

// ─────────────────── Add wave (round config) ─────────
document.getElementById("btnAddRoundWave").addEventListener("click", function() {
  waveList.push([]);
  renderRoundConfig();
  const elRoundConfigBody = document.getElementById("roundConfigBody");
  if (elRoundConfigBody && elRoundConfigBody.style.display === "none") {
    elRoundConfigBody.style.display = "";
  }
  addLog("已添加第 " + waveList.length + " 波，请配置怪物数量后保存。", "end");
});

// ─────────────────── Boot ────────────────────────────
function initializeGame() {
  // 检查关键 DOM 元素是否已加载
  const elCollect      = document.getElementById("collectionZone");
  const elPlantingGrid = document.getElementById("plantingGrid");
  const elLogEl        = document.getElementById("log");
  if (!elCollect || !elPlantingGrid || !elLogEl) {
    console.error("[INIT] 关键 DOM 元素未加载！", {
      elCollect, elPlantingGrid, elLog: elLogEl,
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

// ES 模块默认 defer，DOM 必然已加载，但保留兼容逻辑
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}
