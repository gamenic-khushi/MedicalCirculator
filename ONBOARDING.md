# Medical Circulator: Project Status and Onboarding

As of 2026-10-06. For new team members catching up on the project.

## What the app does

Vessel lesion measurement and FFR estimation. The user loads a 3D vessel model, clicks two points (①/②) around a lesion, and the app measures the vessel and calculates FFR with a cubic-diameter formula.

## What's been done

- **Real backend:** Appwrite Auth, Storage and Database are wired up end to end.
- **Measurement flow:**
  - Two-point lesion selection (①/②) with automatic proximal/distal ordering, plus a manual swap button.
  - Points are anchored to the 3D model, and mesh raycasting is accelerated with BVH.
  - An interactive slicing plane shows vessel cross-sections. X/Y/Z are quick presets, and the gizmo allows free translate and rotate.
- **FFR calculation:**
  - The real cubic-diameter formula is implemented (`src/lib/ffrCubicModel.ts`). It matched 5 of 5 of Aki-san's reference rows exactly.
  - Inputs outside the trained range show a clear error instead of a wrong number.
- **AI tiebreak:**
  - A Jev-based server function (`resolveProximityTiebreak`) breaks ties on ①/② ordering.
  - The swap button locks the user's manual choice, so a late AI answer can no longer flip it back.
- **UI and docs:** on-screen guidance bubbles, an updated Help page, and the Translation sheet kept in sync with UI text.
- **Deploy:** the site and the server function both deploy on push to `development`. Until 2026-10-01 CI never actually deployed the function (see Deploy below).

## What still needs attention

1. **Automatic ①/② ordering near bifurcations isn't reliable.** A branch root can look wider than the trunk. The walk now requires sustained width (`ModelCanvas.tsx`), but this hasn't been tested on a real bifurcation. The swap button is the fallback.
2. **Test model units.** The `NC6_*_KyosakuTest*.stl` files are authored in metres, but the app reads model units as millimetres, so every measurement comes out 1000x too small and FFR can never calculate. Decision (Aki-san, 10/6): use models exported in millimetres, not unit conversion in the app. `*_mm.stl` copies (x1000) of the V1P2 tests live next to the originals in `prototypes/vtkjs-lesion-test/aki_test_files/` (not tracked by git). Each V1P2 test contains one built-in stenosis (narrowest 1.54 / 1.29 / 0.62 mm); even then FFR only calculates when ① and ② are about 7–8 mm apart either side of it, on 3–5 mm vessel.
3. **Aki-san's review.** He is reviewing the calculation and wants it checked against his reference values by changing inputs. A live end-to-end comparison is blocked by point 2.
4. **Jev confidence data.** The tiebreak threshold is 0.5 (`PROXIMITY_TIEBREAK_MIN_CONFIDENCE` in `LesionAnalysisPage.tsx`). The function logs each decision's confidence, so the threshold can be tuned from real data.

## Working with the code

