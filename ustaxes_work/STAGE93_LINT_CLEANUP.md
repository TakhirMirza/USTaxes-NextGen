# Stage 93 — Initial ESLint cleanup (non-filing preview)

Removed five unused imports/variables from legacy React components without changing runtime behavior.

Files: `src/components/GettingStarted.tsx`, `src/components/ResponsiveDrawer.tsx`, `src/components/debug.tsx`.

**CI policy remains unchanged:** React build uses `CI=false`, Jest uses `CI=true`. Do not restore strict React CI until all remaining warnings have been fixed and the full build has been verified. The Stage 77 safeguard and Stage 83 release gate remain enabled.

No tax computation, filing authorization, or posting behavior changed.
