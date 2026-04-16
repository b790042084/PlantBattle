// main.js — 游戏初始化与顶层事件绑定

import {
  STORAGE_KEY, APP_VERSION,
  plantLibrary, monsterTypes, waveTypes, plantSpawnConfigs, waveList, gameConfig,
  sanitizeMonster, sanitizeWave, sanitizePlantSpawn, sanitizeWaveEntry, sanitizeGameConfig,
} from "./config.js";
import { sanitizePlant } from "./utils.js";
import { gs, elLog, elVersion } from "./state.js";
import { addLog, initGrid, renderBackpack, updateHUD, upgradeCarry, upgradeSpeed, upgradeZone, upgradeCrystal } from "./hud.js";
import { startDay } from "./day.js";
import { fullReset } from "./night.js";
import {
  renderLibrary, renderMonsterLibrary, renderWaveLibrary,
  renderPlantSpawnLibrary, renderRoundConfig, renderGameConfig,
} from "./editor.js";

// ─────────────────── Show app version ────────────────
if (elVersion) elVersion.textContent = APP_VERSION;

// ─────────────────── View Navigation ─────────────────
var elGameView   = document.getElementById("gameView");
var elConfigView = document.getElementById("configView");
var elLogView    = document.getElementById("logView");

function showView(view) {
  elGameView.style.display   = view === "game"   ? "" : "none";
  elConfigView.style.display = view === "config" ? "" : "none";
  elLogView.style.display    = view === "log"    ? "" : "none";
}

document.getElementById("btnGoConfig").addEventListener("click", function() { showView("config"); });
document.getElementById("btnGoLog").addEventListener("click", function() { showView("log"); });
document.getElementById("btnBackFromConfig").addEventListener("click", function() { showView("game"); });
document.getElementById("btnBackFromLog").addEventListener("click", function() { showView("game"); });

// ─────────────────── Top-level button handlers ───────
document.getElementById("btnStart").addEventListener("click", function() {
  if (gs.phase !== "idle" && gs.phase !== "gameover" && gs.phase !== "victory") return;
  if (waveList.length === 0) { addLog("请先在「每关怪物配置」中添加至少一关！", "dodge"); return; }
  fullReset();
  gs.round = 1;
  startDay();
});

document.getElementById("btnReset").addEventListener("click", function() {
  fullReset();
  elLog.innerHTML = "";
  addLog("游戏已重置。点击「开始游戏」进入第一关！", "round");
});

document.getElementById("btnClearLog").addEventListener("click", function() {
  elLog.innerHTML = "";
});

// ─────────────────── Shop button handlers ────────────
document.getElementById("btnUpgradeCarry").addEventListener("click", function() {
  upgradeCarry();
});

document.getElementById("btnUpgradeSpeed").addEventListener("click", function() {
  upgradeSpeed();
});

document.getElementById("btnUpgradeZone").addEventListener("click", function() {
  upgradeZone();
});

document.getElementById("btnUpgradeCrystal").addEventListener("click", function() {
  upgradeCrystal();
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
    addLog("植物库 & 怪物库 & 海浪库 & 植物刷新配置 & 关卡配置 & 游戏基础配置已保存到本地浏览器。", "end");
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
      if (data.gameConfig.zoneBaseSlots !== undefined) gameConfig.zoneBaseSlots = data.gameConfig.zoneBaseSlots;
      if (Array.isArray(data.gameConfig.initialUnlockedSlots)) gameConfig.initialUnlockedSlots = data.gameConfig.initialUnlockedSlots;
      if (Array.isArray(data.gameConfig.breakthroughExp)) gameConfig.breakthroughExp = data.gameConfig.breakthroughExp;
      if (data.gameConfig.breakthroughTime !== undefined) gameConfig.breakthroughTime = data.gameConfig.breakthroughTime;
      if (data.gameConfig.plantUpgradeCostBase !== undefined) gameConfig.plantUpgradeCostBase = data.gameConfig.plantUpgradeCostBase;
      if (data.gameConfig.plantUpgradeCostMult !== undefined) gameConfig.plantUpgradeCostMult = data.gameConfig.plantUpgradeCostMult;
      if (data.gameConfig.plantUpgradeStatMult !== undefined) gameConfig.plantUpgradeStatMult = data.gameConfig.plantUpgradeStatMult;
      if (data.gameConfig.crystalBaseHp !== undefined) gameConfig.crystalBaseHp = data.gameConfig.crystalBaseHp;
      if (Array.isArray(data.gameConfig.crystalUpgradeCost)) gameConfig.crystalUpgradeCost = data.gameConfig.crystalUpgradeCost;
      if (data.gameConfig.crystalUpgradeHpMult !== undefined) gameConfig.crystalUpgradeHpMult = data.gameConfig.crystalUpgradeHpMult;
      sanitizeGameConfig(gameConfig);
      renderGameConfig();
    }
    addLog("配置加载成功！", "end");
  } catch(e) {
    addLog("配置加载失败（file:// 协议不支持 localStorage）", "dodge");
    console.warn("localStorage error:", e);
  }
});

