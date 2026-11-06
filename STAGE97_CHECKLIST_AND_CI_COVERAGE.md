# Stage 97 — checklist null guard and CI coverage

- Simplify reconciliation election checks using null-safe optional chaining. Missing reconciliation must never mark elections or arithmetic reviewed.
- Add Jest regression for absent reconciliation; filing authorization remains blocked.
- Trigger NextGen validation on React component edits as well as tax modules, preventing unvalidated UI-only changes.
- Extend Stage 77 workflow safeguards to require this trigger.
- Keep React build CI=false temporarily; strict CI=true will be restored only after warning-free build is verified.
- No tax calculation or filing authorization changes. Non-filing preview only.
