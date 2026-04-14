const STORAGE_KEY = "plant-battle-config-v3";

// 植物库 —— 所有可供选择的植物
const plantLibrary = [
  { name: "坚果墙", image: "", role: "defender", attackMode: "melee", hp: 1800, atk: 60, df: 80, crit: 0.1, critDmg: 1.5, dodge: 0.05, skillName: "硬壳格挡", skillCoef: 1.2, skillCd: 2, skillType: "shield" },
  { name: "豌豆射手", image: "", role: "attacker", attackMode: "ranged", hp: 900, atk: 180, df: 30, crit: 0.2, critDmg: 1.5, dodge: 0.0, skillName: "三连豌豆", skillCoef: 1.8, skillCd: 2, skillType: "normal" },
  { name: "寒冰射手", image: "", role: "attacker", attackMode: "ranged", hp: 1000, atk: 150, df: 40, crit: 0.15, critDmg: 1.5, dodge: 0.0, skillName: "寒冰重击", skillCoef: 1.6, skillCd: 1, skillType: "slow" },
  { name: "铁桶坚果", image: "", role: "defender", attackMode: "melee", hp: 2000, atk: 70, df: 90, crit: 0.08, critDmg: 1.5, dodge: 0.03, skillName: "反伤硬化", skillCoef: 1.2, skillCd: 2, skillType: "shield" },
  { name: "毒液花", image: "", role: "attacker", attackMode: "area", hp: 850, atk: 170, df: 35, crit: 0.18, critDmg: 1.5, dodge: 0.0, skillName: "毒刺爆发", skillCoef: 1.9, skillCd: 3, skillType: "poison" },
  { name: "机枪豌豆", image: "", role: "attacker", attackMode: "ranged", hp: 1100, atk: 140, df: 45, crit: 0.12, critDmg: 1.5, dodge: 0.0, skillName: "弹幕扫射", skillCoef: 1.7, skillCd: 2, skillType: "normal" }
];

// 阵容索引：每队3个位置，值为 plantLibrary 下标
const teamCompositionA = [0, 1, 2];
const teamCompositionB = [3, 4, 5];

// 工作模板（由库+阵容推导，let 可重赋值）
let templateA = teamCompositionA.map(i => ({ ...plantLibrary[i] }));
let templateB = teamCompositionB.map(i => ({ ...plantLibrary[i] }));

const effectSettings = {
  poisonTurns: 2,
  poisonScale: 0.25,
  shieldScale: 1.2,
  slowTurns: 1
};

const state = {
  teamA: [],
  teamB: [],
  running: false,
  timer: null,
  round: 0,
  hpA: [],
  hpB: [],
  dmgA: [],
  dmgB: [],
  battleState: "待命"
};

const fields = [
  { key: "name", label: "名字", type: "text" },
  { key: "image", label: "图片URL", type: "text" },
  { key: "role", label: "定位", type: "select" },
  { key: "attackMode", label: "攻击方式", type: "select" },
  { key: "hp", label: "HP", type: "number", step: "1" },
  { key: "atk", label: "ATK", type: "number", step: "1" },
  { key: "df", label: "DEF", type: "number", step: "1" },
  { key: "crit", label: "暴击率", type: "number", step: "0.01" },
  { key: "critDmg", label: "暴伤", type: "number", step: "0.1" },
  { key: "dodge", label: "闪避", type: "number", step: "0.01" },
  { key: "skillName", label: "技能名", type: "text" },
  { key: "skillType", label: "技能特效", type: "select" },
  { key: "skillCoef", label: "技能系数", type: "number", step: "0.1" },
  { key: "skillCd", label: "冷却", type: "number", step: "1" }
];

const dragState = {
  team: null,
  slot: null
};

const el = {
  arena: document.getElementById("arena"),
  fxLayer: document.getElementById("fxLayer"),
  teamA: document.getElementById("teamA"),
  teamB: document.getElementById("teamB"),
  slotPickerA: document.getElementById("slotPickerA"),
  slotPickerB: document.getElementById("slotPickerB"),
  plantLibraryList: document.getElementById("plantLibraryList"),
  btnAddPlant: document.getElementById("btnAddPlant"),
  applyConfig: document.getElementById("btnApplyConfig"),
  saveConfig: document.getElementById("btnSaveConfig"),
  loadConfig: document.getElementById("btnLoadConfig"),
  setPoisonTurns: document.getElementById("setPoisonTurns"),
  setPoisonScale: document.getElementById("setPoisonScale"),
  setShieldScale: document.getElementById("setShieldScale"),
  setSlowTurns: document.getElementById("setSlowTurns"),
  simTimes: document.getElementById("simTimes"),
  simulateBatch: document.getElementById("btnSimulateBatch"),
  simResult: document.getElementById("simResult"),
  log: document.getElementById("log"),
  hpChart: document.getElementById("hpChart"),
  dmgChart: document.getElementById("dmgChart"),
  start: document.getElementById("btnStart"),
  step: document.getElementById("btnStep"),
  reset: document.getElementById("btnReset"),
  speed: document.getElementById("speed"),
  clearLog: document.getElementById("btnClearLog"),
  roundNum: document.getElementById("roundNum"),
  battleState: document.getElementById("battleState"),
  aliveInfo: document.getElementById("aliveInfo")
};

function toNumber(value, fallback) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

function roleLabel(role) {
  if (role === "defender") return "防御";
  if (role === "support") return "辅助";
  return "输出";
}

