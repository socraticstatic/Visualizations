/**
 * The plugin block's own palette.
 *
 * It sits on a dark ground inside an otherwise light page, deliberately: the
 * block should read as the product rather than as another documentation card,
 * and the ground matches the plugin's own panel and its mark.
 *
 * Audited in promoTokens.test.ts. A promotional block for a contrast tool that
 * fails contrast is not a thing worth shipping, and the first version of the
 * plugin mark failed exactly that way.
 */
import { fromCss, type ColorRecord } from "@/charts/palette/distance";

export interface PromoTokens {
  ground: ColorRecord;
  raised: ColorRecord;
  heading: ColorRecord;
  body: ColorRecord;
  quiet: ColorRecord;
  accent: ColorRecord;
  onAccent: ColorRecord;
  hairline: ColorRecord;
}

export const PROMO: PromoTokens = {
  ground: fromCss("#14171a"),
  raised: fromCss("#1d2126"),
  heading: fromCss("#f7f9fb"),
  body: fromCss("#c3ccd6"),
  quiet: fromCss("#8e9aa6"),
  accent: fromCss("#f48fe4"),
  onAccent: fromCss("#14171a"),
  hairline: fromCss("#333a42"),
};
