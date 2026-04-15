// config.js — 游戏数据与常量

import { toNum, sanitizePlant } from "./utils.js";

export const STORAGE_KEY = "plant-battle-td-v1";
export const APP_VERSION = "v0.0.0-c8aab90";

// ─────────────────── Plant Library ───────────────────
export const plantLibrary = [
  { name: "坚果墙",   image: "", role: "defender", attackMode: "melee",  hp: 1800, atk:  60, df: 80, crit: 0.08, critDmg: 1.5, dodge: 0.05, skillName: "硬壳格挡", skillCoef: 1.2, skillCd: 2, skillType: "shield",  goldPerSec: 2  },
  { name: "豌豆射手", image: "", role: "attacker", attackMode: "ranged", hp:  900, atk: 180, df: 30, crit: 0.20, critDmg: 1.5, dodge: 0.00, skillName: "三连豌豆", skillCoef: 1.8, skillCd: 2, skillType: "normal",  goldPerSec: 5  },
  { name: "寒冰射手", image: "", role: "attacker", attackMode: "ranged", hp: 1000, atk: 150, df: 40, crit: 0.15, critDmg: 1.5, dodge: 0.00, skillName: "寒冰重击", skillCoef: 1.6, skillCd: 1, skillType: "slow",    goldPerSec: 4  },
  { name: "铁桶坚果", image: "", role: "defender", attackMode: "melee",  hp: 2000, atk:  70, df: 90, crit: 0.08, critDmg: 1.5, dodge: 0.03, skillName: "反伤硬化", skillCoef: 1.2, skillCd: 2, skillType: "shield",  goldPerSec: 3  },
  { name: "毒液花",   image: "", role: "attacker", attackMode: "area",   hp:  850, atk: 170, df: 35, crit: 0.18, critDmg: 1.5, dodge: 0.00, skillName: "毒刺爆发", skillCoef: 1.9, skillCd: 3, skillType: "poison",  goldPerSec: 6  },
  { name: "机枪豌豆", image: "", role: "attacker", attackMode: "ranged", hp: 1100, atk: 140, df: 45, crit: 0.12, critDmg: 1.5, dodge: 0.00, skillName: "弹幕扫射", skillCoef: 1.7, skillCd: 2, skillType: "normal",  goldPerSec: 5  },
];
plantLibrary.forEach(sanitizePlant);

// ─────────────────── Monster Types ───────────────────
export const monsterTypes = [
  { name: "普通僵尸", emoji: "🧟", hp: 300,  atk:  35, speed: 0.27, attackInterval: 1600, reward: 10 },
  { name: "快速僵尸", emoji: "🏃", hp: 200,  atk:  25, speed: 0.55, attackInterval: 1200, reward: 15 },
  { name: "铁桶僵尸", emoji: "🪣", hp: 650,  atk:  55, speed: 0.17, attackInterval: 2000, reward: 25 },
  { name: "巨型僵尸", emoji: "👾", hp: 1100, atk:  80, speed: 0.13, attackInterval: 2500, reward: 40 },
];

export function sanitizeMonster(m) {
  m.name           = String(m.name  || "怪物").trim() || "怪物";
  m.emoji          = String(m.emoji || "🧟").trim()  || "🧟";
  m.hp             = Math.max(1,   Math.floor(toNum(m.hp,   300)));
  m.atk            = Math.max(1,   Math.floor(toNum(m.atk,   35)));
  m.speed          = Math.max(0.01,            toNum(m.speed,  0.27));
  m.attackInterval = Math.max(100, Math.floor(toNum(m.attackInterval, 1600)));
  m.reward         = Math.max(0,   Math.floor(toNum(m.reward,  10)));
}
monsterTypes.forEach(sanitizeMonster);

// ─────────────────── Wave Types ─────────────────────
export const waveTypes = [
  { name: "缓慢海浪", speed: 0.2,  spawnInterval: 7000, weight: 20, color: "#0096ff" },
  { name: "普通海浪", speed: 0.4,  spawnInterval: 5000, weight: 50, color: "#0096ff" },
  { name: "快速海浪", speed: 0.6,  spawnInterval: 3500, weight: 20, color: "#ff6600" },
  { name: "极速海浪", speed: 0.9,  spawnInterval: 2000, weight: 10, color: "#ff0033" },
];

export function sanitizeWave(w) {
  w.name          = String(w.name || "海浪").trim() || "海浪";
  w.speed         = Math.max(0.05,            toNum(w.speed,  0.4));
  w.spawnInterval = Math.max(500, Math.floor(toNum(w.spawnInterval, 5000)));
  w.weight        = Math.max(0,   Math.floor(toNum(w.weight,   50)));
  w.color         = String(w.color || "#0096ff").trim() || "#0096ff";
}
waveTypes.forEach(sanitizeWave);

// ─────────────────── Plant Spawn Configs ───────────────
export const plantSpawnConfigs = [
  { name: "缓慢刷新", spawnInterval: 8000,  weight: 15 },
  { name: "普通刷新", spawnInterval: 5500,  weight: 50 },
  { name: "快速刷新", spawnInterval: 3000,  weight: 20 },
  { name: "极速刷新", spawnInterval: 1500,  weight: 15 },
];

