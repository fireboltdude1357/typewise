"use client";

import { SignInButton, useUser } from "@clerk/nextjs";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import {
  Check,
  Cloud,
  CloudOff,
  LoaderCircle,
  LogIn,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { BattleFormat, CatalogScope, CompetitiveSet, Generation, TeamSlot } from "@/lib/pokemon/types";
import { useBackendStatus } from "./providers";

export type SavedTeamDocument = {
  _id: Id<"savedTeams">;
  name: string;
  generation: Generation;
  scope?: CatalogScope;
  format?: BattleFormat;
  slots: Array<{
    pokemonId: string;
    pokemonName: string;
    moves: Array<{ moveId: string; moveName: string }>;
    competitiveSet?: CompetitiveSet;
  }>;
};

export function TeamToolbar({
  name,
  onNameChange,
  generation,
  scope,
  format,
  team,
  activeSavedTeamId,
  onActiveSavedTeamIdChange,
  onLoad,
  onNewDraft,
}: {
  name: string;
  onNameChange: (name: string) => void;
  generation: Generation;
  scope: CatalogScope;
  format: BattleFormat;
  team: TeamSlot[];
  activeSavedTeamId: Id<"savedTeams"> | null;
  onActiveSavedTeamIdChange: (id: Id<"savedTeams"> | null) => void;
  onLoad: (team: SavedTeamDocument) => Promise<void>;
  onNewDraft: () => void;
}) {
  const backend = useBackendStatus();

  return (
    <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/65 p-3 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center">
      <label className="min-w-0 flex-1">
        <span className="sr-only">Team name</span>
        <input
          value={name}
          maxLength={80}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Name this team"
          className="h-10 w-full rounded-xl border border-transparent bg-transparent px-3 text-sm font-black tracking-[-0.02em] outline-none transition placeholder:text-black/25 hover:border-black/[0.06] focus:border-black/15 focus:bg-white"
        />
      </label>

      {backend.isConfigured ? (
        <ConfiguredCloudControls
          name={name}
          generation={generation}
          scope={scope}
          format={format}
          team={team}
          activeSavedTeamId={activeSavedTeamId}
          onActiveSavedTeamIdChange={onActiveSavedTeamIdChange}
          onLoad={onLoad}
          onNewDraft={onNewDraft}
        />
      ) : (
        <span className="flex h-10 items-center gap-2 rounded-xl bg-black/[0.035] px-3 text-[10px] font-bold text-black/40">
          <CloudOff className="h-3.5 w-3.5" />
          Auto-saved on this device
        </span>
      )}
    </section>
  );
}

function ConfiguredCloudControls(props: {
  name: string;
  generation: Generation;
  scope: CatalogScope;
  format: BattleFormat;
  team: TeamSlot[];
  activeSavedTeamId: Id<"savedTeams"> | null;
  onActiveSavedTeamIdChange: (id: Id<"savedTeams"> | null) => void;
  onLoad: (team: SavedTeamDocument) => Promise<void>;
  onNewDraft: () => void;
}) {
  const { isLoaded, user } = useUser();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    const nextUserId = user?.id ?? null;
    if (previousUserId.current && previousUserId.current !== nextUserId) {
      props.onNewDraft();
    }
    previousUserId.current = nextUserId;
  }, [isLoaded, props, user?.id]);

  return (
    <>
      <AuthLoading>
        <span className="flex h-10 items-center gap-2 px-3 text-[10px] font-bold text-black/35">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Connecting…
        </span>
      </AuthLoading>
      <Unauthenticated>
        <SignInButton mode="modal">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-[10px] font-black uppercase tracking-[0.08em] transition hover:border-black/25"
          >
            <LogIn className="h-3.5 w-3.5" /> Sign in to sync
          </button>
        </SignInButton>
      </Unauthenticated>
      <Authenticated>
        <SavedTeamControls {...props} />
      </Authenticated>
    </>
  );
}

