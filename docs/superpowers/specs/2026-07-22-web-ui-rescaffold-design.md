# web-ui re-scaffold

## Context
The `web-ui/` TanStack Start app was originally scaffolded by a cloud Claude Code session without asking the user for input on the underlying tooling choices (package manager, toolchain, deployment adapter, database add-on). The user wants those choices made deliberately this time. The existing scaffold already has working feature code on top of it (live detections page, species page, a verified SQLite/Drizzle read layer against `scripts/birds.db`, Header/Footer/ThemeToggle) — the user chose to wipe and re-scaffold from scratch rather than patch the existing project in place, then re-port the feature code onto the fresh structure.

## Decisions (made with user, one at a time)
- **Package manager:** npm (already the one actually installed; no new tooling).
- **Toolchain:** Biome (replacing ESLint + Prettier).
- **Deployment adapter:** Nitro / generic Node (self-contained Node server, matches how BirdNET-Pi's other services run on the Pi; no cloud platform).
- **Git:** `--no-git` — `web-ui/` stays a plain subfolder of the existing BirdNET-Pi-Live repo, not a nested repo.
- **Database/ORM:** Drizzle, configured for SQLite (`--add-on-config '{"drizzle":{"database":"sqlite"}}'`).
- **UI kit:** shadcn (Tailwind + Radix primitives) — kept from the original scaffold.
- **Other add-ons:** none for now (no TanStack Query, Table, Form, Store, React Compiler, t3env, i18n, MCP, monitoring). These get added later attached to the feature that actually needs them, not speculatively.
- **Demo/example routes:** excluded (`--no-examples`).

## Scaffold command
Run from the repo root, after deleting the existing `web-ui/`:
```
npx @tanstack/cli@latest create web-ui --framework react --package-manager npm --toolchain biome --deployment nitro --no-git --no-examples --add-ons drizzle,shadcn --add-on-config '{"drizzle":{"database":"sqlite"}}' --non-interactive
```

## Known risk: Drizzle's default SQLite driver
The CLI's Drizzle add-on likely scaffolds a driver like `better-sqlite3` or `@libsql/client`, which need native/prebuilt binaries. The previous (verified-working) implementation deliberately used Node's built-in `node:sqlite` via `drizzle-orm/sqlite-proxy` specifically to avoid a native-module build step, since this app needs to run on a Raspberry Pi. After scaffolding, inspect whatever driver got generated; if it's not `node:sqlite`, replace it with the same `node:sqlite` + `sqlite-proxy` pattern used before, pointed at `../scripts/birds.db` via `BIRDNET_DB_PATH`, with the same `detections` schema matching `scripts/createdb.sh` (Date, Time, Sci_Name, Com_Name, Confidence, Lat, Lon, Cutoff, Week, Sens, Overlap, File_Name), and the same dev-fallback that creates a local empty db with matching schema when the real one isn't reachable.

## Re-porting feature code
After the scaffold is verified working (dev server boots clean), re-add the following against the new structure — written fresh against the new conventions (Biome, shadcn layout), not copy-pasted wholesale:
- `db/` layer: schema + connection, as above.
- Detections route/page and Species route/page.
- Header, Footer, ThemeToggle components.

Not re-added yet: TanStack Query polling, tables, forms — deferred to when those features are actually built.

## Handling scaffold-time breakage
Per the user: if anything left over from the old scaffold (or generated fresh) errors due to a missing/removed package, don't try to patch it back together — remove whatever feature depends on the missing package and rebuild it properly later, deliberately, rather than papering over it.

## Verification
- `npm run dev` inside `web-ui/` boots with no errors (aside from Node's expected `node:sqlite` experimental-feature warning).
- The homepage loads in a real browser and correctly reads `scripts/birds.db` (matches the row count actually in the file — currently 0, so an empty-state message).
- `.claude/launch.json`'s `web-ui` entry still works unchanged (same `npm run dev --prefix web-ui` invocation, same port).