function attackModeLabel(mode) {
  if (mode === "melee") return "近战突进";
  if (mode === "area") return "范围爆发";
  return "远程弹道";
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildFallbackImage(name, role) {
  const bg = role === "defender" ? "#8d6e63" : role === "support" ? "#6c5ce7" : "#2b8a3e";
  const glow = role === "defender" ? "#d7b899" : role === "support" ? "#c0b7ff" : "#b7f0c1";
  const text = escapeHtml((name || "植物").slice(0, 2));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${glow}"/></linearGradient></defs><rect width="180" height="180" rx="28" fill="url(#g)"/><circle cx="90" cy="74" r="34" fill="rgba(255,255,255,0.35)"/><rect x="38" y="112" width="104" height="28" rx="14" fill="rgba(16,24,32,0.18)"/><text x="90" y="129" font-size="22" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif">${text}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getPlantImage(p) {
  return p.image && String(p.image).trim() ? String(p.image).trim() : buildFallbackImage(p.name, p.role);
}

function getAttackMode(p) {
  return p.attackMode || (p.role === "defender" ? "melee" : "ranged");
}

function clonePlant(p) {
  return {
    ...p,
    maxHp: p.hp,
    currentCd: 0,
    justHit: false,
    shield: 0,
    poisonTurns: 0,
    poisonDmg: 0,
    slowTurns: 0
  };
}

function aliveCount(team) {
  return team.filter((p) => p.hp > 0).length;
}

function appendLog(text, type = "hit") {
  const line = document.createElement("div");
  line.className = `log-line log-${type}`;
  line.textContent = text;
  el.log.appendChild(line);
  el.log.scrollTop = el.log.scrollHeight;
}

function iconSvg(type) {
  if (type === "shield") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 3v6c0 5-3.4 9.6-7 11-3.6-1.4-7-6-7-11V5l7-3z"></path></svg>';
  }
  if (type === "poison") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8 7 6 10.2 6 13.5A6 6 0 0018 13.5C18 10.2 16 7 12 2zm-1.2 13.6a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm3.1-1a1 1 0 110-2 1 1 0 010 2z"></path></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 4.3L19 7l-3 3.1.8 4.4L12 12.7 7.2 14.5 8 10.1 5 7l4.4-.7L12 2z"></path></svg>';
}

function teamAlive(team) {
  return team.some((p) => p.hp > 0);
}

function frontTarget(team) {
  return team.find((p) => p.hp > 0) || null;
}

function guardSlot1(team) {
  const p = team[0];
  if (p && p.hp > 0 && p.role === "defender") return p;
  return null;
}

function teamTotalHp(team) {
  return team.reduce((s, p) => s + Math.max(0, p.hp), 0);
}

function syncSettingInputs() {
  el.setPoisonTurns.value = String(effectSettings.poisonTurns);
  el.setPoisonScale.value = String(effectSettings.poisonScale);
  el.setShieldScale.value = String(effectSettings.shieldScale);
  el.setSlowTurns.value = String(effectSettings.slowTurns);
}

function readSettingInputs() {
  effectSettings.poisonTurns = Math.max(1, Math.floor(toNumber(el.setPoisonTurns.value, effectSettings.poisonTurns)));
  effectSettings.poisonScale = Math.max(0.05, toNumber(el.setPoisonScale.value, effectSettings.poisonScale));
  effectSettings.shieldScale = Math.max(0.2, toNumber(el.setShieldScale.value, effectSettings.shieldScale));
  effectSettings.slowTurns = Math.max(1, Math.floor(toNumber(el.setSlowTurns.value, effectSettings.slowTurns)));
  syncSettingInputs();
}

function getFighterNode(teamKey, slot) {
  return document.querySelector(`.fighter[data-team="${teamKey}"][data-slot="${slot}"]`);
}

function getNodeCenter(node) {
  const arenaRect = el.arena.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - arenaRect.left,
    y: rect.top + rect.height / 2 - arenaRect.top
  };
}

function fireProjectile(teamKeyFrom, slotFrom, teamKeyTo, slotTo, isSkill) {
  const source = getFighterNode(teamKeyFrom, slotFrom);
  const target = getFighterNode(teamKeyTo, slotTo);
  if (!source || !target) return;

  const a = getNodeCenter(source);
  const b = getNodeCenter(target);

  const dot = document.createElement("div");
  dot.className = `projectile ${isSkill ? "skill" : "normal"}`;
  dot.style.setProperty("--x1", `${a.x}px`);
  dot.style.setProperty("--y1", `${a.y}px`);
  dot.style.setProperty("--x2", `${b.x}px`);
  dot.style.setProperty("--y2", `${b.y}px`);
  dot.style.setProperty("--dur", `${Math.max(180, Number(el.speed.value) * 0.45)}ms`);

  el.fxLayer.appendChild(dot);
  dot.addEventListener("animationend", () => dot.remove(), { once: true });
}

function fireMeleeFx(teamKeyFrom, slotFrom, teamKeyTo, slotTo, isSkill) {
  const source = getFighterNode(teamKeyFrom, slotFrom);
  const target = getFighterNode(teamKeyTo, slotTo);
  if (!source || !target) return;

  const a = getNodeCenter(source);
  const b = getNodeCenter(target);

  const slash = document.createElement("div");
  slash.className = `melee-fx ${isSkill ? "skill" : "normal"}`;
  slash.style.setProperty("--x1", `${a.x}px`);
  slash.style.setProperty("--y1", `${a.y}px`);
  slash.style.setProperty("--x2", `${b.x}px`);
  slash.style.setProperty("--y2", `${b.y}px`);
  slash.style.setProperty("--dur", `${Math.max(220, Number(el.speed.value) * 0.55)}ms`);
  el.fxLayer.appendChild(slash);
  slash.addEventListener("animationend", () => slash.remove(), { once: true });
}

