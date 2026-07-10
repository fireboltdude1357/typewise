#!/usr/bin/env node

/**
 * Generate the compact, server-consumable legality supplements used by Typewise.
 *
 * The regular application intentionally does not ship @pkmn/sim. This script uses
 * the simulator and its game mods at build/development time, then checks in only
 * the small title-specific pools and canonical-pool deltas the runtime needs.
 *
 * Legends: Z-A is not present in @pkmn/sim 0.10.11, so its official Pokémon
 * Showdown mod is fetched from an immutable commit and verified by SHA-256 before
 * being transpiled in memory. No generated field depends on the current date.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Generations } from "@pkmn/data";
import { Dex as DataDex } from "@pkmn/dex";
import * as ChampionsMod from "@pkmn/mods/champions";
import * as LetsGoMod from "@pkmn/mods/gen7letsgo";
import { Dex as SimDex, TeamValidator } from "@pkmn/sim";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "src/data/core-game-data.json");

const EXPECTED_PACKAGE_VERSIONS = Object.freeze({
  "@pkmn/mods": "0.10.11",
  "@pkmn/sim": "0.10.11",
});

const SHOWDOWN_COMMIT = "d21da3c860f62d2ecd2feec7d910ef56d5054988";
const SHOWDOWN_RAW_BASE =
  `https://raw.githubusercontent.com/smogon/pokemon-showdown/${SHOWDOWN_COMMIT}`;
const GEN9_LEGENDS_FILES = Object.freeze({
  "data/mods/gen9legends/formats-data.ts":
    "35a604463cd4acbd7e86bc79393d487537940fef1bb8cdf15b50171559916de2",
  "data/mods/gen9legends/learnsets.ts":
    "da28ffeb8b2218e8b02d0543a0a063151fe73176cd45d72cf5b4db73115ce888",
  "data/mods/gen9legends/pokedex.ts":
    "c54238bc10b5f9e5839942b527695236d0133a83886b621e9fec6364d2abcb09",
  "data/mods/gen9legends/scripts.ts":
    "af15b3edab448225161ebe4ccc0425059daaeeea8e63f22785ef015a86c4fa6a",
});
const GEN9_LEGENDS_RELEASE_OVERLAYS = Object.freeze({
  garchompmegaz: {
    availableSince: "2026-02-27",
    source: "https://legends.pokemon.com/en-gb/news/mega-garchomp-z",
  },
});

const EXCLUDED_OFFICIAL_FLAGS = new Set(["CAP", "Custom", "Unobtainable"]);
const ILLEGAL_TIERS = new Set(["Illegal", "Unreleased"]);
const HIDDEN_POWER_TYPES = Object.freeze([
  "Fighting",
  "Flying",
  "Poison",
  "Ground",
  "Rock",
  "Bug",
  "Ghost",
  "Steel",
  "Fire",
  "Water",
  "Grass",
  "Electric",
  "Psychic",
  "Ice",
  "Dragon",
  "Dark",
]);
const STAT_IDS = Object.freeze(["hp", "atk", "def", "spa", "spd", "spe"]);
const EMPTY_EVS = Object.freeze({ hp: 1, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const BASE_VALIDATION_FORMATS = Object.freeze({
  1: "gen1ubers",
  2: "gen2ubers",
  3: "gen3ubers",
  4: "gen4anythinggoes",
  5: "gen5ubers",
  6: "gen6anythinggoes",
  7: "gen7anythinggoes",
  8: "gen8anythinggoes",
  9: "gen9nationaldexag",
});
const BASE_LEGALITY_PROBES = Object.freeze([
  [3, "smeargle", "spore", true],
  [5, "kyuremblack", "glaciate", false],
  [5, "kyuremblack", "scaryface", false],
  [5, "kyuremwhite", "glaciate", false],
  [5, "kyuremwhite", "scaryface", false],
  [7, "greninjabond", "counter", false],
  [7, "greninjabond", "retaliate", false],
  [7, "greninjabond", "switcheroo", false],
  [7, "greninjabond", "toxicspikes", false],
  [7, "raichualola", "doublekick", false],
  [8, "greninjabond", "counter", false],
  [8, "greninjabond", "retaliate", false],
  [8, "greninjabond", "switcheroo", false],
  [8, "greninjabond", "toxicspikes", false],
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sortedObject(entries) {
  return Object.fromEntries(
    [...entries].sort(([left], [right]) => left.localeCompare(right)),
  );
}

async function installedVersion(packageName) {
  const packagePath = path.join(ROOT_DIR, "node_modules", packageName, "package.json");
  return JSON.parse(await readFile(packagePath, "utf8")).version;
}

async function verifyPackageVersions() {
  const installed = {};
  for (const [packageName, expected] of Object.entries(EXPECTED_PACKAGE_VERSIONS)) {
    const actual = await installedVersion(packageName);
    invariant(
      actual === expected,
      `${packageName} ${actual} is installed; generator expects ${expected}.`,
    );
    installed[packageName] = actual;
  }
  return installed;
}

async function importTypeScriptSource(source, identifier) {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: identifier,
    reportDiagnostics: true,
  });
  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  invariant(errors.length === 0, `Could not transpile ${identifier}.`);
  const encoded = Buffer.from(transpiled.outputText).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

async function loadPinnedGen9LegendsMod() {
  const modules = [];
  for (const [file, expectedHash] of Object.entries(GEN9_LEGENDS_FILES)) {
    const response = await fetch(`${SHOWDOWN_RAW_BASE}/${file}`, {
      signal: AbortSignal.timeout(30_000),
    });
    invariant(response.ok, `Could not fetch pinned Pokémon Showdown file ${file}.`);
    const source = await response.text();
    const actualHash = sha256(source);
    invariant(
      actualHash === expectedHash,
      `Pinned Pokémon Showdown file ${file} failed SHA-256 verification.`,
    );
    modules.push(await importTypeScriptSource(source, file));
  }
  return Object.assign({}, ...modules);
}

function cloneFormatEntries(formatsData) {
  return Object.entries(formatsData).map(([id, value]) => [id, { ...value }]);
}

function usableFormatSpeciesIds(dex, capturedEntries) {
  return capturedEntries
    .filter(([id, formatData]) => {
      const species = dex.species.get(id);
      return (
        species.exists &&
        species.num > 0 &&
        !species.isCosmeticForme &&
        !formatData.isNonstandard &&
        !ILLEGAL_TIERS.has(formatData.tier)
      );
    })
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));
}

function standardSpeciesIds(dex) {
  return dex.species
    .all()
    .filter(
      (species) =>
        species.exists &&
        species.num > 0 &&
        !species.isNonstandard &&
        !species.isCosmeticForme,
    )
    .map((species) => species.id)
    .sort((a, b) => a.localeCompare(b));
}

function collectDirectMoveSources(dex, speciesId) {
  const sourcesByMove = new Map();
  for (const row of dex.species.getFullLearnset(speciesId)) {
    for (const [moveId, sources] of Object.entries(row.learnset)) {
      const current = sourcesByMove.get(moveId) ?? [];
      current.push(...sources);
      sourcesByMove.set(moveId, current);
    }
  }
  return new Map(
    [...sourcesByMove].map(([moveId, sources]) => [moveId, sortedUnique(sources)]),
  );
}

function sourceGeneration(source) {
  const generation = Number.parseInt(source.charAt(0), 10);
  return Number.isInteger(generation) ? generation : null;
}

function sourcesThroughGeneration(sources, generation) {
  return sources.filter((source) => {
    const learnedGeneration = sourceGeneration(source);
    return learnedGeneration !== null && learnedGeneration <= generation;
  });
}

function hasSketchSourceThroughGeneration(dex, speciesId, generation) {
  return dex.species.getFullLearnset(speciesId).some(({ learnset }) =>
    sourcesThroughGeneration(learnset.sketch ?? [], generation).length > 0,
  );
}

function hasLegalSketchRoute(dex, speciesId, moveId, generation) {
  const move = dex.moves.get(moveId);
  return (
    move.exists &&
    move.id !== "sketch" &&
    move.gen <= generation &&
    !move.flags.nosketch &&
    !move.isZ &&
    !move.isMax &&
    hasSketchSourceThroughGeneration(dex, speciesId, generation)
  );
}

function individuallyLegalMove(validator, speciesId, moveId) {
  const species = validator.dex.species.get(speciesId);
  const move = validator.dex.moves.get(moveId);
  if (!species.exists || !move.exists) return false;
  return validator.checkCanLearn(move, species) === null;
}

function titleLegalityValidator(dex, label) {
  const name = `[Typewise Data] ${label} Legality`;
  dex.formats.extend([
    {
      name,
      mod: dex.currentMod,
      ruleset: ["Obtainable"],
    },
  ]);
  return new TeamValidator(name, dex);
}

function buildTitleData({
  dex,
  generation,
  kind,
  name,
  provenance,
  speciesIds,
  validator,
}) {
  const learnsets = [];
  const syntheticLearnsets = [];
  let directMoveCount = 0;
  let syntheticMoveCount = 0;

  for (const speciesId of speciesIds) {
    const movePool = [...dex.species.getMovePool(speciesId, false)].filter(
      (moveId) => individuallyLegalMove(validator, speciesId, moveId),
    );
    const directSources = collectDirectMoveSources(dex, speciesId);
    const directEntries = [];
    const syntheticEntries = [];

    for (const moveId of [...movePool].sort((a, b) => a.localeCompare(b))) {
      const sources = sourcesThroughGeneration(
        directSources.get(moveId) ?? [],
        generation,
      );
      if (
        hasLegalSketchRoute(dex, speciesId, moveId, generation)
      ) {
        syntheticEntries.push([moveId, [`${generation}K`]]);
        syntheticMoveCount += 1;
      } else if (sources.length) {
        directEntries.push([moveId, sources]);
        directMoveCount += 1;
      } else {
        invariant(
          false,
          `No current/past source explains ${name} ${speciesId}'s ${moveId}.`,
        );
      }
    }

    learnsets.push([speciesId, sortedObject(directEntries)]);
    if (syntheticEntries.length) {
      syntheticLearnsets.push([speciesId, sortedObject(syntheticEntries)]);
    }
  }

  return {
    generation,
    name,
    kind,
    provenance,
    counts: {
      speciesEntries: speciesIds.length,
      nationalSpecies: new Set(
        speciesIds.map((speciesId) => dex.species.get(speciesId).num),
      ).size,
      directMoves: directMoveCount,
      syntheticMoves: syntheticMoveCount,
    },
    species: speciesIds,
    learnsets: sortedObject(learnsets),
    syntheticLearnsets: sortedObject(syntheticLearnsets),
  };
}

function permissiveExists(data, generation) {
  if (!data.exists) return false;
  if ("gen" in data && data.gen > generation) return false;
  if (
    "isNonstandard" in data &&
    EXCLUDED_OFFICIAL_FLAGS.has(data.isNonstandard)
  ) {
    return false;
  }
  if (data.kind === "Ability" && data.id === "noability") return false;
  return true;
}

function officialNationalSpecies(dex, generation) {
  return dex.species
    .all()
    .filter(
      (species) =>
        species.exists &&
        species.num > 0 &&
        species.gen <= generation &&
        !species.isCosmeticForme &&
        !EXCLUDED_OFFICIAL_FLAGS.has(species.isNonstandard),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function buildBaseMovePoolDeltas() {
  SimDex.includeFormats();
  const permissiveGenerations = new Generations(DataDex, permissiveExists);
  const deltasByGeneration = [];
  const coverageByGeneration = [];
  const probeResults = new Map();

  for (let generation = 1; generation <= 9; generation += 1) {
    const dataDex = DataDex.forGen(generation);
    const simDex = SimDex.forGen(generation);
    const validator = new TeamValidator(BASE_VALIDATION_FORMATS[generation]);
    const candidates = officialNationalSpecies(dataDex, generation);
    const generationDeltas = [];
    let addedMoves = 0;
    let removedMoves = 0;

    for (const species of candidates) {
      const permissive =
        (await permissiveGenerations
          .get(generation)
          .learnsets.learnable(species.name)) ?? {};
      const permissivePool = new Set(Object.keys(permissive));
      const simulatorPool = simDex.species.getMovePool(species.id, true);
      // Both inputs are deliberately broad unions and can agree on inherited
      // moves that are nevertheless illegal for a locked forme. Validate their
      // complete union rather than treating either helper as a legality oracle.
      const legalPool = new Set(
        [...new Set([...permissivePool, ...simulatorPool])].filter((moveId) =>
          individuallyLegalMove(validator, species.id, moveId),
        ),
      );
      const remove = [...permissivePool]
        .filter((moveId) => !legalPool.has(moveId))
        .sort((a, b) => a.localeCompare(b));
      const addedIds = [...legalPool]
        .filter((moveId) => !permissivePool.has(moveId))
        .sort((a, b) => a.localeCompare(b));

      for (const [probeGeneration, probeSpecies, probeMove] of
        BASE_LEGALITY_PROBES) {
        if (probeGeneration === generation && probeSpecies === species.id) {
          probeResults.set(
            `${generation}:${species.id}:${probeMove}`,
            legalPool.has(probeMove),
          );
        }
      }

      if (!remove.length && !addedIds.length) continue;

      const directSources = collectDirectMoveSources(simDex, species.id);
      const add = addedIds.map((moveId) => {
        const direct = sourcesThroughGeneration(
          directSources.get(moveId) ?? [],
          generation,
        );
        // A direct future event source does not explain why an earlier-gen
        // Smeargle can use the move. Prefer the explicit synthetic Sketch
        // source whenever Sketch is the available legal route.
        const sources = hasLegalSketchRoute(
          simDex,
          species.id,
          moveId,
          generation,
        )
          ? [`${generation}K`]
          : direct;
        invariant(
          sources.length > 0,
          `No current/past source explains Gen ${generation} ${species.name}'s ${moveId}.`,
        );
        return [moveId, sources];
      });
      const delta = {};
      if (remove.length) delta.remove = remove;
      if (add.length) delta.add = sortedObject(add);
      generationDeltas.push([species.id, delta]);
      addedMoves += add.length;
      removedMoves += remove.length;
    }

    deltasByGeneration.push([
      String(generation),
      sortedObject(generationDeltas),
    ]);
    coverageByGeneration.push([
      String(generation),
      {
        candidateSpeciesEntries: candidates.length,
        changedSpeciesEntries: generationDeltas.length,
        addedMoves,
        removedMoves,
      },
    ]);
  }

  return {
    deltas: sortedObject(deltasByGeneration),
    coverage: sortedObject(coverageByGeneration),
    probeResults,
  };
}

function assertBaseMovePoolRegressions(baseMovePool) {
  const deltas = baseMovePool.deltas;
  for (const [generation, speciesId, moveId, expected] of
    BASE_LEGALITY_PROBES) {
    invariant(
      baseMovePool.probeResults.get(`${generation}:${speciesId}:${moveId}`) ===
        expected,
      `Gen ${generation} ${speciesId}'s ${moveId} legality changed unexpectedly.`,
    );
  }
  invariant(
    deltas["3"].smeargle?.add?.spore?.[0] === "3K",
    "Gen 3 Smeargle must learn Spore through Sketch, not a future event.",
  );
  invariant(
    !deltas["7"].greninjabond?.add?.counter,
    "Gen 7 Greninja-Bond must not inherit Gen 9 Counter.",
  );
  invariant(
    !deltas["7"].greninjabond?.add?.toxicspikes,
    "Gen 7 Greninja-Bond must not inherit incompatible Toxic Spikes sources.",
  );
  invariant(
    deltas["5"].kyuremblack?.remove?.includes("glaciate") &&
      deltas["5"].kyuremblack?.remove?.includes("scaryface"),
    "Gen 5 Kyurem-Black must not inherit Kyurem's locked-form moves.",
  );
  invariant(
    deltas["5"].kyuremwhite?.remove?.includes("glaciate") &&
      deltas["5"].kyuremwhite?.remove?.includes("scaryface"),
    "Gen 5 Kyurem-White must not inherit Kyurem's locked-form moves.",
  );

  for (const [generation, speciesDeltas] of Object.entries(deltas)) {
    for (const [speciesId, delta] of Object.entries(speciesDeltas)) {
      for (const [moveId, sources] of Object.entries(delta.add ?? {})) {
        invariant(
          sources.every((source) => {
            const learnedGeneration = sourceGeneration(source);
            return (
              learnedGeneration !== null &&
              learnedGeneration <= Number(generation)
            );
          }),
          `Gen ${generation} ${speciesId}'s ${moveId} has a future source.`,
        );
      }
    }
  }
}

function ivsForMask(mask, low = 30, high = 31) {
  return Object.fromEntries(
    STAT_IDS.map((stat, index) => [stat, (mask >> index) & 1 ? high : low]),
  );
}

function perfectIvCount(ivs) {
  return STAT_IDS.filter((stat) => ivs[stat] === 31).length;
}

function hiddenPowerIvPatterns(dex) {
  const byType = new Map(HIDDEN_POWER_TYPES.map((type) => [type, []]));
  for (let mask = 0; mask < 64; mask += 1) {
    const ivs = ivsForMask(mask);
    const type = dex.getHiddenPower(ivs).type;
    if (byType.has(type)) byType.get(type).push(ivs);
  }
  for (const patterns of byType.values()) {
    patterns.sort(
      (left, right) =>
        perfectIvCount(right) - perfectIvCount(left) ||
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  }
  return byType;
}

function speciesEvents(dex, speciesId, generation) {
  const events = [];
  for (const row of dex.species.getFullLearnset(speciesId)) {
    for (const event of row.eventData ?? []) {
      if (event.generation <= generation) events.push(event);
    }
  }
  return events;
}

function eventIvPatterns(events) {
  const patterns = [];
  for (const event of events) {
    if (!event.ivs) continue;
    for (let mask = 0; mask < 64; mask += 1) {
      const flexible = ivsForMask(mask);
      const ivs = Object.fromEntries(
        STAT_IDS.map((stat) => [stat, event.ivs[stat] ?? flexible[stat]]),
      );
      patterns.push({ event, ivs });
    }
  }
  return patterns;
}

function sourceSpeciesForValidation(dex, species) {
  const battleOnly = Array.isArray(species.battleOnly)
    ? species.battleOnly[0]
    : species.battleOnly;
  const candidates = [
    species,
    ...(battleOnly ? [dex.species.get(battleOnly)] : []),
    ...(species.changesFrom ? [dex.species.get(species.changesFrom)] : []),
  ];
  return [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
}

function validationTemplates(species, sourceSpecies, events) {
  const defaultItem = species.requiredItem ?? species.requiredItems?.[0] ?? "";
  const templates = sourceSpecies.flatMap((candidate) =>
    sortedUnique(Object.values(candidate.abilities)).map((ability) => ({
      species: candidate.name,
      ability,
      item: defaultItem,
      nature: "Serious",
    })),
  );

  for (const event of events) {
    for (const candidate of sourceSpecies) {
      const eventAbilities = event.abilities?.length
        ? event.abilities
        : sortedUnique(Object.values(candidate.abilities));
      for (const ability of eventAbilities) {
        templates.push({
          species: candidate.name,
          ability,
          item: defaultItem,
          nature: event.nature ?? "Serious",
          ...(event.gender ? { gender: event.gender } : {}),
          ...(typeof event.shiny === "boolean" ? { shiny: event.shiny } : {}),
        });
      }
    }
  }

  const unique = new Map(
    templates.map((template) => [JSON.stringify(template), template]),
  );
  return [...unique.values()];
}

function validatesHiddenPower({
  hpType,
  ivs,
  templates,
  validator,
}) {
  for (const template of templates) {
    const set = {
      name: template.species,
      species: template.species,
      item: template.item,
      ability: template.ability,
      moves: ["Hidden Power"],
      hpType,
      nature: template.nature,
      evs: { ...EMPTY_EVS },
      ivs: { ...ivs },
      level: 100,
      ...(template.gender ? { gender: template.gender } : {}),
      ...(template.shiny !== undefined ? { shiny: template.shiny } : {}),
    };
    if (validator.validateTeam([set]) === null) return true;
  }
  return false;
}

function buildHiddenPowerTypes() {
  SimDex.includeFormats();
  const result = [];

  for (const generation of [6, 7]) {
    const format = `[Gen ${generation}] Anything Goes`;
    const dex = SimDex.forFormat(format);
    const validator = new TeamValidator(format);
    const standardSpecies = dex.species
      .all()
      .filter(
        (species) =>
          species.exists &&
          species.num > 0 &&
          !species.isNonstandard &&
          !species.isCosmeticForme,
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    const globalPatterns = hiddenPowerIvPatterns(dex);
    const speciesTypes = [];

    for (const species of standardSpecies) {
      if (!dex.species.getMovePool(species.id, true).has("hiddenpower")) continue;

      const events = speciesEvents(dex, species.id, generation);
      const eventPatterns = eventIvPatterns(events);
      const sourceSpecies = sourceSpeciesForValidation(dex, species);
      const templates = validationTemplates(
        species,
        sourceSpecies,
        events,
      );
      const eventPatternsByType = new Map(
        HIDDEN_POWER_TYPES.map((type) => [type, []]),
      );
      for (const { ivs } of eventPatterns) {
        const type = dex.getHiddenPower(ivs).type;
        if (eventPatternsByType.has(type)) {
          eventPatternsByType.get(type).push(ivs);
        }
      }

      const legalTypes = [];
      for (const hpType of HIDDEN_POWER_TYPES) {
        const candidates = [
          ...globalPatterns.get(hpType),
          ...eventPatternsByType.get(hpType),
        ];
        const uniqueCandidates = new Map(
          candidates.map((ivs) => [JSON.stringify(ivs), ivs]),
        );
        if (
          [...uniqueCandidates.values()].some((ivs) =>
            validatesHiddenPower({
              hpType,
              ivs,
              templates,
              validator,
            }),
          )
        ) {
          legalTypes.push(hpType);
        }
      }

      invariant(
        legalTypes.length > 0,
        `No legal Hidden Power variant was found for Gen ${generation} ${species.name}.`,
      );
      speciesTypes.push([species.id, legalTypes]);
    }

    result.push([String(generation), sortedObject(speciesTypes)]);
  }

  const hiddenPowerTypes = sortedObject(result);
  for (const generation of ["6", "7"]) {
    invariant(
      hiddenPowerTypes[generation].pikachu.length === HIDDEN_POWER_TYPES.length,
      `Gen ${generation} Pikachu should support all Hidden Power types.`,
    );
    invariant(
      !hiddenPowerTypes[generation].xerneas.includes("Fighting"),
      `Gen ${generation} Xerneas must not support Hidden Power Fighting.`,
    );
  }
  invariant(
    !hiddenPowerTypes["7"].magearna.includes("Fighting"),
    "Gen 7 Magearna must not support Hidden Power Fighting.",
  );
  return hiddenPowerTypes;
}

async function buildTitles(installedVersions) {
  const letsGoFormatEntries = cloneFormatEntries(LetsGoMod.FormatsData);
  const letsGoDex = SimDex.mod("gen7letsgo", { ...LetsGoMod });
  const letsGoIds = usableFormatSpeciesIds(letsGoDex, letsGoFormatEntries);
  const letsGoValidator = titleLegalityValidator(letsGoDex, "Let's Go");

  const swordShieldDex = SimDex.forGen(8);
  const swordShieldGmaxIds = swordShieldDex.species
    .all()
    .filter(
      (species) =>
        species.exists &&
        species.num > 0 &&
        species.isNonstandard === "Gigantamax" &&
        !species.gmaxUnreleased,
    )
    .map((species) => species.id)
    .sort((left, right) => left.localeCompare(right));
  const swordShieldValidator = titleLegalityValidator(
    swordShieldDex,
    "Sword Shield Gigantamax",
  );

  const bdspDex = SimDex.mod("gen8bdsp");
  const bdspIds = standardSpeciesIds(bdspDex);
  const bdspValidator = titleLegalityValidator(bdspDex, "BDSP");
  const legendsArceusDex = SimDex.mod("gen8legends");
  const legendsArceusIds = standardSpeciesIds(legendsArceusDex);
  const legendsArceusValidator = titleLegalityValidator(
    legendsArceusDex,
    "Legends Arceus",
  );

  const gen9LegendsMod = await loadPinnedGen9LegendsMod();
  const gen9LegendsFormatEntries = cloneFormatEntries(
    gen9LegendsMod.FormatsData,
  );
  const gen9LegendsDex = SimDex.mod("gen9legends", gen9LegendsMod);
  const gen9LegendsFormats = new Map(gen9LegendsFormatEntries);
  for (const speciesId of Object.keys(GEN9_LEGENDS_RELEASE_OVERLAYS)) {
    invariant(
      gen9LegendsDex.species.get(speciesId).exists &&
        gen9LegendsFormats.get(speciesId)?.isNonstandard === "Unobtainable",
      `Pinned Z-A data no longer needs the ${speciesId} release overlay.`,
    );
  }
  const gen9LegendsIds = sortedUnique([
    ...usableFormatSpeciesIds(gen9LegendsDex, gen9LegendsFormatEntries),
    ...Object.keys(GEN9_LEGENDS_RELEASE_OVERLAYS),
  ]);
  const gen9LegendsValidator = titleLegalityValidator(
    gen9LegendsDex,
    "Legends Z-A",
  );

  const championsFormatEntries = cloneFormatEntries(ChampionsMod.FormatsData);
  const championsDex = SimDex.mod("champions", { ...ChampionsMod });
  const championsIds = usableFormatSpeciesIds(
    championsDex,
    championsFormatEntries,
  );
  const championsValidator = titleLegalityValidator(
    championsDex,
    "Champions",
  );

  invariant(
    letsGoIds.length === 188 &&
      new Set(letsGoIds.map((id) => letsGoDex.species.get(id).num)).size === 153,
    "Unexpected Let's Go species count.",
  );
  invariant(
    swordShieldGmaxIds.length === 34 &&
      new Set(
        swordShieldGmaxIds.map((id) => swordShieldDex.species.get(id).num),
      ).size === 32,
    "Unexpected Sword / Shield Gigantamax species count.",
  );
  invariant(
    bdspIds.length === 526 &&
      new Set(bdspIds.map((id) => bdspDex.species.get(id).num)).size === 493,
    "Unexpected BDSP species count.",
  );
  invariant(
    legendsArceusIds.length === 279 &&
      new Set(
        legendsArceusIds.map((id) => legendsArceusDex.species.get(id).num),
      ).size === 242,
    "Unexpected Legends: Arceus species count.",
  );
  invariant(
    gen9LegendsIds.length === 514 &&
      new Set(
        gen9LegendsIds.map((id) => gen9LegendsDex.species.get(id).num),
      ).size === 364,
    "Unexpected Legends: Z-A species count.",
  );
  invariant(
    championsIds.length === 314 &&
      new Set(championsIds.map((id) => championsDex.species.get(id).num)).size ===
        208,
    "Unexpected Pokémon Champions species count.",
  );

  const packageProvenance = (module) => ({
    package: "@pkmn/mods",
    version: installedVersions["@pkmn/mods"],
    module,
  });

  const titles = [
    [
      "gen7letsgo",
      buildTitleData({
        dex: letsGoDex,
        generation: 7,
        kind: "paired-core-title",
        name: "Let's Go, Pikachu! / Let's Go, Eevee!",
        provenance: packageProvenance("@pkmn/mods/gen7letsgo"),
        speciesIds: letsGoIds,
        validator: letsGoValidator,
      }),
    ],
    [
      "gen8swsh",
      buildTitleData({
        dex: swordShieldDex,
        generation: 8,
        kind: "paired-core-title-supplement",
        name: "Sword / Shield — Gigantamax forms",
        provenance: {
          package: "@pkmn/sim",
          version: installedVersions["@pkmn/sim"],
          module: "gen8",
        },
        speciesIds: swordShieldGmaxIds,
        validator: swordShieldValidator,
      }),
    ],
    [
      "gen8bdsp",
      buildTitleData({
        dex: bdspDex,
        generation: 8,
        kind: "paired-remake",
        name: "Brilliant Diamond / Shining Pearl",
        provenance: {
          package: "@pkmn/sim",
          version: installedVersions["@pkmn/sim"],
          module: "gen8bdsp",
        },
        speciesIds: bdspIds,
        validator: bdspValidator,
      }),
    ],
    [
      "gen8legends",
      buildTitleData({
        dex: legendsArceusDex,
        generation: 8,
        kind: "legends-core-title",
        name: "Pokémon Legends: Arceus",
        provenance: {
          package: "@pkmn/sim",
          version: installedVersions["@pkmn/sim"],
          module: "gen8legends",
        },
        speciesIds: legendsArceusIds,
        validator: legendsArceusValidator,
      }),
    ],
    [
      "gen9legends",
      buildTitleData({
        dex: gen9LegendsDex,
        generation: 9,
        kind: "legends-core-title",
        name: "Pokémon Legends: Z-A",
        provenance: {
          repository: "smogon/pokemon-showdown",
          commit: SHOWDOWN_COMMIT,
          module: "data/mods/gen9legends",
        },
        speciesIds: gen9LegendsIds,
        validator: gen9LegendsValidator,
      }),
    ],
    [
      "champions",
      buildTitleData({
        dex: championsDex,
        generation: 9,
        kind: "competitive-title",
        name: "Pokémon Champions",
        provenance: packageProvenance("@pkmn/mods/champions"),
        speciesIds: championsIds,
        validator: championsValidator,
      }),
    ],
  ];

  const titleData = sortedObject(titles);
  invariant(titleData.gen7letsgo.species.includes("meltan"), "Let's Go must include Meltan.");
  invariant(
    titleData.gen7letsgo.species.includes("pikachustarter") &&
      titleData.gen7letsgo.species.includes("eeveestarter"),
    "Let's Go must include both partner starter formes.",
  );
  invariant(
    titleData.gen8swsh.species.includes("charizardgmax") &&
      titleData.gen8swsh.species.includes("urshifurapidstrikegmax"),
    "Sword / Shield must include all released Gigantamax formes.",
  );
  invariant(titleData.gen8bdsp.species.includes("unown"), "BDSP must include Unown.");
  invariant(
    titleData.gen8legends.species.includes("ursaluna"),
    "Legends: Arceus must include Ursaluna.",
  );
  invariant(
    titleData.gen9legends.species.includes("raichumegax"),
    "Legends: Z-A must include Raichu-Mega-X.",
  );
  invariant(
    titleData.gen9legends.species.includes("garchompmegaz"),
    "Legends: Z-A must include the released Garchomp-Mega-Z Mystery Gift.",
  );
  invariant(
    titleData.gen8bdsp.syntheticLearnsets.smeargle?.spacialrend?.[0] === "8K",
    "BDSP Smeargle must receive synthetic Sketch sources.",
  );
  return titleData;
}

async function main() {
  const installedVersions = await verifyPackageVersions();
  const baseMovePool = await buildBaseMovePoolDeltas();
  assertBaseMovePoolRegressions(baseMovePool);
  const hiddenPowerTypes = buildHiddenPowerTypes();
  const titles = await buildTitles(installedVersions);

  const output = {
    schemaVersion: 1,
    generatedFrom: {
      packages: installedVersions,
      pokemonShowdown: {
        repository: "smogon/pokemon-showdown",
        commit: SHOWDOWN_COMMIT,
        files: GEN9_LEGENDS_FILES,
      },
      officialReleaseOverlays: {
        gen9legends: GEN9_LEGENDS_RELEASE_OVERLAYS,
      },
    },
    syntheticSourceMethods: {
      K: "Sketch",
    },
    titleOrder: [
      "gen7letsgo",
      "gen8swsh",
      "gen8bdsp",
      "gen8legends",
      "gen9legends",
      "champions",
    ],
    titles,
    hiddenPowerTypes,
    baseMovePoolCoverage: baseMovePool.coverage,
    baseMovePoolDeltas: baseMovePool.deltas,
  };

  const serialized = `${JSON.stringify(output)}\n`;
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, serialized, "utf8");
  process.stdout.write(
    `${path.relative(ROOT_DIR, OUTPUT_PATH)} ${Buffer.byteLength(serialized)} bytes ${sha256(serialized)}\n`,
  );
}

await main();
