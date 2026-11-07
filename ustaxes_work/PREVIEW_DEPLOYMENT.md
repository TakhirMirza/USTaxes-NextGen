# USTaxes NextGen 2.0 — Separate preview deployment

This is a **separate full-source copy** of the 2.0 Tax Engine 2025 branch intended for a new public repository named `USTaxes-NextGen-Preview`. It does not update the original `USTaxes-NextGen` repository or its `main` branch.

## First deployment

1. In GitHub create a **public, empty** repository `USTaxes-NextGen-Preview` under account `TakhirMirza`. Do not initialize it with README or license.
2. Download this ZIP and extract it to `~/Downloads/USTaxes-NextGen-Preview` (files must be at the project root).
3. Run:

```bash
cd ~/Downloads/USTaxes-NextGen-Preview
git init
git branch -M main
git add .
git commit -m "NextGen 2.0 preview - Foundation and Tax Engine 2025"
git remote add origin git@github.com:TakhirMirza/USTaxes-NextGen-Preview.git
git push -u origin main
```

If your SSH host alias is `github-takhir` rather than `github.com`, use `git@github-takhir:TakhirMirza/USTaxes-NextGen-Preview.git` in the remote command.

4. GitHub repository > Settings > Pages > Build and deployment > Source: **GitHub Actions**.
5. Open Actions > **Deploy USTaxes NextGen 2.0 Preview**. If the workflow did not run, choose **Run workflow**.
6. After the deploy job succeeds, visit `https://takhirmirza.github.io/USTaxes-NextGen-Preview/`.

## Future releases

Extract the next full release ZIP to a temporary directory and `rsync -av --exclude=.git --exclude=node_modules ...` into this preview clone, commit and push `main`. Continue separate feature development in the original repository's `nextgen-2.0` branch. Never merge into the original `main` just to update preview.

## Important limitations

The preview is a public demonstration, **not a secure tax preparation or filing service**. Do not enter real SSNs, addresses, W-2 data or financial information. Restricted Form 1040 mapping is not a verified return. No e-filing or production tax output is authorized.
