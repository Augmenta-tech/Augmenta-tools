# Augmenta Tools

Central entry point for [tools.augmenta.tech](https://tools.augmenta.tech/).

## Setup status

The public repository has been created. Import of the approved homepage, existing tests and workflows is pending receipt of `Augmenta-tools-ready-for-Work.zip`. No homepage release has been deployed from this repository.

The `beta` and `stable` GitHub environments have been created. Beta permits beta-style tags. Stable requires approval from the repository owner and disables administrator bypass. Environment tag filters are not exact version validators; CI must enforce the release formats described below.

Hosting configuration, deployment credentials and public HTTPS verification remain prerequisites. No CI workflows, tests or release tags have been imported yet.

## Architecture

This repository owns the tools homepage and its dedicated static assets. It links to independently maintained applications; it does not aggregate their source code or take ownership of their deployments.

| Component | Destination | Ownership |
| --- | --- | --- |
| Audit tool | https://tools.augmenta.tech/audit | Existing independent application |
| Augmenta Web Receiver | https://augmenta-tech.github.io/Augmenta-ThreeJS-example/ | Independent GitHub Pages project |
| Augmenta Three.js Example | https://augmenta-tech.github.io/Augmenta-ThreeJS-example/ | Independent GitHub Pages project |
| Augmenta MCP Server | Coming Soon — no link | Not published |
| Factory Audit | https://tools.augmenta.tech/factory-audit/ | Augmenta-tech/augmenta-server-deployment |

The approved homepage layout is a hero followed by four rectangular illustrated cards. Branding is aligned with Factory Audit and the official Augmenta changelog.

## Deployment contract

Deployment automation is pending import and verification. The required behavior is:

- Default branch: `main`.
- Commits and pull requests validate without deploying.
- Tags matching `x.y.zbN` deploy to https://beta.tools.augmenta.tech/.
- Tags matching `x.y.z` deploy to https://tools.augmenta.tech/.
- Other tags are rejected.
- Deploy through GitHub Actions using explicit FTPS with certificate verification and encrypted control and data connections.
- Separate `beta` and `stable` GitHub environments hold separate FTP credentials, with accounts restricted to their respective document roots.
- Stable publication requires verified beta and explicit production approval.

## Existing application protection

Homepage deployment must use an explicit file allowlist. It must never mirror, clean or recursively delete the server root. It must not upload into `audit/` or `factory-audit/`, modify their files, or change shared routing or `.htaccess`.

Only the homepage and its dedicated, reviewed static assets may be uploaded. PNG and ICO additions must be included in both the allowlist and its tests. Never upload credentials, repository metadata, workflows, development dependencies or test artifacts to the website.

## Credentials

Do not commit credentials. Store deployment credentials as GitHub environment secrets. Do not reuse the cPanel master account or an independently maintained tool's deployment account.
