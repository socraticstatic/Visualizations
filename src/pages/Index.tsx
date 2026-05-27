import { Link } from "react-router-dom";

const Index = () => {
  return (
    <main className="min-h-dvh bg-background text-foreground flex items-center justify-center p-8">
      <div className="max-w-2xl space-y-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Micah's Chart System for Sane and Useful Color Strategies</h1>
        <p className="text-foreground/90">
          A token-driven, math-backed palette system for ECharts dashboards. Color is paired 1:1 with dash,
          decal, and shape so meaning survives colorblindness, grayscale, and small marks.
        </p>
        <Link
          to="/charts"
          className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Open the demo &amp; QA harness →
        </Link>
        <p className="text-xs text-foreground/80">See README.md and CHANGELOG.md for details.</p>
      </div>
    </main>
  );
};

export default Index;
