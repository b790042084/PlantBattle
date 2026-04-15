// editor.js — 植物/怪物/海浪/刷新/回合/游戏配置编辑器 UI

import {
  plantLibrary, monsterTypes, waveTypes, plantSpawnConfigs, waveList, gameConfig,
  SLOTS, LANES,
  sanitizeMonster, sanitizeWave, sanitizePlantSpawn, sanitizeWaveEntry, sanitizeGameConfig,
} from "./config.js";
import { sanitizePlant, escHtml, getImg, buildSvgFallback, toNum, roleLabel, modeLabel } from "./utils.js";
import {
  gs,
  elLibraryList, elLibraryBody, elLibraryToggle,
  elMonsterLibraryList, elMonsterLibraryBody, elMonsterLibraryToggle,
  elWaveLibraryList, elWaveLibraryBody, elWaveLibraryToggle,
  elPlantSpawnLibraryList, elPlantSpawnLibraryBody, elPlantSpawnLibraryToggle,
  elRoundConfigBody, elRoundConfigToggle, elRoundConfigForm,
  elGameConfigBody, elGameConfigToggle, elGameConfigForm,
} from "./state.js";
import { addLog, renderGrid, renderBackpack, updateHUD } from "./hud.js";

// ─────────────────── Plant Library Editor ────────────

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
  { key: "goldPerSec", label: "每秒产金", type: "number", step: "1"    },
];

const selectOptions = {
  role:       [["defender","防御"],["attacker","输出"],["support","辅助"]],
  attackMode: [["melee","近战突进"],["ranged","远程弹道"],["area","范围爆发"]],
  skillType:  [["normal","普通伤害"],["poison","中毒DoT"],["shield","自身护盾"],["slow","减速怪物"]],
};

export function renderLibrary() {
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
        '<span class="lib-stat">💰' + (p.goldPerSec || 0) + '/s</span>' +
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

elLibraryToggle.addEventListener("click", function() {
  const open = elLibraryBody.style.display === "none";
  elLibraryBody.style.display = open ? "" : "none";
});

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
       "skillName","skillCoef","skillCd","skillType","goldPerSec"].forEach(function(k) { live[k] = p[k]; });
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
      .map(function(b)    { return { id: b.id, plantIdx: b.plantIdx > idx ? b.plantIdx - 1 : b.plantIdx, stage: b.stage || 1, plantLevel: b.plantLevel || 0 }; });
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
    goldPerSec: 3,
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

const monsterFields = [
  { key: "name",           label: "名字",       type: "text"   },
  { key: "emoji",          label: "Emoji",      type: "text"   },
  { key: "hp",             label: "HP",         type: "number", step: "1"    },
  { key: "atk",            label: "ATK",        type: "number", step: "1"    },
  { key: "speed",          label: "移动速度",   type: "number", step: "0.01" },
  { key: "attackInterval", label: "攻击间隔(ms)", type: "number", step: "100" },
  { key: "reward",         label: "击杀奖励",   type: "number", step: "1"    },
];

