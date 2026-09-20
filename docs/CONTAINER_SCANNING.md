# Container vulnerability management example

This repo ships two ways to containerise the same (deliberately vulnerable) app, plus a
pipeline that builds both, produces an SBOM for each, scans them, and reports the
difference. It mirrors the workflow Chainguard and similar vendors promote: measure the
image, attribute every CVE to either the *base image* or *your own code*, then shrink the
base until what is left is only what you own.

```
Dockerfile           node:18.13.0 (Debian 11)              -> goof:baseline
Dockerfile.hardened  cgr.dev/chainguard/node (Wolfi)       -> goof:hardened

docker build ──> syft (SBOM: SPDX + CycloneDX) ──> grype (+ trivy) ──> report.md / SARIF
```

## Run it

Requires `docker`, `jq`, [`syft`](https://github.com/anchore/syft), [`grype`](https://github.com/anchore/grype)
and optionally [`trivy`](https://github.com/aquasecurity/trivy).

```sh
scripts/container-scan.sh                       # build + scan both images
scripts/container-scan.sh --no-build            # reuse existing images
scripts/container-scan.sh node:18.13.0 python:3 # scan any image(s)
FAIL_ON=critical scripts/container-scan.sh --no-build goof:hardened   # policy gate, exit 1 on match
```

Everything lands in `scan-results/` (git-ignored):

| File | What it is |
|---|---|
| `report.md` | Comparison table + top fixable findings per image |
| `summary.json` | Machine-readable per-image counts (size, packages, vulns by severity/origin) |
| `<image>.sbom.spdx.json`, `<image>.sbom.cdx.json` | SBOMs (SPDX 2.3, CycloneDX 1.6) |
| `<image>.grype.json` / `.sarif` / `.txt` | grype results; SARIF is what CI uploads to the Security tab |
| `<image>.trivy.json` | trivy results, for a second-opinion count |

## Example result

From a run on 2026-09-20 (grype db of that day; numbers drift as new CVEs are published):

| Image | Base OS | Size | Packages (os / npm) | Total | Critical | High | Fixable | In OS pkgs | In npm pkgs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `goof:baseline` | Debian 11 (bullseye) | 516 MB | 1823 (409 / 1130) | **5615** | 329 | 1682 | 3574 | 5339 | 223 |
| `goof:hardened` | Wolfi | 78 MB | 912 (28 / 884) | **255** | 35 | 120 | 247 | 3 | 252 |

Reading it:

- 95% of the baseline's findings (5339 / 5615) come from the Debian layer: `git`, `curl`,
  `openssh-client`, `perl`, build toolchains... none of which the app uses at runtime.
  Swapping the base image removes them without touching application code.
- The hardened image still reports ~250 findings, and **all of them are in npm packages**
  (`ejs`, `handlebars`, `lodash`, `mongoose`, `typeorm`, ...). That is the app's own
  vulnerable-by-design dependency set, and it is the part only the application team can fix.
  This is the useful signal a base-image swap surfaces: the noise is gone, what remains is
  actionable and owned.
- The remaining 3 OS findings are `glibc` CVEs with no upstream fix yet; Chainguard
  typically rebuilds within days of a fix landing, so re-pulling the base is the remediation.
- Runtime image is 6.6x smaller, runs as non-root `node`, and has no shell or package
  manager, which shrinks the exploit surface independent of CVE counts.

## What `Dockerfile.hardened` changes

- Multi-stage: `npm ci --omit=dev --ignore-scripts` runs on `chainguard/node:latest-dev`
  (has npm + shell); only `/app` is copied into the distroless `chainguard/node:latest`.
- Explicit `COPY` of source directories instead of `COPY . .`, so the host `node_modules`,
  `exploits/`, tests, and `.git` never enter the image.
- Non-root user, `ENTRYPOINT ["node", "app.js"]`, `NODE_OPTIONS=--openssl-legacy-provider`
  kept because the legacy crypto in this app still needs it.

## CI: `.github/workflows/container-scan.yml`

Runs on push, PR, manual dispatch, and weekly (a rescan of an unchanged image is how you
catch newly published CVEs):

1. build both images, generate SBOMs, scan (`scripts/container-scan.sh`)
2. append `report.md` to the job summary
3. upload SBOMs + results as a workflow artifact
4. upload the **hardened** image's grype SARIF to GitHub code scanning
   (category `container-goof-hardened`), so findings show in the Security tab
5. policy gate: `FAIL_ON=critical` against `goof:hardened`. It is `continue-on-error`
   here because goof is vulnerable on purpose; in a real repo drop that line so critical
   findings block the merge.

## Where remediation fits

The scanner output is the input to the fix loop. `goof_hardened.grype.json` lists each
finding with `artifact.name`, `artifact.version`, and `vulnerability.fix.versions`, which is
enough to hand to Devin (or a human) as "upgrade `handlebars` 4.0.11 -> 4.7.7 and make the
templates still render". A failed gate step, a new SARIF alert, or the weekly rescan can
trigger that session so remediation starts the moment a CVE lands rather than at the next
audit.