function SavedTeamControls({
  name,
  generation,
  scope,
  format,
  team,
  activeSavedTeamId,
  onActiveSavedTeamIdChange,
  onLoad,
  onNewDraft,
}: {
  name: string;
  generation: Generation;
  scope: CatalogScope;
  format: BattleFormat;
  team: TeamSlot[];
  activeSavedTeamId: Id<"savedTeams"> | null;
  onActiveSavedTeamIdChange: (id: Id<"savedTeams"> | null) => void;
  onLoad: (team: SavedTeamDocument) => Promise<void>;
  onNewDraft: () => void;
}) {
  const savedTeams = useQuery(api.teams.list);
  const createTeam = useMutation(api.teams.create);
  const updateTeam = useMutation(api.teams.update);
  const removeTeam = useMutation(api.teams.remove);
  const [busy, setBusy] = useState<"save" | "load" | "delete" | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compactSlots = team.map((slot) => ({
    pokemonId: slot.pokemon.id,
    pokemonName: slot.pokemon.name,
    moves: slot.moves.map((move) => ({
      moveId: move.id,
      moveName: move.name,
    })),
    competitiveSet: slot.competitiveSet,
  }));

  async function saveTeam() {
    setBusy("save");
    setError(null);
    setSaved(false);
    try {
      if (activeSavedTeamId) {
        await updateTeam({
          teamId: activeSavedTeamId,
          name: name.trim() || "Untitled team",
          generation,
          scope,
          format,
          slots: compactSlots,
        });
      } else {
        const id = await createTeam({
          name: name.trim() || "Untitled team",
          generation,
          scope,
          format,
          slots: compactSlots,
        });
        onActiveSavedTeamIdChange(id);
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function selectTeam(rawId: string) {
    if (!rawId) {
      onActiveSavedTeamIdChange(null);
      onNewDraft();
      return;
    }
    const selected = savedTeams?.find((candidate) => candidate._id === rawId);
    if (!selected) return;
    setBusy("load");
    setError(null);
    try {
      await onLoad(selected);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Load failed.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteCurrent() {
    if (!activeSavedTeamId) return;
    const selected = savedTeams?.find((candidate) => candidate._id === activeSavedTeamId);
    if (!window.confirm(`Delete “${selected?.name ?? "this team"}” from the cloud?`)) return;
    setBusy("delete");
    setError(null);
    try {
      await removeTeam({ teamId: activeSavedTeamId });
      onActiveSavedTeamIdChange(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error ? (
        <span role="alert" className="max-w-44 truncate text-[10px] font-bold text-[#c83d32]" title={error}>
          {error}
        </span>
      ) : null}
      <label className="relative">
        <span className="sr-only">Open a saved team</span>
        <select
          value={activeSavedTeamId ?? ""}
          onChange={(event) => void selectTeam(event.target.value)}
          disabled={busy !== null || savedTeams === undefined}
          className="h-10 max-w-48 rounded-xl border border-black/10 bg-white px-3 text-[10px] font-bold outline-none disabled:opacity-50"
        >
          <option value="">New local draft</option>
          {savedTeams?.map((savedTeam) => (
            <option key={savedTeam._id} value={savedTeam._id}>
              {savedTeam.name} · Gen {savedTeam.generation} ·{" "}
              {savedTeam.scope === "core" ? "Core" : "All"}
            </option>
          ))}
        </select>
      </label>
      {activeSavedTeamId ? (
        <button
          type="button"
          onClick={() => void deleteCurrent()}
          disabled={busy !== null}
          aria-label="Delete current saved team"
          className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-white text-black/35 transition hover:border-[#ef5b4c]/40 hover:text-[#d64639] disabled:opacity-50"
        >
          {busy === "delete" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void saveTeam()}
        disabled={busy !== null}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#191816] px-4 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#ef5b4c] disabled:opacity-50"
        aria-live="polite"
      >
        {busy === "save" || busy === "load" ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <Check className="h-3.5 w-3.5" />
        ) : activeSavedTeamId ? (
          <Cloud className="h-3.5 w-3.5" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {saved ? "Saved" : activeSavedTeamId ? "Update" : "Save"}
      </button>
    </div>
  );
}
