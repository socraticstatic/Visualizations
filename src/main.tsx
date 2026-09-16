import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root")!;

/**
 * scripts/prerender.mjs writes real HTML into #root for the routes it can
 * render, and marks whether that markup is safe to hydrate.
 *
 * It is not always safe. The builder route ships a written summary rather than
 * the live builder, which is different markup on purpose. And any route that
 * runs the palette solver renders different numbers under Node than under the
 * browser, because Math.cbrt and Math.exp disagree between the two - see the
 * `hydrate` field in src/seo/site.ts. Those routes are replaced rather than
 * hydrated, which costs one render and avoids a thrown hydration error.
 */
if (root.dataset.hydrate === "yes" && root.firstChild) {
  hydrateRoot(root, <App />);
} else {
  createRoot(root).render(<App />);
}
