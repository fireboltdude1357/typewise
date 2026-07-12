import type { MoveSummary, TeamSlot } from "@/lib/pokemon/types";
import type { CompetitiveAnalysis, CompetitiveFinding, CompetitiveInput, CompetitiveRole } from "./types";

const HAZARDS = new Set(["stealthrock", "spikes", "toxicspikes", "stickyweb", "stoneaxe", "ceaselessedge"]);
const REMOVAL = new Set(["rapidspin", "defog", "mortalspin", "tidyup"]);
const SPEED_CONTROL = new Set(["tailwind", "trickroom", "stickyweb", "thunderwave", "glare", "nuzzle", "icywind", "electroweb"]);
const PIVOTS = new Set(["uturn", "voltswitch", "flipturn", "partingshot", "teleport", "chillyreception"]);
const RECOVERY = new Set(["recover", "roost", "slackoff", "softboiled", "milkdrink", "moonlight", "morningsun", "synthesis", "shoreup", "strengthsap", "wish"]);
const SETUP = new Set(["swordsdance", "nastyplot", "calmmind", "dragondance", "quiverdance", "bulkup", "shellsmash", "agility"]);
const DISRUPTION = new Set(["taunt", "encore", "trick", "switcheroo", "knockoff", "spore", "willowisp", "toxic"]);

export function competitiveTypeMultiplier(typeChart: Record<string, Record<string, number>>, attackType: string, defensiveTypes: string[], ability = "") {
  return defensiveTypes.reduce((total, defenseType) => total * (typeChart[attackType]?.[defenseType] ?? 1), 1) * (attackType === "Ground" && ability === "Levitate" ? 0 : 1);
}

const NATURES: Record<string, { up?: "atk" | "spa" | "spe" | "def" | "spd"; down?: "atk" | "spa" | "spe" | "def" | "spd" }> = {
  Adamant: { up: "atk", down: "spa" }, Modest: { up: "spa", down: "atk" }, Jolly: { up: "spe", down: "spa" }, Timid: { up: "spe", down: "atk" },
  Bold: { up: "def", down: "atk" }, Calm: { up: "spd", down: "atk" }, Impish: { up: "def", down: "spa" }, Careful: { up: "spd", down: "spa" }, Hardy: {},
};

