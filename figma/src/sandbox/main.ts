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

  const open: OpenMessage = { type: "open", tab: TAB_FOR_COMMAND[figma.command] ?? "generate" };
  figma.ui.postMessage(open);

  // Auditing should follow the canvas, not a button. Selecting a different
  // layer is the request.
  figma.on("selectionchange", () => {
    const push: SelectionPush = { type: "selection-changed", payload: readSelection() };
    figma.ui.postMessage(push);
  });

  figma.ui.onmessage = async (msg: Request) => {
    try {
      switch (msg.type) {
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
          const payload = await applySpecs(msg.specs, msg.confirmedOverwrites);
          reply({ id: msg.id, ok: true, type: "variables-written", payload });
          return;
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
          const raw = (await figma.clientStorage.getAsync(STORE_KEY)) as Record<string, string> | undefined;
          const next = { ...(raw && typeof raw === "object" ? raw : {}), [msg.key]: msg.value };
          await figma.clientStorage.setAsync(STORE_KEY, next);
          reply({ id: msg.id, ok: true, type: "stored" });
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