function fireAreaFx(teamKey, slot, isSkill) {
  const target = getFighterNode(teamKey, slot);
  if (!target) return;

  const point = getNodeCenter(target);
  const burst = document.createElement("div");
  burst.className = `area-fx ${isSkill ? "skill" : "normal"}`;
  burst.style.left = `${point.x}px`;
  burst.style.top = `${point.y}px`;
  burst.style.setProperty("--dur", `${Math.max(240, Number(el.speed.value) * 0.55)}ms`);
  el.fxLayer.appendChild(burst);
  burst.addEventListener("animationend", () => burst.remove(), { once: true });
}

function playAttackFx(attacker, teamKeyFrom, slotFrom, teamKeyTo, slotTo, isSkill) {
  const mode = getAttackMode(attacker);
  if (mode === "melee") {
    fireMeleeFx(teamKeyFrom, slotFrom, teamKeyTo, slotTo, isSkill);
    return;
  }
  if (mode === "area") {
    fireAreaFx(teamKeyTo, slotTo, isSkill);
    return;
  }
  fireProjectile(teamKeyFrom, slotFrom, teamKeyTo, slotTo, isSkill);
}

function fireStatusFx(teamKey, slot, type) {
  const target = getFighterNode(teamKey, slot);
  if (!target) return;

  const point = getNodeCenter(target);
  const pulse = document.createElement("div");
  pulse.className = `status-fx ${type}`;
  pulse.style.left = `${point.x}px`;
  pulse.style.top = `${point.y}px`;
  el.fxLayer.appendChild(pulse);
  pulse.addEventListener("animationend", () => pulse.remove(), { once: true });
}

function absorbWithShield(target, incoming) {
  if (incoming <= 0) return { remain: 0, absorbed: 0 };
  if (!target.shield || target.shield <= 0) return { remain: incoming, absorbed: 0 };

  const absorbed = Math.min(target.shield, incoming);
  target.shield -= absorbed;
  return { remain: incoming - absorbed, absorbed };
}

function applyStartOfTurnEffects(plant, teamKey, slot, withFx = true) {
  if (plant.hp <= 0) return;

  if (plant.poisonTurns > 0 && plant.poisonDmg > 0) {
    if (withFx) fireStatusFx(teamKey, slot, "poison");
    const raw = Math.max(1, plant.poisonDmg);
    const blocked = absorbWithShield(plant, raw);
    const real = Math.min(plant.hp, blocked.remain);
    plant.hp = Math.max(0, plant.hp - real);
    plant.poisonTurns -= 1;

    if (withFx) {
      const shieldTag = blocked.absorbed > 0 ? `（护盾吸收${blocked.absorbed}）` : "";
      appendLog(`${plant.name} 受到中毒持续伤害 -${real}${shieldTag}`, "dodge");
    }
  }
}

function applySkillEffect(attacker, target, attackerTeamKey, attackerSlot, targetTeamKey, targetSlot, withFx = true) {
  const type = attacker.skillType || "normal";

  if (type === "poison") {
    target.poisonTurns = Math.max(target.poisonTurns, effectSettings.poisonTurns);
    target.poisonDmg = Math.max(target.poisonDmg, Math.max(1, Math.floor(attacker.atk * effectSettings.poisonScale)));
    if (withFx) {
      fireStatusFx(targetTeamKey, targetSlot, "poison");
      appendLog(`${target.name} 进入中毒状态（${effectSettings.poisonTurns}回合）`, "crit");
    }
    return;
  }

  if (type === "shield") {
    const addShield = Math.max(20, Math.floor(attacker.atk * effectSettings.shieldScale));
    attacker.shield += addShield;
    if (withFx) {
      fireStatusFx(attackerTeamKey, attackerSlot, "shield");
      appendLog(`${attacker.name} 获得护盾 +${addShield}`, "end");
    }
    return;
  }

  if (type === "slow") {
    target.slowTurns = Math.max(target.slowTurns, effectSettings.slowTurns);
    if (withFx) {
      fireStatusFx(targetTeamKey, targetSlot, "slow");
      appendLog(`${target.name} 被减速，${effectSettings.slowTurns}回合内跳过行动`, "dodge");
    }
  }
}

