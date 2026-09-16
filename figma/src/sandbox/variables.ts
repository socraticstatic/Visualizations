import type { VariableSpec, WriteSummary, WrittenRecord } from "../shared/protocol";
import { recordFromSpecs } from "../shared/spec";

const COLLECTION = "Chart Color System";
const FALLBACK_COLLECTION = "Chart Color System Dark";
const RECORD_KEY = "chart-color-system:written";

/** Figma throws `in addMode: Limited to N modes only` when the plan caps modes. */
export function isModeLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return /Limited to \d+ modes only/.test(msg);
}

/**
 * Try to add a Dark mode. On a one-mode plan this is unavailable and the caller
 * writes a second collection instead, which preserves the values but not the
 * switching: a designer on that plan rebinds to change theme. A consolation
 * prize, and the panel says so.
 */
export function planModeStrategy(addMode: () => string): { darkModeId: string | null; needsFallback: boolean } {
  try {
    return { darkModeId: addMode(), needsFallback: false };
  } catch (e) {
    if (isModeLimitError(e)) return { darkModeId: null, needsFallback: true };
    throw e;
  }
}

async function findCollection(name: string): Promise<VariableCollection | null> {
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  return all.find((c) => c.name === name) ?? null;
}

async function variablesOf(collection: VariableCollection): Promise<Map<string, Variable>> {
  const out = new Map<string, Variable>();
  for (const id of collection.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v) out.set(v.name, v);
  }
  return out;
}

export async function readWrittenRecord(): Promise<WrittenRecord | null> {
  const collection = await findCollection(COLLECTION);
  if (!collection) return null;
  const raw = collection.getPluginData(RECORD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WrittenRecord;
  } catch {
    return null;
  }
}

/** Current values, in the same shape the record uses, so drift is comparable. */
export async function readCurrentRecord(): Promise<WrittenRecord> {
  const out: WrittenRecord = {};
  const collection = await findCollection(COLLECTION);
  if (!collection) return out;

  const light = collection.defaultModeId;
  const dark = collection.modes.find((m) => m.name === "Dark")?.modeId ?? light;

  const fmt = (v: unknown): string => {
    if (typeof v === "string") return v;
    const c = v as { r: number; g: number; b: number };
    return c && typeof c.r === "number"
      ? `${c.r.toFixed(6)},${c.g.toFixed(6)},${c.b.toFixed(6)}`
      : String(v);
  };

  for (const [name, variable] of await variablesOf(collection)) {
    out[name] = {
      light: fmt(variable.valuesByMode[light]),
      dark: fmt(variable.valuesByMode[dark]),
    };
  }
  return out;
}

function applyMetadata(v: Variable, spec: VariableSpec): void {
  // Code syntax puts the handoff name in Dev Mode's snippets rather than
  // leaving a developer to invent one from the layer name.
  try {
    v.setVariableCodeSyntax("WEB", spec.codeSyntax);
  } catch {
    /* older clients simply do without */
  }
  // Scoping keeps chart colours out of pickers they have no business in.
  try {
    (v as unknown as { scopes: string[] }).scopes = spec.scopes;
  } catch {
    /* scopes unsupported on this client */
  }
}

/**
 * Create or update in place, keyed on plugin data so a re-run never duplicates.
 * `confirmedOverwrites` lists names the designer explicitly agreed to replace;
 * anything else that has drifted is left exactly as they left it.
 */
export async function applySpecs(
  specs: VariableSpec[],
  confirmedOverwrites: string[]
): Promise<WriteSummary> {
  const confirmed = new Set(confirmedOverwrites);
  const previous = await readWrittenRecord();
  const current = await readCurrentRecord();

  let collection = await findCollection(COLLECTION);
  if (!collection) {
    collection = figma.variables.createVariableCollection(COLLECTION);
    collection.renameMode(collection.defaultModeId, "Light");
  }
  const lightModeId = collection.defaultModeId;

  const existingDark = collection.modes.find((m) => m.name === "Dark");
  const strategy = existingDark
    ? { darkModeId: existingDark.modeId, needsFallback: false }
    : planModeStrategy(() => collection!.addMode("Dark"));

  let fallback: VariableCollection | null = null;
  if (strategy.needsFallback) {
    fallback = (await findCollection(FALLBACK_COLLECTION)) ?? figma.variables.createVariableCollection(FALLBACK_COLLECTION);
  }

  const byName = await variablesOf(collection);
  const fallbackByName = fallback ? await variablesOf(fallback) : new Map<string, Variable>();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const spec of specs) {
    const wasWritten = previous?.[spec.name];
    const now = current[spec.name];
    const drifted =
      Boolean(wasWritten) && Boolean(now) && (now.light !== wasWritten!.light || now.dark !== wasWritten!.dark);

    if (drifted && !confirmed.has(spec.name)) {
      skipped++;
      continue;
    }

    let v = byName.get(spec.name);
    if (!v) {
      v = figma.variables.createVariable(spec.name, collection, spec.kind);
      byName.set(spec.name, v);
      created++;
    } else {
      updated++;
    }
    v.setValueForMode(lightModeId, spec.light as VariableValue);
    if (strategy.darkModeId) v.setValueForMode(strategy.darkModeId, spec.dark as VariableValue);
    applyMetadata(v, spec);

    if (fallback) {
      let fv = fallbackByName.get(spec.name);
      if (!fv) {
        fv = figma.variables.createVariable(spec.name, fallback, spec.kind);
        fallbackByName.set(spec.name, fv);
      }
      fv.setValueForMode(fallback.defaultModeId, spec.dark as VariableValue);
      applyMetadata(fv, spec);
    }
  }

  collection.setPluginData(RECORD_KEY, JSON.stringify(recordFromSpecs(specs)));

  return { created, updated, skipped, usedFallbackCollection: Boolean(fallback) };
}
