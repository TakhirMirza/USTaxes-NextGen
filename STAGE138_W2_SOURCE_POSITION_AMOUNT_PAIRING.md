# Stage 138 — W-2 source-position amount pairing

Informational difference alerts now pair each one-based W-2 document position directly with its corresponding Box 1 or Box 2 amount. Source order and cent precision are preserved. Mismatched or invalid position/value arrays are withheld rather than silently misaligned. This does not change source inputs, duplicate acknowledgement, employer grouping, reconciliation, or restricted Form 1040 mapping. Four regression tests cover pairing, cents, fail-closed behavior, and the existing acknowledgement gate.

NOT FILING READY. GitHub Actions verification required after publishing.