function has(moveIds: Set<string>, source: Set<string>) { return [...moveIds].some((id) => source.has(id)); }
function evFor(slot: TeamSlot, stat: "atk" | "spa" | "spe" | "def" | "spd") {
  const preset = slot.competitiveSet?.evPreset ?? "balanced";
  if (preset === "physical" && (stat === "atk" || stat === "def")) return 252;
  if (preset === "special" && (stat === "spa" || stat === "spd")) return 252;
  if (preset === "fast-physical" && (stat === "atk" || stat === "spe")) return 252;
  if (preset === "fast-special" && (stat === "spa" || stat === "spe")) return 252;
  if (preset === "bulky" && (stat === "def" || stat === "spd")) return 252;
  return preset === "balanced" ? 84 : 0;
}
function calculatedStat(slot: TeamSlot, stat: "atk" | "spa" | "spe" | "def" | "spd") {
  const base = slot.pokemon.baseStats[stat];
  const nature = NATURES[slot.competitiveSet?.nature ?? "Hardy"] ?? NATURES.Hardy;
  const modifier = nature.up === stat ? 1.1 : nature.down === stat ? 0.9 : 1;
  let value = Math.floor((2 * base + 31 + Math.floor(evFor(slot, stat) / 4) + 5) * modifier);
  const item = slot.competitiveSet?.item;
  if (stat === "spe" && item === "Choice Scarf") value = Math.floor(value * 1.5);
  if (stat === "atk" && item === "Choice Band") value = Math.floor(value * 1.5);
  if (stat === "spa" && item === "Choice Specs") value = Math.floor(value * 1.5);
  if (stat === "atk" && ["Huge Power", "Pure Power"].includes(slot.competitiveSet?.ability ?? "")) value *= 2;
  return value;
}
function roles(slot: TeamSlot): CompetitiveRole[] {
  const result: CompetitiveRole[] = [];
  const ids = new Set(slot.moves.map((move) => move.id));
  const physical = slot.moves.filter((m) => m.category === "Physical").length;
  const special = slot.moves.filter((m) => m.category === "Special").length;
  if (physical && special) result.push("mixed-breaker"); else if (physical) result.push("physical-breaker"); else if (special) result.push("special-breaker");
  if (calculatedStat(slot, "spe") >= 280) result.push("fast-attacker");
  if (calculatedStat(slot, "def") >= 260) result.push("physical-wall");
  if (calculatedStat(slot, "spd") >= 260) result.push("special-wall");
  if (slot.pokemon.baseStatTotal >= 500 && (result.includes("physical-wall") || result.includes("special-wall"))) result.push("tank");
  if (has(ids, HAZARDS)) result.push("hazard-setter"); if (has(ids, REMOVAL)) result.push("hazard-remover");
  if (has(ids, SPEED_CONTROL)) result.push("speed-control"); if (has(ids, PIVOTS)) result.push("pivot"); if (has(ids, RECOVERY)) result.push("recovery");
  if (slot.moves.some((m) => m.priority > 0 && m.category !== "Status")) result.push("priority"); if (has(ids, SETUP)) result.push("setup");
  if (ids.has("protect")) result.push("protect"); if (has(ids, DISRUPTION)) result.push("disruption");
  return result;
}
function bestPower(moves: MoveSummary[], category: "Physical" | "Special") { return Math.max(0, ...moves.filter((m) => m.category === category).map((m) => m.power ?? 0)); }
function damageEstimate(slot: TeamSlot) {
  const physicalPower = bestPower(slot.moves, "Physical"); const specialPower = bestPower(slot.moves, "Special");
  const physical = physicalPower * calculatedStat(slot, "atk"); const special = specialPower * calculatedStat(slot, "spa");
  const power = physical >= special ? physicalPower : specialPower; const attack = physical >= special ? calculatedStat(slot, "atk") : calculatedStat(slot, "spa");
  if (!power) return "No direct-damage estimate";
  const move = slot.moves.find((m) => (m.power ?? 0) === power && m.category === (physical >= special ? "Physical" : "Special"));
  const stab = move && slot.pokemon.types.includes(move.type) ? 1.5 : 1;
  const maximum = (((42 * power * attack) / 250) / 50 + 2) * stab / 300 * 100;
  return `${Math.round(maximum * 0.85)}–${Math.round(maximum)}% vs a neutral 300 HP / 250 Defense benchmark`;
}

