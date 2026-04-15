// utils.js — 无 DOM 依赖的工具函数

let _id = 0;
export const uid = () => ++_id;

export function escHtml(t) {
  return String(t ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

export function toNum(v, fb) { const n = Number(v); return Number.isFinite(n) ? n : fb; }

export function buildSvgFallback(name, role) {
  const bg  = role === "defender" ? "#8d6e63" : role === "support" ? "#6c5ce7" : "#2b8a3e";
  const txt = escHtml((name || "植").slice(0, 2));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="${bg}"/><text x="40" y="52" font-size="26" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif">${txt}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getImg(p) {
  return p.image && String(p.image).trim() ? p.image.trim() : buildSvgFallback(p.name, p.role);
}

export function sanitizePlant(p) {
  p.name       = String(p.name  || "植物").trim() || "植物";
  p.image      = String(p.image || "").trim();
  if (!["defender","attacker","support"].includes(p.role)) p.role = "attacker";
  if (!["melee","ranged","area"].includes(p.attackMode))   p.attackMode = p.role === "defender" ? "melee" : "ranged";
  p.hp       = Math.max(1,    Math.floor(toNum(p.hp,      1000)));
  p.atk      = Math.max(1,    Math.floor(toNum(p.atk,      100)));
  p.df       = Math.max(0,    Math.floor(toNum(p.df,         0)));
  p.crit     = Math.min(1, Math.max(0,   toNum(p.crit,    0.10)));
  p.critDmg  = Math.max(1,               toNum(p.critDmg,  1.5));
  p.dodge    = Math.min(.95, Math.max(0, toNum(p.dodge,   0.00)));
  p.skillName= String(p.skillName || "技能").trim() || "技能";
  p.skillCoef= Math.max(1,               toNum(p.skillCoef, 1.5));
  p.skillCd  = Math.max(0, Math.floor(   toNum(p.skillCd,    2)));
  if (!["normal","poison","shield","slow"].includes(p.skillType)) p.skillType = "normal";
  p.goldPerSec = Math.max(0, Math.floor(toNum(p.goldPerSec, 3)));
}

export function roleLabel(r) { return r === "defender" ? "防御" : r === "support" ? "辅助" : "输出"; }
export function modeLabel(m) { return m === "melee" ? "近战" : m === "area" ? "范围" : "远程"; }