- **Stack:** Vite, React 19 and TypeScript, Tailwind 4, three.js, and a self-hosted Appwrite (TablesDB, not the deprecated Databases API).
- **Running locally:** `npm run dev`. Vite's dependency scan is limited to the app (`optimizeDeps.entries` in `vite.config.ts`), because the pages under `prototypes/` import vtk.js, which isn't installed.
- **Verifying changes:** use `npm run build`. Bare `tsc --noEmit` is a no-op on this repo's solution-style tsconfig and misses real errors.
- **Browser checks:** `npm run check:browser` opens the lesion and 3D viewer pages in a hidden Edge (or Chrome) without logging in, runs the client-reported flows (FFR overlay, FFR card kept off ① ② and the view's buttons and panels and following the lesion without jumping, on both pages, cross-section, 保存 image, rename, reopen, saved capture title, 学習名 required on upload, changing page without a scrollbar flashing up, button press), and prints PASS/FAIL. It uses a dev-only page, `dev/browser-check/`, with a fake admin and an in-memory database; it never reaches the real server and is not part of the build. Add a check to `dev/browser-check/run.mjs` when fixing a bug in those pages. Options: `--width=1180`, `--only=rename,reopen`. `dev/` is git-ignored, so this tool exists only on the maintainer's machine; on a fresh clone `npm run check:browser` fails and the `dev/browser-check` entries in `tsconfig.app.json` and `vite.config.ts` point at nothing (build and deploy are unaffected).
- **End-to-end tests (Playwright):** `npm run test:e2e` builds the app into `dist-e2e` with fake Appwrite settings (`.env.e2e`), serves it on port 4173 and drives Edge (`PW_CHANNEL=chrome` for Chrome). Every request to Appwrite is answered by an in-memory fake (`e2e/support/fakeAppwrite.ts`) and anything else that leaves localhost is refused, so no real server and no password is involved. It covers the folder list, the upload page (学習名 required), the lesion page (layout, the editable fields, two points measured, the Pa/Pd boxes, 保存 and the 保存一覧 columns, 編集 restoring the selection, a model exported in metres), the 資料 list, the font size, the left-hand menu and the Help text. If it times out on a busy machine (for example with Docker running), use `npx playwright test --workers=2`. Add a test in `e2e/*.e2e.ts` when fixing a bug; `npm run test:e2e:ui` opens the interactive runner. Unlike `dev/browser-check`, these tests are in the repository, so they work on a fresh clone (run `npm install` first).
- **Text changes:** any UI text change must also update the Help page (`src/pages/HelpPage.tsx`) and the Translation Google Sheet.
- **Animations:** the timings and presets are in `src/lib/motion.ts` (Motion); the button press effect is in `src/index.css`; changed values glow through `useHighlightOnChange`. Screens set to reduce motion get fades only. Pages rise in as they open, so anything `fixed` (dialogs, toasts, loading screens) must be rendered into `<body>` with `createPortal`, as `Modal` is, or it slides with the page. To try every animation without logging in, open `/motion-lab` on the dev server.

## Lesion measurement

`src/lib/vesselSweep.ts` measures ①–② by sweeping a cutting plane along the vessel's centre line (reusing `computeCrossSection` from the slice tool), so diameters, the true narrowest area and the length don't depend on camera angle or exact click pixels. `twoPointLesionMeasurement.ts` uses it when both points have a `worldPoint` and falls back to the old screen-based width method if the sweep can't follow the vessel. On `NC6_V1P2_KyosakuTest1_mm.stl` it gives a narrowest diameter of about 1.56 mm from any click around the lesion (true 1.54 mm). Points stay draggable after a measurement until FFR is calculated; dragging re-measures.

## Appwrite projects

There are two, and changes don't sync between them:

- **Dev project:** the old Appwrite Cloud dev project (`6a30bd6f0013e28e8adf`) no longer exists (it answers `project_not_found`), so a `.env` that still points at it cannot log in. For local work use an Appwrite in Docker, or a new project, set up as below. It does not have the Jev function.
- **Production** (self-hosted, `app.sys4tr.com`, project `6a85582b0023b5c32287`). The live site is `medical-circulator-v2.app.sys4tr.com`.

Test anything involving the Jev tiebreak against production.

### A local or new Appwrite project

- **Schema script:** `npm run appwrite:schema` (`scripts/setup-appwrite-schema.mjs`) creates the database, tables, columns, indexes and buckets the app uses in an empty project, and optionally the first admin. Run it with `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID` and `APPWRITE_API_KEY` (and `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` for the admin). `--dry-run` only lists what it would do; it is safe to run again; it refuses to run against `app.sys4tr.com`. Add a Web platform for `localhost` in the console by hand.
- **Local Appwrite in Docker:** a compose file (outside this repository) serves the console at `http://localhost:8080/console` and the API at `http://localhost:8080/v1`. Create a project and an API key there, run the script, then set `VITE_APPWRITE_ENDPOINT` and `VITE_APPWRITE_PROJECT_ID` in `.env` and rebuild (`npm run build`; the values are baked in). Delete the API key afterwards. A default server caps a file at about 30 MB.
- **New columns:** the schema exists only in each project's console. When the code starts to write a new column, add it to the script and to production's console by hand (for example `learning_content_frames.viewState`, string 4096, optional, used by 編集). Without the column production refuses the row; 保存 retries without `viewState`, but other new columns would break saving.

## Deploy

- Push to the `development` branch of `timeriver/medical-circulator`. That triggers the GitHub Actions workflow `.github/workflows/deploy.yml`, which runs `appwrite push site` and `appwrite push function`.
- The repo has two remotes: `origin` (`gamenic-khushi/MedicalCirculator`) and `timeriver` (`timeriver/medical-circulator`).
- **Config file:** the Appwrite CLI only reads `appwrite.config.json`. Add any new site or function there. An `appwrite.json` is ignored; this caused the function push to fail with "Function not found" until it was merged on 2026-10-01.
- **CLI version:** keep CI pinned at `appwrite-cli@17.4.0`. Version 26.0.0 turns a missing `rules.read` scope into a hard failure on the site push, and self-hosted keys can't be granted that scope.
- **Checking a function deploy:** in the Appwrite console, open Functions, then `resolveProximityTiebreak`, and confirm the active deployment is recent with source "CLI". Don't rely on a green CI run alone.
- **CI warnings to handle eventually:** the Node 20 actions deprecation, and `ubuntu-latest` moving to Ubuntu 26 on 2026-10-19.

## Access you'll need

- GitHub access to both repos.
- The Appwrite console (`app.sys4tr.com`).
- The Translation Google Sheet.
- **Secrets:** don't paste API keys or tokens in chat. The TypeSafe key lives in the Appwrite function's environment variables, and CI keys live in GitHub Actions secrets.

## Communication

Use the group chat for all project-related communication. Aki-san's requests and review feedback arrive there.
