# GitHub Pages blank screen hotfix

The GitHub Pages workflow previously built with `PUBLIC_URL: /USTaxes-NextGen-Preview`, but the deployed repository URL is `/USTaxes-NextGen/`. CRA used that incorrect prefix for generated JS and CSS asset URLs, so the page could load HTML but fail to load the application bundles.

The Pages workflow now sets `PUBLIC_URL: /USTaxes-NextGen`, matching `package.json` homepage and the validation workflow. HashRouter remains enabled with `REACT_APP_GITHUB_PAGES=true`.

After deployment, verify in browser DevTools Network that `static/js/...` and `static/css/...` are loaded from `/USTaxes-NextGen/`, not `/USTaxes-NextGen-Preview/`. This fix does not change tax calculations.
