"use client";

import { Activity, Gauge, ShieldCheck, Sparkles, Swords, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { analyzeCompetitive } from "@/lib/competitive";
import type { BattleFormat, DexCatalogResponse, TeamSlot } from "@/lib/pokemon/types";

export function CompetitivePanel({ catalog, team, format }: { catalog: DexCatalogResponse; team: TeamSlot[]; format: Exclude<BattleFormat, "casual"> }) {
  const report = useMemo(() => analyzeCompetitive({ catalog, team, format }), [catalog, team, format]);
  return (
    <section aria-labelledby="competitive-title" className="overflow-hidden rounded-[1.8rem] border border-black/10 bg-[#191816] text-white shadow-[0_22px_70px_rgba(25,24,22,0.16)]">
      <header className="border-b border-white/10 p-6 sm:p-8">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff8a7e]">Competitive audit · {report.formatLabel}</span>
        <h2 id="competitive-title" className="mt-3 text-3xl font-black tracking-[-0.05em]">Does the team have a plan?</h2>
        <p className="mt-3 max-w-3xl text-xs leading-5 text-white/50">{report.assumptions}</p>
      </header>
      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-2">
        <ReportCard icon={Swords} title="Roles and game plan">
          <div className="space-y-3">
            {report.members.map((member) => <div key={member.id} className="rounded-xl bg-white/[0.055] p-3"><div className="flex justify-between gap-3"><strong className="text-sm">{member.name}</strong><span className="text-[9px] font-black uppercase text-[#ffb44d]" title={member.viabilityExplanation}>{member.viability}</span></div><p className="mt-1 text-[10px] text-white/40">Estimated Speed {member.estimatedSpeed} · pressure index {member.strongestAttack}</p><p className="mt-1 text-[9px] text-white/30">{member.neutralDamageEstimate}</p><p className="mt-1 text-[9px] leading-4 text-white/30">{member.viabilityExplanation}</p><div className="mt-2 flex flex-wrap gap-1">{member.roles.length ? member.roles.map((role) => <span key={role} className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold">{role.replaceAll("-", " ")}</span>) : <span className="text-[10px] text-white/35">Select moves to infer this member&apos;s jobs.</span>}</div></div>)}
          </div>
        </ReportCard>
        <ReportCard icon={Activity} title="Coherence findings">
          <div className="space-y-2">{report.findings.map((finding) => <article key={finding.id} className="rounded-xl border border-white/10 p-3"><div className="flex items-center gap-2">{finding.severity === "warning" ? <TriangleAlert className="h-3.5 w-3.5 text-[#ff8a7e]" /> : <ShieldCheck className="h-3.5 w-3.5 text-[#7bd8a5]" />}<h4 className="text-xs font-black">{finding.title}</h4></div><p className="mt-1.5 text-[10px] leading-4 text-white/45">{finding.explanation}</p></article>)}</div>
        </ReportCard>
        <ReportCard icon={Gauge} title="Roster threat screen">
          <div className="space-y-2">{report.threats.length ? report.threats.map((threat) => <article key={threat.id} className="rounded-xl bg-[#ef5b4c]/10 p-3"><div className="flex justify-between"><h4 className="text-xs font-black">{threat.name}</h4><span className="font-mono text-[9px] text-[#ff8a7e]">pressure {threat.score}</span></div><p className="mt-1.5 text-[10px] leading-4 text-white/45">{threat.explanation}</p></article>) : <p className="text-xs text-white/40">Add more team members to reveal repeated matchup pressure.</p>}</div>
        </ReportCard>
        <ReportCard icon={Sparkles} title="Replacement directions">
          <p className="mb-3 text-[10px] leading-4 text-white/40">Candidates are ranked by highlighted resistances, Speed, and broad stat strength. They are directions to investigate—not opaque verdicts.</p>
          <ol className="space-y-2">{report.recommendations.map((candidate, index) => <li key={candidate.id} className="flex gap-3 rounded-xl bg-white/[0.055] p-3"><span className="font-mono text-xs text-[#ff8a7e]">{String(index + 1).padStart(2, "0")}</span><div><strong className="text-xs">{candidate.name}</strong><p className="mt-1 text-[10px] text-white/40">{candidate.reasons.join(" · ")}</p></div></li>)}</ol>{report.recommendations.length === 0 ? <p className="text-xs text-white/35">Build at least two slots and reveal a repeated threat before replacement directions appear.</p> : null}
        </ReportCard>
      </div>
    </section>
  );
}

function ReportCard({ icon: Icon, title, children }: { icon: typeof Swords; title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5"><h3 className="mb-4 flex items-center gap-2 text-sm font-black"><Icon className="h-4 w-4 text-[#ff8a7e]" />{title}</h3>{children}</div>; }
