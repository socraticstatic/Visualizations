import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SystemAudit } from "../SystemAudit";
import { seedTokens } from "@/test/seedTokens";

seedTokens();

/**
 * SystemAudit merges AutoAuditSummary (the ~12 permutations reachable for the
 * current kind and theme) into FullPermutationAudit (all 374). The 12 were a
 * strict subset, so the two panels stacked directly on top of each other were
 * reporting the same thing at two zoom levels.
 *
 * The sweep auto-runs on mount and is chunked across frames, so every
 * assertion about results has to wait for it to settle.
 */
const props = { hasManualOverrides: false, kind: "line" as const, theme: "light" as const };

const panel = () => screen.getByLabelText(/permutation accessibility audit/i);
const SWEEP_TIMEOUT = 20_000;

/** Read the "N ... permutations" count out of the settled summary line. */
async function settledCount(): Promise<number> {
  let count = 0;
  await waitFor(
    () => {
      // The kind-scope label itself contains "·" ("Line · light theme"), so
      // this must not exclude it.
      const m = panel().textContent?.match(/(\d+)[\s\S]{0,40}?permutations?/i);
      expect(m).toBeTruthy();
      count = Number(m![1]);
      expect(count).toBeGreaterThan(0);
    },
    { timeout: SWEEP_TIMEOUT }
  );
  return count;
}

describe("SystemAudit", () => {
  it("defaults to the current chart type", () => {
    render(<SystemAudit {...props} />);
    expect(screen.getByRole("radio", { name: /this chart type/i })).toBeChecked();
  });

  it("offers both scopes", () => {
    render(<SystemAudit {...props} />);
    expect(screen.getByRole("radio", { name: /everything/i })).toBeInTheDocument();
  });

  it("switches scope on click", () => {
    render(<SystemAudit {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: /everything/i }));
    expect(screen.getByRole("radio", { name: /everything/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /this chart type/i })).not.toBeChecked();
  });

  it("names the subset so a narrow pass cannot read as a broad one", async () => {
    render(<SystemAudit {...props} />);
    await waitFor(() => expect(panel()).toHaveTextContent(/line · light theme/i), {
      timeout: SWEEP_TIMEOUT,
    });
  });

  it("labels the full scope as theme × kind × N", async () => {
    render(<SystemAudit {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: /everything/i }));
    await waitFor(() => expect(panel()).toHaveTextContent(/theme × kind × N/i), {
      timeout: SWEEP_TIMEOUT,
    });
  });

  it("actually narrows the sweep, not just the label", async () => {
    // The whole point of the merge: "this chart type" must be a strict subset.
    // A label change with an unfiltered plan behind it would be a lie.
    render(<SystemAudit {...props} />);
    const narrow = await settledCount();

    fireEvent.click(screen.getByRole("radio", { name: /everything/i }));
    await waitFor(() => expect(panel()).toHaveTextContent(/theme × kind × N/i), {
      timeout: SWEEP_TIMEOUT,
    });
    const broad = await settledCount();

    expect(broad).toBeGreaterThan(narrow);
  }, 40_000);
});
