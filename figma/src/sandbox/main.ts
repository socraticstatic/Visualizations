/**
 * The sandbox holds the figma API and nothing else. Every decision is made by a
 * pure function in ../shared and handed here as a spec to apply.
 *
 * Two entry points: the Design panel, and Dev Mode codegen. Codegen plugins do
 * not show UI, so the branch is on figma.mode rather than editorType.
 */
import type { OpenMessage, Request, Response, SelectionPush, Tab } from "../shared/protocol";
import { registerCodegen } from "./codegen";
import { readSelection } from "./selection";
import { applySpecs, readCurrentRecord, readWrittenRecord } from "./variables";
import { renderSimulation } from "./simulate";
import { checkLicense } from "./gate";
import { insertMockup } from "./mockup";

const TAB_FOR_COMMAND: Record<string, Tab> = {
  generate: "generate",
  audit: "audit",
  simulate: "simulate",
};

const STORE_KEY = "chart-color-system:panel";

function reply(res: Response): void {
  figma.ui.postMessage(res);
}

if (figma.mode === "codegen") {
  registerCodegen();
} else {
  figma.showUI(__html__, { width: 420, height: 720, themeColors: true });

  // Posting the tab immediately races the iframe attaching its listener, which
  // is why every command used to land on Generate. Post it anyway for clients
  // that are ready, and let the UI ask once it definitely is.
  const launchTab: Tab = TAB_FOR_COMMAND[figma.command] ?? "generate";
  const open: OpenMessage = { type: "open", tab: launchTab };
  figma.ui.postMessage(open);

  // Auditing should follow the canvas, not a button. Selecting a different
  // layer is the request.
  // Coalesced: a marquee drag fires this continuously, and each read walks the
  // selection. One push per settled selection is what the panel needs.
  let pushTimer: number | null = null;
  figma.on("selectionchange", () => {
    if (pushTimer !== null) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      const push: SelectionPush = { type: "selection-changed", payload: readSelection() };
      figma.ui.postMessage(push);
    }, 120) as unknown as number;
  });

  figma.ui.onmessage = async (msg: Request) => {
    try {
      switch (msg.type) {
        case "read-command": {
          reply({ id: msg.id, ok: true, type: "command", payload: launchTab });
          return;
        }

        case "read-selection": {
          const payload = readSelection();
          if (payload.nodes.length === 0) {
            reply({ id: msg.id, ok: false, reason: "no-selection", detail: "Select something on the canvas first." });
            return;
          }
          reply({ id: msg.id, ok: true, type: "selection", payload });
          return;
        }

        case "read-written-record": {
          reply({ id: msg.id, ok: true, type: "written-record", payload: await readWrittenRecord() });
          return;
        }

        case "write-variables": {
          const gate = await checkLicense();
          if (!gate.ok) {
            reply({ id: msg.id, ok: false, reason: "unlicensed", detail: gate.detail });
            return;
          }
          const payload = await applySpecs(msg.specs, msg.confirmedOverwrites);
          reply({ id: msg.id, ok: true, type: "variables-written", payload });
          return;
        }

        case "render-simulation": {
          const outcome = renderSimulation(msg.frames);
          if (!outcome.ok) {
            reply({
              id: msg.id,
              ok: false,
              reason: outcome.reason === "no-selection" ? "no-selection" : "figma-error",
              detail:
                outcome.reason === "no-selection"
                  ? "Select something to simulate first."
                  : `That selection has ${outcome.count} layers, too many to copy four times without stalling Figma.`,
            });
            return;
          }
          reply({ id: msg.id, ok: true, type: "simulation-rendered", payload: { created: outcome.created } });
          return;
        }

        case "insert-mockup": {
          const r = insertMockup(msg.svg, msg.frameName, msg.nodeEstimate);
          figma.commitUndo();
          reply({ id: msg.id, ok: true, type: "mockup-inserted", payload: r });
          break;
        }
        case "store-get": {
          const raw = await figma.clientStorage.getAsync(STORE_KEY);
          reply({
            id: msg.id,
            ok: true,
            type: "store",
            payload: raw && typeof raw === "object" ? (raw as Record<string, string>) : {},
          });
          return;
        }

        case "store-set": {
          try {
            const raw = (await figma.clientStorage.getAsync(STORE_KEY)) as Record<string, string> | undefined;
            const next = { ...(raw && typeof raw === "object" ? raw : {}), [msg.key]: msg.value };
            await figma.clientStorage.setAsync(STORE_KEY, next);
            // Read back. A write that reports success and does not persist is
            // how a licence verifies in the panel and fails where it matters.
            const check = (await figma.clientStorage.getAsync(STORE_KEY)) as Record<string, string> | undefined;
            if (!check || check[msg.key] !== msg.value) {
              reply({
                id: msg.id,
                ok: false,
                reason: "storage-unavailable",
                detail: "Figma accepted the write but did not store it, so this will not be remembered.",
              });
              return;
            }
            reply({ id: msg.id, ok: true, type: "stored" });
          } catch (e) {
            reply({
              id: msg.id,
              ok: false,
              reason: "storage-unavailable",
              detail: e instanceof Error ? e.message : String(e),
            });
          }
          return;
        }

        default: {
          const unknown = msg as Request;
          reply({ id: unknown.id, ok: false, reason: "figma-error", detail: `Unhandled request: ${unknown.type}` });
        }
      }
    } catch (e) {
      reply({
        id: (msg as Request).id,
        ok: false,
        reason: "figma-error",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  };

  // Drift is only meaningful against what the plugin last wrote; warm it so the
  // first write does not have to round-trip.
  void readCurrentRecord();
}