// ─────────────────── Export / Import JSON ─────────────
function buildAllConfig() {
  return {
    plantLibrary:      plantLibrary,
    monsterTypes:      monsterTypes,
    waveTypes:         waveTypes,
    plantSpawnConfigs: plantSpawnConfigs,
    waveList:          waveList,
    gameConfig:        gameConfig,
  };
}

function loadAllConfig(data) {
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
    if (data.gameConfig.zoneBaseSlots !== undefined) gameConfig.zoneBaseSlots = data.gameConfig.zoneBaseSlots;
    if (Array.isArray(data.gameConfig.initialUnlockedSlots)) gameConfig.initialUnlockedSlots = data.gameConfig.initialUnlockedSlots;
    if (Array.isArray(data.gameConfig.breakthroughExp)) gameConfig.breakthroughExp = data.gameConfig.breakthroughExp;
    if (data.gameConfig.breakthroughTime !== undefined) gameConfig.breakthroughTime = data.gameConfig.breakthroughTime;
    if (data.gameConfig.plantUpgradeCostBase !== undefined) gameConfig.plantUpgradeCostBase = data.gameConfig.plantUpgradeCostBase;
    if (data.gameConfig.plantUpgradeCostMult !== undefined) gameConfig.plantUpgradeCostMult = data.gameConfig.plantUpgradeCostMult;
    if (data.gameConfig.plantUpgradeStatMult !== undefined) gameConfig.plantUpgradeStatMult = data.gameConfig.plantUpgradeStatMult;
    if (data.gameConfig.crystalBaseHp !== undefined) gameConfig.crystalBaseHp = data.gameConfig.crystalBaseHp;
    if (Array.isArray(data.gameConfig.crystalUpgradeCost)) gameConfig.crystalUpgradeCost = data.gameConfig.crystalUpgradeCost;
    if (data.gameConfig.crystalUpgradeHpMult !== undefined) gameConfig.crystalUpgradeHpMult = data.gameConfig.crystalUpgradeHpMult;
    sanitizeGameConfig(gameConfig);
    renderGameConfig();
  }
}

document.getElementById("btnExportConfig").addEventListener("click", function() {
  try {
    var json = JSON.stringify(buildAllConfig(), null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "plant-battle-config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog("配置已导出为 JSON 文件。", "end");
  } catch(e) {
    addLog("导出失败：" + e.message, "dodge");
    console.warn("export error:", e);
  }
});

document.getElementById("btnImportConfig").addEventListener("click", function() {
  var input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", function() {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(evt) {
      try {
        var data = JSON.parse(evt.target.result);
        loadAllConfig(data);
        addLog("配置已从 JSON 文件导入成功！", "end");
      } catch(e) {
        addLog("导入失败：JSON 解析错误 — " + e.message, "dodge");
        console.warn("import error:", e);
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

// ─────────────────── Add wave (round config) ─────────
document.getElementById("btnAddRoundWave").addEventListener("click", function() {
  waveList.push([]);
  renderRoundConfig();
  const elRoundConfigBody = document.getElementById("roundConfigBody");
  if (elRoundConfigBody && elRoundConfigBody.style.display === "none") {
    elRoundConfigBody.style.display = "";
  }
  addLog("已添加第 " + waveList.length + " 关，请配置怪物数量后保存。", "end");
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
  addLog("欢迎来到植物战队！点击「开始游戏」进入第一关。", "round");
  console.log("[INIT] 游戏初始化完成");
}

// ES 模块默认 defer，DOM 必然已加载，但保留兼容逻辑
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}
