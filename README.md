# Augmenta Tools

The static homepage for [tools.augmenta.tech](https://tools.augmenta.tech/), with a separate [beta site](https://beta.tools.augmenta.tech/).

The approved hero and four illustrated cards originate in commit `cf511e6`. Official PNG branding is stored locally; colors, typography and components follow [Factory Audit](https://tools.augmenta.tech/factory-audit/) and the [Augmenta changelog](https://augmenta.tech/app/changelog). There is no browser JavaScript, tracking, form submission or build framework.

## Architecture and ownership

This repository owns only the homepage and its dedicated static assets. Independently maintained tools retain their source repositories and deployment processes.

| Card | Destination |
| --- | --- |
| Audit tool | https://tools.augmenta.tech/audit |
| Augmenta Web Receiver | https://augmenta-tech.github.io/Augmenta-ThreeJS-example/ |
| Augmenta Three.js Example | https://augmenta-tech.github.io/Augmenta-ThreeJS-example/ |
| Augmenta MCP Server | Coming Soon; no link |

[Factory Audit](https://tools.augmenta.tech/factory-audit/) is maintained by `Augmenta-tech/augmenta-server-deployment`. A hosting-managed directory link preserves its existing deployment destination. The homepage uploader neither follows nor modifies that link. Server routing is managed separately from homepage releases; changes must preserve existing application rules.

```text
index.html                  Approved homepage
augmenta-tools-assets/      Official logo/favicon PNGs and stylesheet
scripts/                    Release, bundle, FTPS and HTTPS checks
test/                       Website, release, workflow and upload-boundary tests
.github/workflows/          Commit/PR validation and tag-driven deployment
docs/hosting.md             Hosting configuration procedure
dist/                       Generated allowlisted release (not committed)
```

## Local development

Use Node.js 24 and npm:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. The local build uses an unpublished `0.0.0b1` marker and does not connect to hosting.

## CI and releases

[Validate and deploy homepage](https://github.com/Augmenta-tech/Augmenta-tools/actions/workflows/validate-and-deploy.yml) validates every branch push and pull request without deployment credentials. All tag pushes are examined; only exact release tags are accepted:

| Tag | Environment | Website |
| --- | --- | --- |
| `x.y.zbN`, e.g. `1.0.0b1` | `beta` | https://beta.tools.augmenta.tech/ |
| `x.y.z`, e.g. `1.0.0` | `stable` | https://tools.augmenta.tech/ |

No `v` prefix or hyphen is used, following `augmenta-designer`. Ordinary commits and PRs never deploy. Actions are pinned to reviewed commits and dependencies are locked. Validation includes automated tests and a runtime dependency vulnerability audit.

1. Commit and validate the candidate on `main`.
2. Push a beta version tag on that commit. CI uploads only five allowlisted homepage files, then verifies each public file's checksum over HTTPS.
3. Review beta on desktop/mobile, card destinations and independent tool availability.
4. Obtain explicit production publication approval. Tag the **same commit** with the matching stable version and approve the protected `stable` environment job.

Stable also checks that beta has the same commit and file checksums, then re-verifies beta over HTTPS before uploading. New content must pass through another beta. Never move an existing version tag; use another beta number for corrections. `augmenta-tools-release.json` records version, channel, commit and file checksums.

## Secure deployment scope

Deployment uses explicit FTPS on port 21, TLS 1.2 or newer, certificate/hostname validation and encrypted control **and data** connections, with no insecure fallback. FTP diagnostic logging is disabled; server replies and credentials are not printed in public logs.

Each GitHub environment uses its own FTP account confined to that website's document root:

| Setting | Storage | Purpose |
| --- | --- | --- |
| `FTP_PASSWORD` | Environment secret | Corresponding account password |
| `FTP_HOST` | Environment variable | Certificate-valid hosting hostname |
| `FTP_USER` | Environment variable | Dedicated restricted account |
| `FTP_REMOTE_DIR` | Environment variable | `/`, relative to the restricted account |
| `SITE_URL` | Environment variable | Exact beta/production HTTPS origin, no trailing slash |

Never use the hosting master account or an independent application's account. `stable` requires owner approval with administrator bypass disabled. Environment tag globs are coarse filters; CI performs exact classification.

The allowlist contains **exact filenames**, not extensions: `index.html`, the stylesheet, official 96px logo PNG, 32px favicon PNG and release marker. PNG/ICO additions require allowlist and test changes. Local links, extra bundle files, traversal and remote links at upload destinations are rejected before uploads. Validated file buffers upload assets first, index next, marker last.

There is no mirroring, remote deletion, recursive upload or cleanup. `.htaccess`, `.well-known`, `audit/`, `factory-audit/`, repository metadata, dependencies and tests are never uploaded. A failed transfer can leave a partial homepage update; the workflow reports failure and must be rerun or superseded by a corrected beta. It never attempts destructive rollback.

Keep accounts confined and do not edit hosting-managed links during releases. Tests verify the upload contract with simulated directory listings; real authentication and public delivery are verified by the release workflow.

## Branding provenance

Local PNGs are exact copies of the official [96px logo](https://augmenta.tech/pleiades/releases/augmenta-logo-96.png) and [32px favicon](https://augmenta.tech/pleiades/releases/augmenta-favicon-32.png). The approved SVG card illustrations remain intact. Inter is used when available, with the same system-font fallbacks as the reference pages; no external font request is required.
