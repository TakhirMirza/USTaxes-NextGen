# Security and privacy

## Design

USTaxes NextGen is a static web application. It has no back end: no server code, no accounts, no
database, no analytics. Tax data is entered, calculated, stored and turned into PDFs inside the
browser.

| Data | Where it is | Protection |
|---|---|---|
| Returns, preparer profile | Browser `localStorage` on the user's device | Optional AES-256-GCM encryption with a password (PBKDF2-SHA256, 600,000 iterations, random 16-byte salt, random 12-byte IV per value). The key exists only in memory while unlocked. |
| Backups | Files the user downloads | Optional AES-256-GCM encryption with a password (same scheme). |
| IRS forms (PDF) | Files the user downloads | Not encrypted; the user keeps them. |
| App files and blank IRS forms | Service worker cache | Public files only, no personal data. |

The published build includes a Content Security Policy (`default-src 'self'`, `connect-src 'self'`,
`form-action 'none'`, no inline scripts) and `referrer: no-referrer`. The only network requests are
for the app's own files and blank forms on the same site.

With password protection on, the app locks after 5–60 minutes without activity (15 by default) and
on demand. Locking reloads the page, which drops the key and every decrypted value from memory. A
forgotten password cannot be recovered; the user can erase the data and restore a backup.

## What it does not protect against

- Someone using the device while the app is unlocked.
- Malware on the device, or browser extensions permitted to read pages.
- Downloaded PDFs and unencrypted backups.
- The hosting provider (GitHub Pages) seeing that a device loaded the site, as with any website.

## Reporting a problem

Please open a private security advisory on GitHub (Security → Report a vulnerability) rather than a
public issue.
