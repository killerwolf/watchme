# Git Workflow and GitHub Releases

This document defines the mandatory Git branching and GitHub Releases strategy
for WatchMe. Developers and AI agents must follow these rules for all changes,
versioning, tags, and releases.

## Branching Structure

| Branch | Purpose | Rules |
| --- | --- | --- |
| `main` | Stable production branch | Contains only thoroughly tested code ready for the general public. |
| `develop` | Central development branch | Integrates validated new features before stabilization. |
| `release/*` | Version stabilization branch | Ephemeral branch cut from `develop` to stabilize a version, for example `release/v1.2.0`. |
| `feature/*` | Feature development branch | Temporary branch for one feature or focused change; merge into `develop` through a Pull Request. |

### Branching Rules

- Create `feature/*` branches from `develop`.
- Merge feature work into `develop` only through a Pull Request.
- Cut `release/*` branches from `develop` only when the feature set for a
  version is complete.
- Use `release/*` only for stabilization, testing, documentation, and
  release-blocking fixes. Do not add new features there.
- Merge a stabilized `release/*` branch into `main` for production and back
  into `develop` so fixes are not lost.
- Keep `main` production-ready at all times. Do not develop directly on it.
- Do not delete `main` or `develop`. Ephemeral `release/*` and temporary
  `feature/*` branches may be deleted after their Pull Requests are merged.

## Naming and Versioning Strategy

WatchMe uses [Semantic Versioning](https://semver.org/) and Git tags prefixed
with `v`.

| Source branch | Lifecycle stage | Required tag format | Example |
| --- | --- | --- | --- |
| `develop` | Unstable / work in progress | `v[NextVersion]-dev.[Date]` or `v[NextVersion]-alpha.[Number]` | `v1.2.0-dev.20260910` or `v1.2.0-alpha.1` |
| `release/*` | Stabilization / testing | `v[Major].[Minor].[Patch]-rc.[Number]` | `v1.2.0-rc.1` |
| `main` | Production / stable | `v[Major].[Minor].[Patch]` | `v1.2.0` |

Tagging `develop` is **optional**. Cut a `-dev` or `-alpha` build when you want
or need one — not on a schedule, and not to satisfy this document. The format
above is what is required *when you choose to tag*; it is not a duty to tag
every stage. The `-rc` gate before `main` is the one stage that is expected,
because that is where a build is tested before it is promoted.

### Tagging Rules

- Tags must point to commits on the branch named by their lifecycle stage.
- Never use a clean production tag such as `v1.2.0` for a commit from
  `develop` or `release/*`.
- Never use `-dev`, `-alpha`, or `-rc` tags for production commits on `main`.
- Use an ISO calendar date in `YYYYMMDD` form for `-dev` tags.
- Increment prerelease numbers monotonically for `-alpha.N` and `-rc.N`.
- Do not move, overwrite, or force-push a published tag. Create a new
  prerelease number or patch version instead.
- Before tagging, update the application version and user-facing changelog as
  required by the project release checklist.

## GitHub Releases Mapping

Every pushed version tag must have a corresponding GitHub Release with the
following publication setting:

| Tag pattern | GitHub Release setting | Intended audience |
| --- | --- | --- |
| `vX.Y.Z-dev.DATE` | **Set as a pre-release** enabled | Development testers |
| `vX.Y.Z-alpha.N` | **Set as a pre-release** enabled | Early adopters and validation |
| `vX.Y.Z-rc.N` | **Set as a pre-release** enabled | Release-candidate testers |
| `vX.Y.Z` | **Set as the latest release** enabled | General users |

The release workflow creates the release and sets the prerelease flag itself on
tag push, so this table describes what CI already does rather than a chore to
perform by hand. A pushed tag carrying no release means the workflow did not
complete for it — which is a CI question, not a bookkeeping gap to backfill
after the fact.

Agents must verify that the GitHub Release setting matches the tag before
reporting a release as complete. Development and release-candidate builds must
not be presented as the latest stable release.

## Version Lifecycle

```text
feature/*
    |
    | Pull Request
    v
develop
    |
    | vX.Y.Z-dev.YYYYMMDD or vX.Y.Z-alpha.N
    | GitHub: pre-release
    v
release/vX.Y.Z
    |
    | vX.Y.Z-rc.N
    | GitHub: pre-release
    | Stabilization, testing, and release-blocking fixes only
    v
main
    |
    | vX.Y.Z
    | GitHub: latest release
    v
Production users
```

## Pull Requests and Release Safety

- Use Conventional Commits for commit messages:
  `type(scope): imperative summary` (for example,
  `feat(monitoring): add process group filters` or
  `fix(tray): preserve the menu-bar badge`). Keep commits focused and avoid
  mixing unrelated changes.
- Pull Requests must identify the source and target branches explicitly.
- Feature Pull Requests target `develop`.
- Stabilization Pull Requests target `main` and must also synchronize fixes
  back into `develop`.
- Production releases require passing tests, lint/format checks, and the
  platform packaging checks available in CI.
- A release asset must correspond to the exact commit referenced by its tag.
- When a release build is unavailable for a platform, state that limitation
  clearly in the GitHub Release notes instead of implying full
  cross-platform support.
