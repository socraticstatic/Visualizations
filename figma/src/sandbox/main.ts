/**
 * The sandbox holds the figma API and nothing else. Every decision is made by
 * a pure function in ../shared and handed here as a spec to apply.
 */
type Tab = "generate" | "audit" | "simulate";

const TAB_FOR_COMMAND: Record<string, Tab> = {
  generate: "generate",
  audit: "audit",
  simulate: "simulate",
};

figma.showUI(__html__, { width: 420, height: 640, themeColors: true });
figma.ui.postMessage({ type: "open", tab: TAB_FOR_COMMAND[figma.command] ?? "generate" });

figma.ui.onmessage = (msg: unknown) => {
  // Task 8 replaces this with the real dispatcher.
  console.log("sandbox received", msg);
};
