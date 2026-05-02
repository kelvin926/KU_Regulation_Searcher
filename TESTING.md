# Windows local validation

Validation date: 2026-05-03 KST

This project is currently validated against Windows as the primary local environment.
Mac-specific behavior is not the release criterion for this MVP.

## Environment

- OS: Windows 11
- Repo: `https://github.com/kelvin926/KU_Regulation_Searcher`
- Branch: `main`
- Installer: `release\KU-Regulation-Setup-0.2.0.exe`
- Installer size: 104,493,003 bytes, about 99.7 MiB
- AppData path: `%APPDATA%\KU Regulation Assistant\`

## Command validation

- `npm install`: passed
- `npm test`: passed, 5 test files and 10 tests
- `npm run build`: passed
- `npm run rebuild:electron`: passed
- `npm run dist:win`: passed
- `git diff --check`: passed, with Windows CRLF warnings only

## Windows-specific fixes verified

- Vite dev server uses port `6127` because this Windows PC reserves the default Vite port `5173`, causing `EACCES`.
- `better-sqlite3` is rebuilt with `electron-rebuild -f -w better-sqlite3` so `npm test` does not leave the native module compiled for the wrong ABI before Electron launch.
- Windows packaging disables executable resource signing/editing with `win.signAndEditExecutable=false` because the unsigned MVP should not require winCodeSign symlink extraction privileges.
- Vite uses relative packaged asset paths via `base: "./"` so the installed app loads renderer assets from `file://.../resources/app.asar/dist/renderer/assets/...`.
- NSIS keeps AppData on uninstall/update with `deleteAppDataOnUninstall=false`, so login cookies, encrypted API key, settings, DB, and target-list cache are not removed by a version update.

## Installer validation

- Per-user silent install/update: passed
- Admin permission required: no
- Install path: `%LOCALAPPDATA%\Programs\KU Regulation Assistant\`
- Start menu shortcut: created
- Desktop shortcut: created
- Installed app launch without Node.js runtime: passed
- App relaunch: passed
- Update from the previous local install without uninstall: passed
- AppData persisted after update: `cookies.enc`, `gemini-api-key.enc`, and `settings.json` remained present
- Uninstall via generated uninstaller: passed
- Reinstall: passed
- SmartScreen: not shown during local silent validation; the installer is unsigned, so a SmartScreen warning is still possible on other PCs.

## AppData validation

Created under `%APPDATA%\KU Regulation Assistant\`:

- `data\ku-policy.sqlite`
- `auth\`
- `logs\`
- `config\settings.json`
- `config\regulation-targets.json` after a full regulation-list refresh

No SQLite DB, auth/session file, log file, `.env`, or installer executable was created as a tracked repo file. The `release\` directory remains ignored and must not be committed.

## Gemini API validation

- Missing API key: returns `[API_KEY_MISSING]`
- Invalid API key: returns `[API_KEY_INVALID]`
- API key save: passed
- App restart with saved API key: passed
- Gemma 4 31B (`gemma-4-31b-it`) connection test: passed
- Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite-preview`) connection test: passed
- API key delete: passed; after deletion, connection test returns `[API_KEY_MISSING]`
- Plaintext API key storage: not found in repo or AppData auth file names; stored file was encrypted as `auth\gemini-api-key.enc` before deletion.

## Login validation

- Official Korea University regulation system login window: opened in Electron BrowserWindow
- User-entered login: passed
- Auth status after login: `AUTHENTICATED`
- Session persistence after app restart/reinstall: passed
- Logout/session delete: passed
- Access after logout: returns `[AUTH_REQUIRED]`
- Credentials are not stored by the app.

## MVP regulation sync validation

Only the MVP target regulations were synced:

- 고려대학교 학칙: passed
- 학사운영 규정: passed
- 대학원학칙: passed

Sync results:

- Regulations: 3
- Articles: 265
- `article_fts` rows: 265
- Request spacing: next regulation fetch started about 1.1 seconds after the previous save event
- `source_url`, `fetched_at`, `seq_history`: present
- Sync failures: none
- Duplicate articles by regulation/article number: none

Article parsing spot checks:

- `제1조`: found
- `제76조`: found
- `제76조의2`: found separately from `제76조`
- `76의2`: normalized to `제76조의2` in app search
- `제1조의2`: no standalone article found in the synced MVP data
- `부칙`: no standalone article found in the synced MVP data

## Regulation list refresh validation

Version `0.2.0` adds full current-regulation list refresh and selected sync.

- Stored login cookies loaded through Electron `safeStorage`: passed
- Official AJAX tree endpoint used: `/lmxsrv/law/lawTreeNodes.do`
- Official list endpoint used: `/lmxsrv/law/lawListManager_areaC.do`
- Folder list pagination: verified; list pages contain 10 regulations per page and are fetched until no new target appears
- Refreshed target count: 1,277 current regulation targets in the logged-in session
- Core targets found in refreshed list:
  - `2-1-1 고려대학교 학칙`, `SEQ=15`, `SEQ_HISTORY=2502`
  - `2-1-2 학사운영 규정`, `SEQ=17`, `SEQ_HISTORY=2482`
  - `2-1-50 대학원학칙`, `SEQ=20`, `SEQ_HISTORY=2447`
- The refreshed list is cached at `%APPDATA%\KU Regulation Assistant\config\regulation-targets.json`.
- The UI no longer starts a full sync by default; users refresh the list, filter/select targets, and run `선택 규정 동기화`.

## Query layout validation

- `규정 질의` is split into two stable columns.
- Left column order: question panel, generated answer panel.
- Right column order: searched evidence candidates, displayed citation panel.
- The generated answer no longer drops below the right-side evidence/citation panel height.

## Natural-language RAG validation

Model used for final natural-language validation: `gemini-3.1-flash-lite-preview`

- "휴학은 몇 학기까지 가능한가요?": passed; 8 local candidates, answer grounded in selected candidate IDs.
- "수료연구등록은 어떤 경우에 하나요?": passed; answer states that the provided regulation defines 수료연구생 and delegates registration details to graduate-school rules.
- "학위청구논문 심사는 어떤 조건이 필요한가요?": passed after response validation hardening; answer uses candidate IDs for 대학원학칙 제32조 and 제33조의2.
- "제76조의2와 관련된 내용 찾아줘.": passed; answer uses 학사운영 규정 제76조의2 and displays a validation warning when the model mentions a non-candidate cross-reference.
- "고려대에서 학생이 우주선을 빌릴 수 있나요?": passed after query stop-word tightening; local search returns `NO_RELEVANT_ARTICLES`, candidate count 0, and the model call is skipped.

The app is a regulation search and RAG assistant. Final interpretation or official applicability should still be confirmed with the relevant department or office.