export function sanitizePlantSpawn(p) {
  p.name          = String(p.name || "植物刷新").trim() || "植物刷新";
  p.spawnInterval = Math.max(500, Math.floor(toNum(p.spawnInterval, 5500)));
  p.weight        = Math.max(0,   Math.floor(toNum(p.weight,   50)));
}
plantSpawnConfigs.forEach(sanitizePlantSpawn);

// ─────────────────── Wave List Config ────────────────
// waveList[i] = array of { monsterIdx, count } for wave i+1
export const waveList = [
  [{ monsterIdx: 0, count: 5 }],
  [{ monsterIdx: 0, count: 4 }, { monsterIdx: 1, count: 2 }],
  [{ monsterIdx: 0, count: 3 }, { monsterIdx: 2, count: 2 }, { monsterIdx: 3, count: 1 }],
];

export function sanitizeWaveEntry(entry) {
  entry.monsterIdx = Math.max(0, Math.floor(toNum(entry.monsterIdx, 0)));
  entry.count      = Math.max(0, Math.floor(toNum(entry.count, 0)));
}

// ─────────────────── Game Config ─────────────────────
export const gameConfig = { dayDuration: 30, duskDuration: 15, nightDuration: 0, initialLives: 5 };

export function sanitizeGameConfig(c) {
  c.dayDuration   = Math.max(5,  Math.floor(toNum(c.dayDuration,   30)));
  c.duskDuration  = Math.max(5,  Math.floor(toNum(c.duskDuration,  15)));
  c.nightDuration = Math.max(0,  Math.floor(toNum(c.nightDuration,  0)));
  c.initialLives  = Math.max(1,  Math.floor(toNum(c.initialLives,   5)));
}
sanitizeGameConfig(gameConfig);

// ─────────────────── Game Constants ───────────────────
export const LANES             = 5;
export const ROWS              = 2;
export const SLOTS             = LANES * ROWS;
export const SPAWN_INTERVAL    = 5500;
export const MAX_SPAWNED       = 5;
export const COMBAT_TICK       = 900;
export const POISON_TICK       = 1200;
export const MONSTER_ZONE_H    = 130;
export const PLANTING_ROW_H    = 130;
export const BATTLE_H          = MONSTER_ZONE_H + ROWS * PLANTING_ROW_H; // 390
export const Y_ROW                  = [1.0, 2.0];
export const Y_BASE                 = 3.0;
export const ROUND_SCALE_FACTOR     = 0.15;  // HP/ATK difficulty increase per round
export const DEFENSE_REDUCTION      = 0.45;  // fraction of plant DEF applied to monster ATK
export const POISON_DMG_MULTIPLIER  = 0.25;  // poison DoT = attacker.atk × this
export const POISON_DURATION_BONUS  = 2;     // extra ticks added on top of plant's skillCd
export const SLOW_DURATION_MS       = 2000;  // ms per (skillCd + 1) unit for slow duration
export const SHIELD_GAIN_MULTIPLIER = 0.85;  // shield gained = atk × skillCoef × this

export const COLLECTION_ROWS = 15;  // Number of rows in collection zone
export const STRIPE_HEIGHT = 100 / COLLECTION_ROWS;  // Height of each stripe (%)

export const SPAWN_ROW = 14; // Bottom row is the spawn/birth zone

export function isBlackStripe(yPercent) {
  const stripeIndex = Math.floor(yPercent / STRIPE_HEIGHT);
  return stripeIndex % 2 === 1;  // Odd indices are black
}

// ─────────────────── Economy & Growth Constants ───────
export const PLANT_STAGES      = 4;           // Total growth stages
export const STAGE_RATIOS      = [0.25, 0.50, 0.75, 1.0]; // Stat ratio per stage
export const STAGE_NAMES       = ["幼苗", "成长", "成熟", "完全体"];
export const GOLD_TICK_MS      = 1000;        // Gold generation interval (ms)

// Breakthrough: feed same-type plants to gain EXP, then wait for breakthrough
export const BREAKTHROUGH_EXP  = [3, 4, 5];  // EXP needed for stage 1→2, 2→3, 3→4
export const BREAKTHROUGH_TIME = 10;          // Seconds to complete breakthrough once EXP is full

export const PLAYER_BASE_CARRY   = 3;         // Default max carry capacity
export const CARRY_UPGRADE_COST  = [50, 120, 200, 300, 500]; // Cost per carry upgrade level
export const CARRY_UPGRADE_BONUS = 1;         // +1 carry per upgrade

export const ZONE_BASE_SLOTS        = 6;      // Starting planting slots
export const ZONE_UPGRADE_COST      = [80, 150, 250, 400]; // Cost per zone level
export const ZONE_UPGRADE_SLOTS     = 1;      // +1 slot per zone level

export const PLANT_UPGRADE_COST_BASE = 30;    // Base cost to upgrade plant level
export const PLANT_UPGRADE_COST_MULT = 1.5;   // Cost multiplier per level
export const PLANT_UPGRADE_STAT_MULT = 0.15;  // +15% stats per plant level

// ─────────────────── Attack Range per Mode ───────────
// Distance is Euclidean: sqrt((lane_diff)² + (y_diff)²)
export const ATTACK_RANGE = {
  melee:  1.5,   // Short range — own lane + adjacent, nearby y
  ranged: 100,   // Effectively unlimited — entire battlefield
  area:   3.0,   // Medium radius — all monsters within get attacked
};
