/**
 * The plugin's own chart chrome. Deliberately NOT copied from src/index.css,
 * which is proprietary and ships no CSS. Audited in defaults.test.ts so an edit
 * here cannot quietly go illegible.
 */
import { fromCss, type ColorRecord } from "@engine/palette/distance";

export interface ChromeTokens {
  surface: ColorRecord;
  grid: ColorRecord;
  axis: ColorRecord;
  label: ColorRecord;
  seqLow: ColorRecord;
  seqHigh: ColorRecord;
  divNeg: ColorRecord;
  divMid: ColorRecord;
  divPos: ColorRecord;
}

export const DEFAULT_TOKENS: { light: ChromeTokens; dark: ChromeTokens } = {
  light: {
    surface: fromCss("#ffffff"),
    grid: fromCss("#8e949b"),
    axis: fromCss("#6b7178"),
    label: fromCss("#31363b"),
    seqLow: fromCss("#e8eef7"),
    seqHigh: fromCss("#1b3f6b"),
    divNeg: fromCss("#8a3324"),
    divMid: fromCss("#f2efe9"),
    divPos: fromCss("#1f4d3f"),
  },
  dark: {
    surface: fromCss("#14171a"),
    grid: fromCss("#767d84"),
    axis: fromCss("#8b949c"),
    label: fromCss("#e6e9ec"),
    seqLow: fromCss("#16233a"),
    seqHigh: fromCss("#a8c6ea"),
    divNeg: fromCss("#e08b7c"),
    divMid: fromCss("#2a2d31"),
    divPos: fromCss("#7fc0aa"),
  },
};
