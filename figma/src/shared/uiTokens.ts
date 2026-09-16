/**
 * Fallback chrome for the plugin panel.
 *
 * Figma's own `--figma-color-*` variables govern at runtime; these values apply
 * only when `themeColors` is unavailable. They therefore have to stand on their
 * own, and the accompanying test audits them with the same engine the plugin
 * ships, at 4.5:1 for text and 3:1 for control borders.
 *
 * They track Figma's palette closely so the panel reads as part of the host.
 * One deliberate divergence: Figma's brand blue under white 11px label text sits
 * below 4.5:1, so the fallback brand is darkened until the label passes. When
 * Figma supplies its own value that choice is Figma's, which is correct - the
 * host owns its chrome. Ours is the floor, not an override.
 */
import { fromCss, type ColorRecord } from "@engine/palette/distance";

export interface UiTokens {
  bg: ColorRecord;
  bgSecondary: ColorRecord;
  text: ColorRecord;
  textSecondary: ColorRecord;
  textOnBrand: ColorRecord;
  textDanger: ColorRecord;
  textSuccess: ColorRecord;
  textWarning: ColorRecord;
  border: ColorRecord;
  borderStrong: ColorRecord;
  brand: ColorRecord;
}

export const UI_FALLBACK: { light: UiTokens; dark: UiTokens } = {
  light: {
    bg: fromCss("#ffffff"),
    bgSecondary: fromCss("#f5f5f5"),
    text: fromCss("#1e1e1e"),
    textSecondary: fromCss("#5c5c5c"),
    textOnBrand: fromCss("#ffffff"),
    textDanger: fromCss("#b3241a"),
    textSuccess: fromCss("#00734d"),
    textWarning: fromCss("#8a5300"),
    border: fromCss("#e6e6e6"),
    borderStrong: fromCss("#767676"),
    brand: fromCss("#0a66c2"),
  },
  dark: {
    bg: fromCss("#2c2c2c"),
    bgSecondary: fromCss("#383838"),
    text: fromCss("#ffffff"),
    textSecondary: fromCss("#bdbdbd"),
    textOnBrand: fromCss("#ffffff"),
    textDanger: fromCss("#ff9c94"),
    textSuccess: fromCss("#6bd6a4"),
    textWarning: fromCss("#e8bf65"),
    border: fromCss("#444444"),
    borderStrong: fromCss("#8c8c8c"),
    brand: fromCss("#2f6fb0"),
  },
};

/** Semantic name to the Figma variable that governs it at runtime. */
export const FIGMA_VAR: Record<keyof UiTokens, string> = {
  bg: "--figma-color-bg",
  bgSecondary: "--figma-color-bg-secondary",
  text: "--figma-color-text",
  textSecondary: "--figma-color-text-secondary",
  textOnBrand: "--figma-color-text-onbrand",
  textDanger: "--figma-color-text-danger",
  textSuccess: "--figma-color-text-success",
  textWarning: "--figma-color-text-warning",
  border: "--figma-color-border",
  borderStrong: "--figma-color-border-strong",
  brand: "--figma-color-bg-brand",
};
