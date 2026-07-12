import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDexCatalog } from "../pokemon/dex-server";
import type { MoveSummary, TeamSlot } from "../pokemon/types";
import { analyzeCompetitive, competitiveTypeMultiplier } from "./analyze-competitive";

const move = (id: string, name: string, category: MoveSummary["category"], power: number | null, priority = 0): MoveSummary => ({ id, name, category, power, priority, type: id === "thunderbolt" ? "Electric" : id === "protect" ? "Normal" : "Ground", accuracy: 100, alwaysHits: false, pp: 10, description: "", methods: ["TM / HM / TR"], sourceGenerations: [9], matchupMode: "standard" });
function slot(catalog: ReturnType<typeof getDexCatalog>, id: string, moves: MoveSummary[]): TeamSlot {
  const pokemon = catalog.pokemon.find((candidate) => candidate.id === id);
  if (!pokemon) throw new Error(`Missing ${id}`);
  return { pokemon, moves, competitiveSet: { ability: pokemon.abilities[0] ?? "None", item: "Leftovers", nature: "Jolly", evPreset: "fast-physical" } };
}

describe("competitive team analysis", () => {
  it("infers roles, applies set-driven Speed, and exposes its damage assumptions", () => {
    const catalog = getDexCatalog(9);
    const report = analyzeCompetitive({ format: "singles", catalog, team: [slot(catalog, "garchomp", [move("earthquake", "Earthquake", "Physical", 100), move("stealthrock", "Stealth Rock", "Status", null)])] });
    expect(report.members[0].roles).toEqual(expect.arrayContaining(["physical-breaker", "fast-attacker", "hazard-setter"]));
    expect(report.members[0].estimatedSpeed).toBeGreaterThan(300);
    expect(report.members[0].neutralDamageEstimate).toContain("benchmark");
    expect(report.assumptions).toContain("not live usage data");
  });

  it("adds doubles-specific Protect guidance and explainable candidates", () => {
    const catalog = getDexCatalog(9);
    const report = analyzeCompetitive({ format: "doubles", catalog, team: [slot(catalog, "pikachu", [move("thunderbolt", "Thunderbolt", "Special", 90)])] });
    expect(report.findings).toContainEqual(expect.objectContaining({ id: "doubles-protect" }));
    expect(report.recommendations).toEqual([]);
  });

  it("recognizes Protect when enough doubles members select it", () => {
    const catalog = getDexCatalog(9);
    const report = analyzeCompetitive({ format: "doubles", catalog, team: [slot(catalog, "pikachu", [move("protect", "Protect", "Status", null)])] });
    expect(report.findings.some((finding) => finding.id === "doubles-protect")).toBe(false);
  });

  it("multiplies both defensive types and never calls an immunity threatened", () => {
    const catalog = getDexCatalog(9);
    expect(competitiveTypeMultiplier(catalog.typeChart, "Ground", ["Fire", "Flying"])).toBe(0);
    expect(competitiveTypeMultiplier(catalog.typeChart, "Rock", ["Fire", "Ground"])).toBe(1);
    expect(competitiveTypeMultiplier(catalog.typeChart, "Ground", ["Electric"], "Levitate")).toBe(0);
  });

  it("uses held items in set-driven estimates and tolerates stale local values", () => {
    const catalog = getDexCatalog(9);
    const base = slot(catalog, "garchomp", [move("earthquake", "Earthquake", "Physical", 100)]);
    const scarfed = { ...base, competitiveSet: { ...base.competitiveSet!, item: "Choice Scarf" } };
    const malformed = { ...base, competitiveSet: { ...base.competitiveSet!, nature: "Stale" as never } };
    const regularReport = analyzeCompetitive({ format: "singles", catalog, team: [base] });
    const scarfReport = analyzeCompetitive({ format: "singles", catalog, team: [scarfed] });
    expect(scarfReport.members[0].estimatedSpeed).toBeGreaterThan(regularReport.members[0].estimatedSpeed);
    expect(() => analyzeCompetitive({ format: "singles", catalog, team: [malformed] })).not.toThrow();
  });
});
