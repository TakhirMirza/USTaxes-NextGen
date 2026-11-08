# Phase 46 — Federal Return Data Model & Cross-Form Integration

This package adds a read-only cross-form dependency graph beneath the Phase 45 Form 1040 mapping component.

## Includes
- Explicit document nodes for W-2, 1099-INT, Schedule C, Schedule 1, Schedule 2, Schedule 3, and Form 1040.
- Traceable source-to-line links, unknown/unimplemented handling, duplicate-edge detection, and unsupported-year warning.
- Nine deterministic regression fixtures and downloadable CSV.
- Non-posting and non-filing safeguards.

## Install
From the project root, after updating `main`, unzip the archive, then run `bash INSTALL_PHASE46.command`.

## Limits
This is a diagnostic model only. It does not parse actual source documents, calculate statutory tax, validate official IRS rules, generate returns, or permit filing. Use fictional test information only.

## Safety
The installer stages only six Phase 46 files and stops on failed TypeScript or build validation. Unrelated local changes are not staged or deleted.
