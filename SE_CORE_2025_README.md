# 2025 Schedule SE calculation core — integration checkpoint

This package upgrades the existing Schedule SE illustrative preview to use a separately tested calculation core.

Implemented: 2025 Social Security wage base ($176,100); 92.35% net earnings; 12.4% Social Security on earnings below the remaining wage base; 2.9% Medicare; half-SE-tax arithmetic; explicit handling of W-2 Social Security wages in the core; invalid-input and scenario gating tests.

**Not implemented or authorized:** automatic Schedule 1 / Schedule 2 / Form 1040 posting; official tax-table transcription; complete Schedule C deductions; Additional Medicare Tax; multiple businesses, optional methods, partnership income, special SE adjustments, final official rounding verification, e-file, or filing-ready returns.

Install by extracting this ZIP directly inside the repository root, preserving `src/` and `scripts/` directories. Run `bash INSTALL_2025_SE_CORE.command`. Check `git diff` before committing. The source controls from the previous package remain intact.

The test script requires `npx tsc` to be installed. The preview remains **non-posting** and cannot make the return filing-ready.
