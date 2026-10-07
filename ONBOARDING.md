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
- **Running locally:** `npm run dev` is broken because of a nested `node_modules` folder that breaks Vite's scanner. Use:
  ```bash
  npm run build && npm run preview -- --port 5173
  ```
- **Verifying changes:** use `npm run build`. Bare `tsc --noEmit` is a no-op on this repo's solution-style tsconfig and misses real errors.
- **Text changes:** any UI text change must also update the Help page (`src/pages/HelpPage.tsx`) and the Translation Google Sheet.

## Lesion measurement

`src/lib/vesselSweep.ts` measures ①–② by sweeping a cutting plane along the vessel's centre line (reusing `computeCrossSection` from the slice tool), so diameters, the true narrowest area and the length don't depend on camera angle or exact click pixels. `twoPointLesionMeasurement.ts` uses it when both points have a `worldPoint` and falls back to the old screen-based width method if the sweep can't follow the vessel. On `NC6_V1P2_KyosakuTest1_mm.stl` it gives a narrowest diameter of about 1.56 mm from any click around the lesion (true 1.54 mm). Points stay draggable after a measurement until FFR is calculated; dragging re-measures.

## Appwrite projects

There are two, and changes don't sync between them:

- **Dev/cloud project** (`cloud.appwrite.io`), used by the local `.env`. It does not have the Jev function.
- **Production** (self-hosted, `app.sys4tr.com`, project `6a85582b0023b5c32287`). The live site is `medical-circulator-v2.app.sys4tr.com`.

Test anything involving the Jev tiebreak against production.

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
