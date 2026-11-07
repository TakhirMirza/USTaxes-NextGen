# Stage 125 — Invalidate W-2 review acknowledgement on any source change

- The Stage 124 acknowledgement signature previously included only flagged W-2 groups. A change to an unrelated W-2 could leave the acknowledgement intact while changing Form 1040 totals.
- The signature now includes every W-2 document, their order, all input strings, flagged groups, and the selected filing status.
- Any source edit, addition, removal, reordering, or filing status change invalidates the prior acknowledgement when potential repeated W-2 entries remain.
- Five regression cases cover unflagged amount/employer edits, filing-status change, reordering, and unchanged inputs.
- No automatic duplicate removal, storage, submission, or filing readiness is introduced.
