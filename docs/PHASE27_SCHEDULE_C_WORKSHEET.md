# Phase 27 — Schedule C draft entry (2025)

Adds a user-editable Schedule C worksheet under Income with receipts, COGS and common expense categories, cents-safe arithmetic, validation and CSV export. Persists only to browser sessionStorage; use fictional examples. The preliminary net explicitly excludes meals because deductibility limitations are not implemented. It is NOT transferred to Schedule 1, Form 1040, or Schedule SE. No tax return is authorized for filing. Future phases must implement verified IRS tax-year rules, complete expense treatment, business-specific questions, and reconciliation tests before mapping.

Installation: unzip at repository root after a clean git pull; npm run build; commit the four files and push. No dependency changes.
