/**
 * Post registry. One entry per post, newest first.
 *
 * Deliberately a plain array rather than a filesystem convention: there are a
 * handful of posts, and a lookup you can read beats a glob you have to trace.
 */
import type { ComponentType } from "react";
import PaletteContrastBenchmark from "./PaletteContrastBenchmark";

export interface Post {
  slug: string;
  title: string;
  /** Shown on the index and in the post header. ISO date. */
  date: string;
  /** One or two sentences. Index card copy, not a teaser. */
  summary: string;
  Component: ComponentType;
}

export const POSTS: Post[] = [
  {
    slug: "palette-contrast-benchmark",
    title: "The palette that fails worst on white is the best on dark",
    date: "2026-08-12",
    summary:
      "Five default chart palettes measured against the 3:1 non-text contrast floor. Four of five fail on white, and the ranking nearly inverts when you change the background.",
    Component: PaletteContrastBenchmark,
  },
];

export function findPost(slug: string | undefined): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function formatPostDate(iso: string): string {
  // Fixed locale so the date does not shift between the server-rendered
  // string in the index and whatever the reader's machine prefers.
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
