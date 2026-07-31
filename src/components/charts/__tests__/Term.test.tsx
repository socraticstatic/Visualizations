import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Term, OPEN_REFERENCE_EVENT } from "../Term";
import { ReferenceDrawer } from "../ReferenceDrawer";

describe("Term", () => {
  it("renders plain children when the id does not resolve", () => {
    // A typo must degrade to ordinary text, never throw mid-render.
    render(<Term id="not-a-real-term">ΔE</Term>);
    expect(screen.getByText("ΔE")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes the definition to screen readers without a click", () => {
    render(<Term id="OKLab">OKLab</Term>);
    expect(screen.getByRole("button", { name: /OKLab: .*color space/i })).toBeInTheDocument();
  });

  it("keeps the popover closed until asked", () => {
    render(<Term id="OKLab">OKLab</Term>);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the short definition on click", () => {
    render(<Term id="OKLab">OKLab</Term>);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("tooltip")).toHaveTextContent(/color space/i);
  });

  it("closes on Escape", () => {
    render(<Term id="OKLab">OKLab</Term>);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("asks the page to open the drawer at its own entry", () => {
    const spy = vi.fn();
    window.addEventListener(OPEN_REFERENCE_EVENT, spy);
    render(<Term id="OKLab">OKLab</Term>);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: /full definition/i }));
    expect(spy).toHaveBeenCalled();
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toBe("OKLab");
    window.removeEventListener(OPEN_REFERENCE_EVENT, spy);
  });
});

describe("ReferenceDrawer", () => {
  it("renders nothing while closed", () => {
    render(<ReferenceDrawer open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists every glossary entry when open", () => {
    render(<ReferenceDrawer open onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("OKLab")).toBeInTheDocument();
    expect(screen.getByText("Decal")).toBeInTheDocument();
  });
});