function attack(attacker, attackerTeamKey, attackerSlot, enemyTeam, enemyTeamKey, withFx = true) {
  if (attacker.hp <= 0) return 0;

  applyStartOfTurnEffects(attacker, attackerTeamKey, attackerSlot, withFx);
  if (attacker.hp <= 0) {
    if (withFx) appendLog(`${attacker.name} 因持续伤害倒下`, "end");
    return 0;
  }

  if (attacker.slowTurns > 0) {
    if (withFx) fireStatusFx(attackerTeamKey, attackerSlot, "slow");
    attacker.slowTurns -= 1;
    if (withFx) appendLog(`${attacker.name} 受减速影响，本回合无法行动`, "dodge");
    return 0;
  }

  const defaultTarget = frontTarget(enemyTeam);
  if (!defaultTarget) return 0;

  const guard = guardSlot1(enemyTeam);
  const target = guard || defaultTarget;
  const targetSlot = enemyTeam.indexOf(target) + 1;

  let usingSkill = false;
  let coef = 1;

  if (attacker.currentCd === 0 && attacker.skillCoef > 1) {
    usingSkill = true;
    coef = attacker.skillCoef;
    attacker.currentCd = attacker.skillCd;
  } else if (attacker.currentCd > 0) {
    attacker.currentCd -= 1;
  }

  if (withFx) playAttackFx(attacker, attackerTeamKey, attackerSlot, enemyTeamKey, targetSlot, usingSkill);

  const attackMode = getAttackMode(attacker);
  const baseDamage = Math.floor(attacker.atk * coef);

  if (Math.random() < target.dodge) {
    if (withFx) appendLog(`${attacker.name}${usingSkill ? ` 使用技能【${attacker.skillName}】` : " 普攻"} -> ${target.name} 闪避`, "dodge");
    return 0;
  }

  let damage = baseDamage;
  let critTag = "";
  if (Math.random() < attacker.crit) {
    damage = Math.floor(damage * attacker.critDmg);
    critTag = "【暴击】";
  }

  const raw = Math.max(1, damage - target.df);
  const blocked = absorbWithShield(target, raw);
  const real = Math.min(target.hp, blocked.remain);
  target.hp = Math.max(0, target.hp - real);
  target.justHit = true;

  if (withFx) {
    const blockTag = guard && guard !== defaultTarget ? `，被${guard.name}(1号位)拦截` : "";
    const shieldTag = blocked.absorbed > 0 ? `，护盾吸收${blocked.absorbed}` : "";
    appendLog(
      `${attacker.name}${usingSkill ? ` 使用技能【${attacker.skillName}】` : " 普攻"} 命中 ${target.name}${blockTag}${shieldTag}，-${real} ${critTag}`,
      critTag ? "crit" : "hit"
    );
  }

  if (usingSkill) {
    applySkillEffect(attacker, target, attackerTeamKey, attackerSlot, enemyTeamKey, targetSlot, withFx);
  }

  let splashTotal = 0;
  if (attackMode === "area") {
    enemyTeam.forEach((unit, idx) => {
      if (unit === target || unit.hp <= 0) return;
      const splashRaw = Math.max(1, Math.floor(baseDamage * (usingSkill ? 0.55 : 0.35)) - unit.df);
      const splashBlocked = absorbWithShield(unit, splashRaw);
      const splashReal = Math.min(unit.hp, splashBlocked.remain);
      unit.hp = Math.max(0, unit.hp - splashReal);
      unit.justHit = true;
      splashTotal += splashReal;
      if (withFx && splashReal > 0) fireStatusFx(enemyTeamKey, idx + 1, "area");
    });

    if (withFx && splashTotal > 0) {
      appendLog(`${attacker.name} 的范围冲击波及其余目标，额外造成 ${splashTotal} 点伤害`, "crit");
    }
  }

  return real + splashTotal;
}

function stepRound() {
  if (!teamAlive(state.teamA) || !teamAlive(state.teamB)) return;

  state.round += 1;
  appendLog(`===== 第 ${state.round} 回合 =====`, "round");

  let roundDmgA = 0;
  let roundDmgB = 0;

  for (let i = 0; i < state.teamA.length; i++) {
    roundDmgA += attack(state.teamA[i], "A", i + 1, state.teamB, "B", true);
    render();
    if (!teamAlive(state.teamB)) break;
  }

  if (teamAlive(state.teamB)) {
    for (let i = 0; i < state.teamB.length; i++) {
      roundDmgB += attack(state.teamB[i], "B", i + 1, state.teamA, "A", true);
      render();
      if (!teamAlive(state.teamA)) break;
    }
  }

  state.hpA.push(teamTotalHp(state.teamA));
  state.hpB.push(teamTotalHp(state.teamB));
  state.dmgA.push(roundDmgA);
  state.dmgB.push(roundDmgB);

  if (!teamAlive(state.teamA) || !teamAlive(state.teamB)) {
    const winner = teamAlive(state.teamA) ? "我的植物队" : "敌方植物队";
    state.battleState = `${winner}胜利`;
    appendLog(`战斗结束：${winner} 胜利`, "end");
    stopAuto();
  } else {
    state.battleState = "战斗中";
    render();
  }
}

function canSwap() {
  return !state.running && state.round === 0;
}

function swapPlants(teamKey, slotIndex, dir) {
  if (!canSwap()) {
    appendLog("战斗开始后不可换位，请先重置。", "dodge");
    return;
  }

  const arr = teamKey === "A" ? state.teamA : state.teamB;
  const j = slotIndex + dir;
  if (j < 0 || j >= arr.length) return;

  const temp = arr[slotIndex];
  arr[slotIndex] = arr[j];
  arr[j] = temp;

  appendLog(`${teamKey === "A" ? "我方" : "敌方"}完成换位：${slotIndex + 1}号位 <-> ${j + 1}号位`, "round");
  render();
}

function stopAuto() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.running = false;
  el.start.textContent = "自动战斗";
  if (teamAlive(state.teamA) && teamAlive(state.teamB) && state.round > 0) {
    state.battleState = "暂停";
  }
  render();
}

function startAuto() {
  if (state.running) {
    stopAuto();
    return;
  }

  if (!teamAlive(state.teamA) || !teamAlive(state.teamB)) return;

  state.running = true;
  state.battleState = "自动中";
  el.start.textContent = "暂停";
  render();

  state.timer = setInterval(() => {
    if (!teamAlive(state.teamA) || !teamAlive(state.teamB)) {
      stopAuto();
      return;
    }
    stepRound();
  }, Number(el.speed.value));
}