export function analyzeCompetitive({ format, catalog, team }: CompetitiveInput): CompetitiveAnalysis {
  const memberReports = team.map((slot) => {
    const tier = format === "singles" ? slot.pokemon.singlesTier : slot.pokemon.doublesTier;
    const viability: "strong" | "serviceable" | "specialist" = ["Uber", "OU", "DOU", "DUber"].includes(tier) ? "strong" : ["UUBL", "UU", "RUBL", "RU", "DUU", "NFE"].includes(tier) ? "serviceable" : "specialist";
    const atkPressure = calculatedStat(slot, "atk") * bestPower(slot.moves, "Physical");
    const spaPressure = calculatedStat(slot, "spa") * bestPower(slot.moves, "Special");
    return { id: slot.pokemon.id, name: slot.pokemon.name, roles: roles(slot), viability, viabilityExplanation: `${tier || "Untiered"} in the bundled ${format} dex data; this is broad format context, not current usage or a regulation legality guarantee.`, estimatedSpeed: calculatedStat(slot, "spe"), strongestAttack: Math.round(Math.max(atkPressure, spaPressure) / 100), neutralDamageEstimate: damageEstimate(slot) };
  });
  const findings: CompetitiveFinding[] = [];
  const roleSet = new Set(memberReports.flatMap((member) => member.roles));
  const need = (role: CompetitiveRole, title: string, explanation: string) => { if (!roleSet.has(role)) findings.push({ id: `missing-${role}`, severity: "warning", title, explanation }); };
  if (catalog.generation >= 2) { need("hazard-setter", "No entry-hazard plan", "The selected sets do not establish recurring chip damage."); need("hazard-remover", "No hazard removal", "The team has no selected move that clears hazards from its side."); }
  need("speed-control", "Limited speed control", "No selected move changes turn order or opposing Speed; priority can still provide a partial fallback.");
  if (![...roleSet].some((r) => r === "setup" || r === "physical-breaker" || r === "special-breaker" || r === "mixed-breaker")) findings.push({ id: "no-win-condition", severity: "warning", title: "No clear win condition", explanation: "No member currently presents setup or meaningful direct offensive pressure." });
  if (format === "doubles" && memberReports.filter((m) => m.roles.includes("protect")).length < Math.ceil(team.length / 2)) findings.push({ id: "doubles-protect", severity: "info", title: "Protect coverage is thin", explanation: "In doubles, Protect helps manage targeting, positioning, and partner spread moves; fewer than half of the selected sets carry it." });
  if (memberReports.some((m) => m.roles.includes("setup"))) findings.push({ id: "win-condition", severity: "good", title: "A win condition is visible", explanation: `${memberReports.filter((m) => m.roles.includes("setup")).map((m) => m.name).join(" and ")} can convert an opening into a sweep.` });

  const teamIds = new Set(team.map((s) => s.pokemon.id));
  const matchup = (attackType: string, slot: TeamSlot) => competitiveTypeMultiplier(catalog.typeChart, attackType, slot.pokemon.types, slot.competitiveSet?.ability);
  const threats = catalog.pokemon.filter((p) => !teamIds.has(p.id)).map((pokemon) => {
    const threatened = team.filter((slot) => pokemon.types.some((type) => matchup(type, slot) > 1)).map((slot) => slot.pokemon.name);
    const safe = team.filter((slot) => pokemon.types.every((type) => matchup(type, slot) < 1)).map((slot) => slot.pokemon.name);
    const score = threatened.length * 20 + (safe.length ? 0 : 25) + Math.min(25, pokemon.baseStatTotal / 30) + (pokemon.baseStats.spe > Math.max(0, ...team.map((s) => s.pokemon.baseStats.spe)) ? 10 : 0);
    return { id: pokemon.id, name: pokemon.name, score: Math.round(score), threatenedMembers: threatened, safeAnswers: safe, explanation: `${pokemon.types.join("/")} STAB pressures ${threatened.length ? threatened.join(", ") : "no member super effectively"}; ${safe.length ? `${safe.join(", ")} resist all of its STAB types` : "the lineup has no member resisting all of its STAB types"}. This is a typing/stat screen, not a simulated set.` };
  }).filter((t) => t.threatenedMembers.length >= 2).sort((a, b) => b.score - a.score).slice(0, 5);

  const exposedTypes = threats.flatMap((t) => catalog.pokemon.find((p) => p.id === t.id)?.types ?? []);
  const recommendations = team.length < 2 || threats.length === 0 ? [] : catalog.pokemon.filter((p) => !teamIds.has(p.id)).map((p) => {
    const resistCount = exposedTypes.filter((attack) => p.types.some((def) => (catalog.typeChart[attack]?.[def] ?? 1) < 1)).length;
    const speedHelp = p.baseStats.spe >= 100 ? 1 : 0; const score = resistCount * 15 + speedHelp * 10 + p.baseStatTotal / 20;
    const reasons = [`resists ${resistCount} highlighted threat-type instance${resistCount === 1 ? "" : "s"}`, `${p.baseStats.spe} base Speed`, `${p.baseStatTotal} BST`];
    return { id: p.id, name: p.name, score: Math.round(score), reasons };
  }).filter((r) => r.score > 25).sort((a, b) => b.score - a.score).slice(0, 5);

  return { format, formatLabel: format === "singles" ? `Generation ${catalog.generation} singles` : `Generation ${catalog.generation} doubles`, assumptions: "Level 100, 31 IVs, the selected EV preset and nature. Threats use STAB typing, base stats, and the visible roster—not live usage data, hidden coverage, items, or full damage rolls.", members: memberReports, findings, threats, recommendations };
}