export function renderMonsterLibrary() {
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

elMonsterLibraryToggle.addEventListener("click", function() {
  const open = elMonsterLibraryBody.style.display === "none";
  elMonsterLibraryBody.style.display = open ? "" : "none";
});

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

const waveFields = [
  { key: "name",          label: "名字",       type: "text"   },
  { key: "speed",         label: "移动速度",   type: "number", step: "0.05" },
  { key: "spawnInterval", label: "刷新间隔(ms)", type: "number", step: "100" },
  { key: "weight",        label: "权重比例(%)", type: "number", step: "1"   },
  { key: "color",         label: "颜色",       type: "color"  },
];

export function renderWaveLibrary() {
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

elWaveLibraryToggle.addEventListener("click", function() {
  const open = elWaveLibraryBody.style.display === "none";
  elWaveLibraryBody.style.display = open ? "" : "none";
});

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

const plantSpawnFields = [
  { key: "name",          label: "名字",       type: "text"   },
  { key: "spawnInterval", label: "刷新间隔(ms)", type: "number", step: "100" },
  { key: "weight",        label: "权重比例(%)", type: "number", step: "1"   },
];

export function renderPlantSpawnLibrary() {
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

elPlantSpawnLibraryToggle.addEventListener("click", function() {
  const open = elPlantSpawnLibraryBody.style.display === "none";
  elPlantSpawnLibraryBody.style.display = open ? "" : "none";
});

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

export function renderRoundConfig() {
  var html = '';
  waveList.forEach(function(waveDef, waveIdx) {
    html += '<div class="wl-wave-item" data-wave="' + waveIdx + '">';
    html += '<div class="wl-wave-header">';
    html += '<span class="wl-wave-title">第 ' + (waveIdx + 1) + ' 关</span>';
    if (waveList.length > 1) {
      html += '<button class="btn-danger btn-wl-del-wave" data-wave="' + waveIdx + '">删除此关</button>';
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
    html += '<button class="btn-wl-save-wave" data-wave="' + waveIdx + '">保存此关</button>';
    html += '</div>';
    html += '</div>';
  });
  elRoundConfigForm.innerHTML = html;
  updateHUD();
}

elRoundConfigToggle.addEventListener("click", function() {
  const open = elRoundConfigBody.style.display === "none";
  elRoundConfigBody.style.display = open ? "" : "none";
});

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
    addLog("第 " + (waveIdx + 1) + " 关配置已保存。", "end");
    return;
  }

  if (btn.classList.contains("btn-wl-del-wave")) {
    const waveIdx = parseInt(btn.dataset.wave, 10);
    if (waveList.length <= 1) { addLog("至少需要保留 1 关配置。", "dodge"); return; }
    waveList.splice(waveIdx, 1);
    renderRoundConfig();
    addLog("已删除第 " + (waveIdx + 1) + " 关配置。", "end");
    return;
  }
});

// ─────────────────── Game Config Editor ──────────────

export function renderGameConfig() {
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
    '<label>种植区初始格子数（最少1）' +
      '<input id="gc-zoneBaseSlots" type="number" min="1" step="1" value="' + gameConfig.zoneBaseSlots + '">' +
    '</label>' +
    '<label>突破所需经验（逗号分隔，对应 阶段1→2, 2→3, 3→4）' +
      '<input id="gc-breakthroughExp" type="text" value="' + gameConfig.breakthroughExp.join(",") + '">' +
    '</label>' +
    '<label>突破所需时间（秒）' +
      '<input id="gc-breakthroughTime" type="number" min="1" step="1" value="' + gameConfig.breakthroughTime + '">' +
    '</label>' +
    '<label>植物升级基础费用' +
      '<input id="gc-plantUpgradeCostBase" type="number" min="1" step="1" value="' + gameConfig.plantUpgradeCostBase + '">' +
    '</label>' +
    '<label>植物升级费用倍率' +
      '<input id="gc-plantUpgradeCostMult" type="number" min="1" step="0.1" value="' + gameConfig.plantUpgradeCostMult + '">' +
    '</label>' +
    '<label>植物升级属性增幅（如 0.15 = 每级+15%）' +
      '<input id="gc-plantUpgradeStatMult" type="number" min="0.01" step="0.01" value="' + gameConfig.plantUpgradeStatMult + '">' +
    '</label>' +
    '<div class="lib-form-actions">' +
      '<button id="btnGameConfigSave">保存</button>' +
    '</div>';

  document.getElementById("btnGameConfigSave").addEventListener("click", function() {
    gameConfig.dayDuration   = toNum(document.getElementById("gc-dayDuration").value,   gameConfig.dayDuration);
    gameConfig.duskDuration  = toNum(document.getElementById("gc-duskDuration").value,  gameConfig.duskDuration);
    gameConfig.nightDuration = toNum(document.getElementById("gc-nightDuration").value, gameConfig.nightDuration);
    gameConfig.initialLives  = toNum(document.getElementById("gc-initialLives").value,  gameConfig.initialLives);
    gameConfig.zoneBaseSlots = toNum(document.getElementById("gc-zoneBaseSlots").value,  gameConfig.zoneBaseSlots);
    // Parse breakthroughExp as comma-separated integers
    var expStr = document.getElementById("gc-breakthroughExp").value || "";
    var expArr = expStr.split(",").map(function(s) { return Math.max(1, Math.floor(toNum(s.trim(), 3))); });
    if (expArr.length > 0) gameConfig.breakthroughExp = expArr;
    gameConfig.breakthroughTime    = toNum(document.getElementById("gc-breakthroughTime").value,    gameConfig.breakthroughTime);
    gameConfig.plantUpgradeCostBase = toNum(document.getElementById("gc-plantUpgradeCostBase").value, gameConfig.plantUpgradeCostBase);
    gameConfig.plantUpgradeCostMult = toNum(document.getElementById("gc-plantUpgradeCostMult").value, gameConfig.plantUpgradeCostMult);
    gameConfig.plantUpgradeStatMult = toNum(document.getElementById("gc-plantUpgradeStatMult").value, gameConfig.plantUpgradeStatMult);
    sanitizeGameConfig(gameConfig);
    renderGameConfig();
    addLog(
      "游戏基础配置已更新：白天 " + gameConfig.dayDuration + "s，黄昏 " + gameConfig.duskDuration + "s，夜晚限时 " +
      (gameConfig.nightDuration > 0 ? gameConfig.nightDuration + "s" : "无限制") +
      "，初始生命 " + gameConfig.initialLives +
      "，种植区初始格子 " + gameConfig.zoneBaseSlots +
      "，突破经验 [" + gameConfig.breakthroughExp.join(",") + "]" +
      "，突破时间 " + gameConfig.breakthroughTime + "s" +
      "，升级基础费用 " + gameConfig.plantUpgradeCostBase +
      "，升级费用倍率 " + gameConfig.plantUpgradeCostMult +
      "，升级属性增幅 " + (gameConfig.plantUpgradeStatMult * 100) + "%。", "end"
    );
  });
}

elGameConfigToggle.addEventListener("click", function() {
  const open = elGameConfigBody.style.display === "none";
  elGameConfigBody.style.display = open ? "" : "none";
});
