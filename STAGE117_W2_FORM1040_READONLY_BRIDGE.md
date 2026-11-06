# Stage 117 — read-only W-2 to restricted Form 1040 bridge

Added `bridgeLiveW2ToRestricted1040_2025` to map validated, single-W-2 preview data to the existing restricted draft. The bridge requires an explicit Box 2 value (including an explicitly entered zero), never silently assumes zero withholding, and does not calculate a refund or tax due. The UI now displays mapped 1040 lines 1a, 25a, and the limited known-source 25d with explicit scope warnings. Tests cover cents, missing Box 2, invalid amounts, and the independence of line 16 from withholding changes.

This is not a completed Form 1040, a source-document verification, or a filing-ready return. CI and GitHub Pages must be checked after upload.