function plantCard(p, slot, teamKey) {
  const ratio = Math.max(0, p.hp) / p.maxHp;
  const roleText = roleLabel(p.role);
  const allowSwap = canSwap();
  const status = [];
  if (p.shield > 0) status.push(`盾 ${p.shield}`);
  if (p.poisonTurns > 0) status.push(`毒 ${p.poisonTurns}`);
  if (p.slowTurns > 0) status.push(`缓 ${p.slowTurns}`);

  const badges = [];
  if (p.shield > 0) badges.push(`<span class="badge badge-shield" title="护盾"><span class="badge-icon">${iconSvg("shield")}</span><span class="badge-value">${p.shield}</span></span>`);
  if (p.poisonTurns > 0) badges.push(`<span class="badge badge-poison" title="中毒"><span class="badge-icon">${iconSvg("poison")}</span><span class="badge-value">${p.poisonTurns}</span></span>`);
  if (p.slowTurns > 0) badges.push(`<span class="badge badge-slow" title="减速"><span class="badge-icon">${iconSvg("slow")}</span><span class="badge-value">${p.slowTurns}</span></span>`);

  const fallback = escapeHtml(buildFallbackImage(p.name, p.role));
  const image = escapeHtml(getPlantImage(p));
  const name = escapeHtml(p.name);

  return `
    <div class="fighter card ${p.hp <= 0 ? "dead" : ""} ${p.justHit ? "hit" : ""}" data-team="${teamKey}" data-slot="${slot}" draggable="${allowSwap ? "true" : "false"}">
      <div class="fighter-slot">${slot}</div>
      <div class="status-badges">${badges.join("")}</div>
      <div class="fighter-sprite-wrap">
        <div class="fighter-shadow"></div>
        <img class="fighter-sprite ${teamKey === "B" ? "enemy" : "ally"}" src="${image}" alt="${name}" onerror="this.onerror=null;this.src='${fallback}'" />
      </div>
      <div class="fighter-info">
        <div class="name-row">
          <div class="name">${name}</div>
          <span class="role-chip">${roleText}</span>
        </div>
        <div class="meta">${slot}号位 · ${attackModeLabel(getAttackMode(p))}</div>
        <div class="hpbar"><div class="hpfill" style="width:${ratio * 100}%"></div></div>
        <div class="meta">HP ${Math.max(0, p.hp)} / ${p.maxHp} · ${status.length ? status.join(" · ") : "状态正常"}</div>
      </div>
    </div>
  `;
}

