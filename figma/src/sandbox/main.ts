/**
 * The sandbox holds the figma API and nothing else. Every decision is made by a
 * pure function in ../shared and handed here as a spec to apply.
 *
 * Two entry points: the Design panel, and Dev Mode codegen. Codegen plugins do
 * not show UI, so the branch is on figma.mode rather than editorType - a plugin
 * can be opened in Dev Mode's plugin surface as well as its codegen surface.
 */
import { registerCodegen } from "./codegen";

type Tab = "generate" | "audit" | "simulate";

const TAB_FOR_COMMAND: Record<string, Tab> = {
  generate: "generate",
  audit: "audit",
  simulate: "simulate",
};

if (figma.mode === "codegen") {
  registerCodegen();
} else {
  figma.showUI(__html__, { width: 420, height: 720, themeColors: true });
  figma.ui.postMessage({ type: "open", tab: TAB_FOR_COMMAND[figma.command] ?? "generate" });

  figma.ui.onmessage = (msg: unknown) => {
    // Variable writing lands with the sandbox dispatcher.
    console.log("sandbox received", msg);
  };
}
