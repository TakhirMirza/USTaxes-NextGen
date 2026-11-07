# USTaxes NextGen — GitHub Pages preview

This is a **preview of legacy tax-year features and a read-only NextGen year manager**. Tax years 2025/2026 are NOT enabled for filing. There is no e-file service.

## Publish
1. Upload this project to GitHub, including `.github/workflows/pages.yml`.
2. Repository Settings > Pages > Build and deployment > Source: **GitHub Actions**.
3. Actions > **Publish USTaxes preview to GitHub Pages** > Run workflow.
4. When jobs succeed, visit `https://<owner>.github.io/<repository>/`.
5. Test with synthetic taxpayer data only.

## Security and limitations
- GitHub Pages can be public even when the source repository is private. Never commit real taxpayer data, SSNs, W-2 documents, tokens or keys.
- Existing Redux persistence uses browser storage. Do not enter real taxpayer data into a public preview, especially on shared computers.
- The workflow runs on push to main/master as well as manually. Remove the push trigger if you prefer manual publication.
- Node 16 is used for compatibility with legacy dependencies; it is end-of-life and must be upgraded before production.
- `CI=false` avoids treating legacy warnings as fatal; it does not guarantee successful compilation.
- Full React build and browser testing have not been confirmed in this environment.

## Routing
Pages uses HashRouter (`/#/path`) to avoid deep-link 404s. Local builds retain BrowserRouter. `PUBLIC_URL` handles project-specific static paths.

## Local checks
`npm ci`
`npm run nextgen:test`
`node platform/tests/integration.js`
`REACT_APP_GITHUB_PAGES=true PUBLIC_URL=/mytaxes npm run build`