function drawLineChart(canvas, arrA, arrB, colorA, colorB, labelA, labelB) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = 30;
  ctx.clearRect(0, 0, w, h);

  const maxY = Math.max(1, ...arrA, ...arrB);
  const maxX = Math.max(1, arrA.length - 1, arrB.length - 1);

  function px(i) {
    return pad + (i / maxX) * (w - pad * 2);
  }
  function py(v) {
    return h - pad - (v / maxY) * (h - pad * 2);
  }

  ctx.strokeStyle = "#d0d5cf";
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

  function drawSeries(arr, color) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    arr.forEach((v, i) => {
      const x = px(i);
      const y = py(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  drawSeries(arrA, colorA);
  drawSeries(arrB, colorB);

  ctx.fillStyle = colorA;
  ctx.fillRect(18, 10, 12, 12);
  ctx.fillStyle = "#000";
  ctx.fillText(labelA, 34, 20);

  ctx.fillStyle = colorB;
  ctx.fillRect(130, 10, 12, 12);
  ctx.fillStyle = "#000";
  ctx.fillText(labelB, 146, 20);
}

function drawBarChart(canvas, arrA, arrB) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = 30;
  ctx.clearRect(0, 0, w, h);

  const n = Math.max(arrA.length, arrB.length);
  const maxY = Math.max(1, ...arrA, ...arrB);
  const groupW = (w - pad * 2) / Math.max(1, n);

  ctx.strokeStyle = "#d0d5cf";
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

  for (let i = 0; i < n; i++) {
    const a = arrA[i] || 0;
    const b = arrB[i] || 0;
    const x = pad + i * groupW;
    const bw = groupW * 0.35;
    const ah = (a / maxY) * (h - pad * 2);
    const bh = (b / maxY) * (h - pad * 2);

    ctx.fillStyle = "#2b8a3e";
    ctx.fillRect(x + groupW * 0.1, h - pad - ah, bw, ah);

    ctx.fillStyle = "#c92a2a";
    ctx.fillRect(x + groupW * 0.55, h - pad - bh, bw, bh);
  }

  ctx.fillStyle = "#2b8a3e";
  ctx.fillRect(18, 10, 12, 12);
  ctx.fillStyle = "#000";
  ctx.fillText("我方回合伤害", 34, 20);

  ctx.fillStyle = "#c92a2a";
  ctx.fillRect(140, 10, 12, 12);
  ctx.fillStyle = "#000";
  ctx.fillText("敌方回合伤害", 156, 20);
}

function buildTemplateFromComposition(composition) {
  return composition.map(i => {
    const idx = Math.max(0, Math.min(plantLibrary.length - 1, i));
    return { ...plantLibrary[idx] };
  });
}

function renderSlotPicker(teamKey) {
  const container = teamKey === "A" ? el.slotPickerA : el.slotPickerB;
  const composition = teamKey === "A" ? teamCompositionA : teamCompositionB;
  container.innerHTML = composition.map((selectedIdx, i) => {
    const options = plantLibrary.map((p, j) => {
      const roleText = p.role === "defender" ? "防御" : p.role === "attacker" ? "输出" : "辅助";
      return `<option value="${j}" ${j === selectedIdx ? "selected" : ""}>${p.name}（${roleText} HP:${p.hp} ATK:${p.atk}）</option>`;
    }).join("");
    return `<div class="slot-picker-row">
      <span class="slot-label">${i + 1}号位${i === 0 ? "（前排）" : ""}</span>
      <select class="slot-select" data-team="${teamKey}" data-slot="${i}">${options}</select>
    </div>`;
  }).join("");
}

function renderLibrary() {
  el.plantLibraryList.innerHTML = plantLibrary.map((p, i) => {
    const roleText = roleLabel(p.role);
    const formRows = fields.map(f => {
      const inputId = `lib-${i}-${f.key}`;
      if (f.type === "select") {
        let pool = [];
        if (f.key === "role") pool = [["defender", "防御"], ["attacker", "输出"], ["support", "辅助"]];
        else if (f.key === "attackMode") pool = [["melee", "近战突进"], ["ranged", "远程弹道"], ["area", "范围爆发"]];
        else pool = [["normal", "普通"], ["poison", "中毒"], ["shield", "护盾"], ["slow", "减速"]];
        const opts = pool.map(([value, label]) => `<option value="${value}" ${p[f.key] === value ? "selected" : ""}>${label}</option>`).join("");
        return `<label>${f.label}<select id="${inputId}">${opts}</select></label>`;
      }
      return `<label>${f.label}<input id="${inputId}" type="${f.type}" step="${f.step || "1"}" value="${escapeHtml(p[f.key] ?? "")}" /></label>`;
    }).join("");
    const libImage = escapeHtml(getPlantImage(p));
    const libFallback = escapeHtml(buildFallbackImage(p.name, p.role));
    return `<div class="library-item" data-idx="${i}">
      <div class="library-item-summary">
        <img class="lib-thumb" src="${libImage}" alt="${escapeHtml(p.name)}" onerror="this.onerror=null;this.src='${libFallback}'" />
        <span class="lib-name">${escapeHtml(p.name)}</span>
        <span class="lib-tag">${roleText}</span>
        <span class="lib-stat">HP ${p.hp}</span>
        <span class="lib-stat">ATK ${p.atk}</span>
        <span class="lib-stat">DEF ${p.df}</span>
        <span class="lib-stat">攻击: ${attackModeLabel(getAttackMode(p))}</span>
        <span class="lib-stat">技能: ${escapeHtml(p.skillName)}(${p.skillType})</span>
        <div class="lib-actions">
          <button class="ghost btn-lib-edit" data-idx="${i}">编辑</button>
          <button class="btn-danger btn-lib-del" data-idx="${i}">删除</button>
        </div>
      </div>
      <div class="library-item-form" id="lib-form-${i}" style="display:none">
        ${formRows}
        <div class="lib-form-actions">
          <button class="btn-lib-save" data-idx="${i}">保存</button>
          <button class="ghost btn-lib-cancel" data-idx="${i}">取消</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

function applyCompositionFromPicker(teamKey) {
  const container = teamKey === "A" ? el.slotPickerA : el.slotPickerB;
  const composition = teamKey === "A" ? teamCompositionA : teamCompositionB;
  container.querySelectorAll(".slot-select").forEach((sel, i) => {
    const idx = parseInt(sel.value, 10);
    if (!Number.isNaN(idx) && idx >= 0 && idx < plantLibrary.length) {
      composition[i] = idx;
    }
  });
}

function sanitizePlant(p) {
  p.name = String(p.name || "植物").trim() || "植物";
  p.image = String(p.image || "").trim();
  if (!["defender", "attacker", "support"].includes(p.role)) p.role = "attacker";
  p.hp = Math.max(1, Math.floor(p.hp));
  p.atk = Math.max(1, Math.floor(p.atk));
  p.df = Math.max(0, Math.floor(p.df));
  p.crit = Math.min(1, Math.max(0, p.crit));
  p.critDmg = Math.max(1, p.critDmg);
  p.dodge = Math.min(0.95, Math.max(0, p.dodge));
  p.skillName = String(p.skillName || "技能").trim() || "技能";
  p.skillCoef = Math.max(1, p.skillCoef);
  p.skillCd = Math.max(0, Math.floor(p.skillCd));
  if (!["normal", "poison", "shield", "slow"].includes(p.skillType)) p.skillType = "normal";
  if (!["melee", "ranged", "area"].includes(p.attackMode)) p.attackMode = p.role === "defender" ? "melee" : "ranged";
}

plantLibrary.forEach(sanitizePlant);

function saveConfig() {
  readSettingInputs();
  const payload = {
    plantLibrary,
    teamCompositionA,
    teamCompositionB,
    effectSettings
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  appendLog("配置已保存到本地浏览器。", "end");
}

function loadConfig() {
  const text = localStorage.getItem(STORAGE_KEY);
  if (!text) {
    appendLog("未找到已保存配置。", "dodge");
    return;
  }

  try {
    const payload = JSON.parse(text);
    if (Array.isArray(payload.plantLibrary) && payload.plantLibrary.length >= 3) {
      plantLibrary.splice(0, plantLibrary.length, ...payload.plantLibrary);
      plantLibrary.forEach(sanitizePlant);
    }
    if (Array.isArray(payload.teamCompositionA) && payload.teamCompositionA.length === 3) {
      teamCompositionA.splice(0, 3, ...payload.teamCompositionA);
    }
    if (Array.isArray(payload.teamCompositionB) && payload.teamCompositionB.length === 3) {
      teamCompositionB.splice(0, 3, ...payload.teamCompositionB);
    }
    if (payload.effectSettings) {
      Object.assign(effectSettings, payload.effectSettings);
    }
    resetState();
    appendLog("本地配置加载成功。", "end");
  } catch {
    appendLog("本地配置解析失败。", "dodge");
  }
}

function simulateBattleFast(configA, configB, maxRound = 80) {
  const teamA = configA.map(clonePlant);
  const teamB = configB.map(clonePlant);

  for (let round = 1; round <= maxRound; round++) {
    for (let i = 0; i < teamA.length; i++) {
      attack(teamA[i], "A", i + 1, teamB, "B", false);
      if (!teamAlive(teamB)) return "A";
    }
    for (let i = 0; i < teamB.length; i++) {
      attack(teamB[i], "B", i + 1, teamA, "A", false);
      if (!teamAlive(teamA)) return "B";
    }
  }
  return "draw";
}

function runBatchSimulation() {
  readSettingInputs();
  applyCompositionFromPicker("A");
  applyCompositionFromPicker("B");
  templateA = buildTemplateFromComposition(teamCompositionA);
  templateB = buildTemplateFromComposition(teamCompositionB);

  const n = Math.max(10, Math.floor(toNumber(el.simTimes.value, 200)));
  el.simTimes.value = String(n);

  let winA = 0;
  let winB = 0;
  let draw = 0;
  for (let i = 0; i < n; i++) {
    const r = simulateBattleFast(templateA, templateB, 80);
    if (r === "A") winA += 1;
    else if (r === "B") winB += 1;
    else draw += 1;
  }

  const text = `样本${n}场：我方胜率 ${(winA / n * 100).toFixed(1)}% | 敌方胜率 ${(winB / n * 100).toFixed(1)}% | 平局 ${(draw / n * 100).toFixed(1)}%`;
  el.simResult.textContent = text;
  appendLog(`批量模拟完成。${text}`, "round");
}

function resetHitMarks() {
  state.teamA.forEach((p) => {
    p.justHit = false;
  });
  state.teamB.forEach((p) => {
    p.justHit = false;
  });
}

function render() {
  el.teamA.className = "team-row team-a";
  el.teamB.className = "team-row team-b";
  el.teamA.innerHTML = state.teamA.map((p, i) => plantCard(p, i + 1, "A")).join("");
  el.teamB.innerHTML = state.teamB.map((p, i) => plantCard(p, i + 1, "B")).join("");

  el.roundNum.textContent = String(state.round);
  el.battleState.textContent = state.battleState;
  el.aliveInfo.textContent = `${aliveCount(state.teamA)} vs ${aliveCount(state.teamB)}`;

  drawLineChart(el.hpChart, state.hpA, state.hpB, "#2b8a3e", "#c92a2a", "我方总HP", "敌方总HP");
  drawBarChart(el.dmgChart, state.dmgA, state.dmgB);

  resetHitMarks();
}

function resetState() {
  stopAuto();
  el.fxLayer.innerHTML = "";

  templateA = buildTemplateFromComposition(teamCompositionA);
  templateB = buildTemplateFromComposition(teamCompositionB);
  state.teamA = templateA.map(clonePlant);
  state.teamB = templateB.map(clonePlant);
  state.running = false;
  state.round = 0;
  state.hpA = [teamTotalHp(state.teamA)];
  state.hpB = [teamTotalHp(state.teamB)];
  state.dmgA = [];
  state.dmgB = [];
  state.battleState = "待命";

  el.log.innerHTML = "";
  appendLog("已重置。当前战场站位为 321 vs 123，防御型植物仅在1号位时可拦截全队伤害。", "round");

  syncSettingInputs();
  renderSlotPicker("A");
  renderSlotPicker("B");
  renderLibrary();
  render();
}

el.start.addEventListener("click", startAuto);
el.step.addEventListener("click", () => {
  if (!state.running) stepRound();
});
el.reset.addEventListener("click", resetState);
el.clearLog.addEventListener("click", () => {
  el.log.innerHTML = "";
  appendLog("日志已清空。", "round");
});
el.speed.addEventListener("change", () => {
  if (state.running) {
    stopAuto();
    startAuto();
  }
});

el.applyConfig.addEventListener("click", () => {
  if (state.running) {
    appendLog("请先暂停，再应用配置。", "dodge");
    return;
  }
  readSettingInputs();
  applyCompositionFromPicker("A");
  applyCompositionFromPicker("B");
  resetState();
  appendLog("新配置已应用，已重置战场。", "end");
});

el.saveConfig.addEventListener("click", () => {
  if (state.running) {
    appendLog("请先暂停，再保存配置。", "dodge");
    return;
  }
  applyCompositionFromPicker("A");
  applyCompositionFromPicker("B");
  saveConfig();
});

el.loadConfig.addEventListener("click", () => {
  if (state.running) {
    appendLog("请先暂停，再加载配置。", "dodge");
    return;
  }
  loadConfig();
});

el.simulateBatch.addEventListener("click", () => {
  if (state.running) {
    appendLog("请先暂停，再做批量模拟。", "dodge");
    return;
  }
  runBatchSimulation();
});

document.addEventListener("dragstart", (evt) => {
  const card = evt.target;
  if (!(card instanceof HTMLElement) || !card.classList.contains("card")) return;
  if (!canSwap()) {
    evt.preventDefault();
    return;
  }

  dragState.team = card.dataset.team || null;
  dragState.slot = Number(card.dataset.slot || "0") || null;
  card.classList.add("dragging");
});

document.addEventListener("dragend", (evt) => {
  const card = evt.target;
  if (card instanceof HTMLElement) {
    card.classList.remove("dragging");
    card.classList.remove("drop-target");
  }
  dragState.team = null;
  dragState.slot = null;
});

document.addEventListener("dragover", (evt) => {
  const card = evt.target instanceof HTMLElement ? evt.target.closest(".card") : null;
  if (!(card instanceof HTMLElement)) return;
  if (!canSwap()) return;
  if (!dragState.team || !dragState.slot) return;
  if (card.dataset.team !== dragState.team) return;

  evt.preventDefault();
  card.classList.add("drop-target");
});

document.addEventListener("dragleave", (evt) => {
  const card = evt.target instanceof HTMLElement ? evt.target.closest(".card") : null;
  if (card instanceof HTMLElement) {
    card.classList.remove("drop-target");
  }
});

document.addEventListener("drop", (evt) => {
  const card = evt.target instanceof HTMLElement ? evt.target.closest(".card") : null;
  if (!(card instanceof HTMLElement)) return;
  if (!canSwap()) return;
  if (!dragState.team || !dragState.slot) return;
  if (card.dataset.team !== dragState.team) return;

  evt.preventDefault();
  const toSlot = Number(card.dataset.slot || "0");
  const fromSlot = dragState.slot;
  card.classList.remove("drop-target");
  if (!toSlot || toSlot === fromSlot) return;

  const arr = dragState.team === "A" ? state.teamA : state.teamB;
  const a = fromSlot - 1;
  const b = toSlot - 1;
  const tmp = arr[a];
  arr[a] = arr[b];
  arr[b] = tmp;

  appendLog(`${dragState.team === "A" ? "我方" : "敌方"}拖拽换位：${fromSlot}号位 <-> ${toSlot}号位`, "round");
  render();
});

// ---- 植物库操作 ----
el.btnAddPlant.addEventListener("click", () => {
  const newPlant = {
    name: "新植物", image: "", role: "attacker", attackMode: "ranged", hp: 1000, atk: 150, df: 40,
    crit: 0.15, critDmg: 1.5, dodge: 0.0,
    skillName: "技能", skillCoef: 1.5, skillCd: 2, skillType: "normal"
  };
  plantLibrary.push(newPlant);
  renderLibrary();
  renderSlotPicker("A");
  renderSlotPicker("B");
  const newIdx = plantLibrary.length - 1;
  const form = document.getElementById(`lib-form-${newIdx}`);
  if (form) form.style.display = "grid";
  appendLog("已添加新植物到植物库，请编辑其属性。", "end");
});

el.plantLibraryList.addEventListener("click", (evt) => {
  const target = evt.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.classList.contains("btn-lib-edit")) {
    const idx = parseInt(target.dataset.idx, 10);
    const form = document.getElementById(`lib-form-${idx}`);
    if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
    return;
  }

  if (target.classList.contains("btn-lib-cancel")) {
    const idx = parseInt(target.dataset.idx, 10);
    const form = document.getElementById(`lib-form-${idx}`);
    if (form) form.style.display = "none";
    return;
  }

  if (target.classList.contains("btn-lib-save")) {
    const idx = parseInt(target.dataset.idx, 10);
    const p = plantLibrary[idx];
    for (const f of fields) {
      const node = document.getElementById(`lib-${idx}-${f.key}`);
      if (!node) continue;
      p[f.key] = f.type === "number" ? toNumber(node.value, p[f.key]) : node.value;
    }
    sanitizePlant(p);

    // Sync display/config fields into active battle state so changes appear immediately
    const staticFields = ["name", "image", "role", "attackMode", "atk", "df", "crit", "critDmg", "dodge", "skillName", "skillCoef", "skillCd", "skillType"];
    [[teamCompositionA, state.teamA], [teamCompositionB, state.teamB]].forEach(([comp, team]) => {
      comp.forEach((libIdx, slot) => {
        if (libIdx === idx && team[slot]) {
          staticFields.forEach(key => { team[slot][key] = p[key]; });
        }
      });
    });

    renderLibrary();
    renderSlotPicker("A");
    renderSlotPicker("B");
    render();
    appendLog(`植物库已更新：${p.name}`, "end");
    return;
  }

  if (target.classList.contains("btn-lib-del")) {
    const idx = parseInt(target.dataset.idx, 10);
    if (plantLibrary.length <= 3) {
      appendLog("植物库至少需要保留 3 个植物。", "dodge");
      return;
    }
    const name = plantLibrary[idx].name;
    plantLibrary.splice(idx, 1);
    [teamCompositionA, teamCompositionB].forEach(comp => {
      for (let i = 0; i < comp.length; i++) {
        if (comp[i] >= plantLibrary.length) comp[i] = plantLibrary.length - 1;
        else if (comp[i] > idx) comp[i] = comp[i] - 1;
      }
    });
    renderLibrary();
    renderSlotPicker("A");
    renderSlotPicker("B");
    appendLog(`已从植物库移除：${name}`, "end");
    return;
  }
});

resetState();
