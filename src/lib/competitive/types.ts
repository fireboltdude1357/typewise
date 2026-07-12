import type { BattleFormat, DexCatalogResponse, TeamSlot } from "@/lib/pokemon/types";

export type CompetitiveRole =
  | "physical-breaker" | "special-breaker" | "mixed-breaker"
  | "fast-attacker" | "physical-wall" | "special-wall" | "tank"
  | "hazard-setter" | "hazard-remover" | "speed-control" | "pivot"
  | "recovery" | "priority" | "setup" | "protect" | "disruption";

export type CompetitiveFinding = {
  id: string;
  severity: "good" | "info" | "warning";
  title: string;
  explanation: string;
};

export type MemberCompetitiveReport = {
  id: string;
  name: string;
  roles: CompetitiveRole[];
  viability: "strong" | "serviceable" | "specialist";
  viabilityExplanation: string;
  estimatedSpeed: number;
  strongestAttack: number;
  neutralDamageEstimate: string;
};

export type ThreatReport = {
  id: string;
  name: string;
  score: number;
  threatenedMembers: string[];
  safeAnswers: string[];
  explanation: string;
};

export type ReplacementSuggestion = {
  id: string;
  name: string;
  score: number;
  reasons: string[];
};

export type CompetitiveAnalysis = {
  format: Exclude<BattleFormat, "casual">;
  formatLabel: string;
  assumptions: string;
  members: MemberCompetitiveReport[];
  findings: CompetitiveFinding[];
  threats: ThreatReport[];
  recommendations: ReplacementSuggestion[];
};

export type CompetitiveInput = {
  format: Exclude<BattleFormat, "casual">;
  catalog: DexCatalogResponse;
  team: TeamSlot[];
};
