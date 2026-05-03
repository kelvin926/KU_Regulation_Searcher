# Windows validation

Validation date: 2026-05-03 KST
Primary environment: Windows 11, PowerShell
Repository: `https://github.com/kelvin926/KU_Regulation_Searcher`
Branch: `main`

## Command validation

| Check | Result |
| --- | --- |
| `npm install` | Passed |
| `npm test` | Passed, 11 files / 39 tests |
| `npm run build` | Passed |
| `npm run rebuild:electron` | Passed |
| `npm run dist:win` | Passed |
| `npm run dev` | Passed, Vite served `http://127.0.0.1:6127/` and Electron process started |
| `git diff --check` | Passed |

## Installer validation

| Check | Result |
| --- | --- |
| Installer file | `release\KU-Regulation-Setup-0.8.4.exe` |
| Installer size | 179,133,417 bytes, about 170.8 MiB |
| SHA-256 | `F7EE95C4F080E105083D4D105D1293E59BC292E3C2DA7612C129751C60F77B60` |
| Install type | Per-user NSIS install |
| Admin permission | Not required in silent install validation |
| Install/update success | Passed, exit code 0 |
| App launch success | Passed, installed app process started successfully |
| Window title | `KU Regulation Searcher` |
| Process name | `KU Regulation Searcher` |
| Desktop shortcut | Created and targets `KU Regulation Searcher.exe` |
| Start menu shortcut | Created and targets `KU Regulation Searcher.exe` |
| Installer icon | Verified by extracting the associated icon from the setup exe |
| Packaged exe icon | Verified by extracting the associated icon from `release\win-unpacked\KU Regulation Searcher.exe` |
| Installed exe icon | Verified by extracting the associated icon from the installed exe |
| Installed version | `KU Regulation Searcher 0.8.4` in the current-user uninstall registry |
| SmartScreen | Possible because the installer is unsigned |

Note: this PC already had a pre-0.4.0 install under `%LOCALAPPDATA%\Programs\KU Regulation Assistant`. Updating in place keeps that installation folder for compatibility, but the visible app name, exe name, window title, shortcut name, and icon are `KU Regulation Searcher`. Fresh per-user installs use the current product name.

## App data validation

| Path | Result |
| --- | --- |
| User data | `%APPDATA%\KU Regulation Searcher\` exists |
| Database | `%APPDATA%\KU Regulation Searcher\data\ku-policy.sqlite` exists |
| Auth/session | `%APPDATA%\KU Regulation Searcher\auth\cookies.enc` exists after login |
| Gemini API key | `%APPDATA%\KU Regulation Searcher\auth\gemini-api-key.enc` exists after saving |
| Logs | `%APPDATA%\KU Regulation Searcher\logs\app.log` exists |
| Settings | `%APPDATA%\KU Regulation Searcher\config\settings.json` exists |
| Regulation list cache | `%APPDATA%\KU Regulation Searcher\config\regulation-targets.json` exists |
| Legacy migration | `%APPDATA%\KU Regulation Assistant\` is copied to the new 0.4.0 path when needed |
| Repo data leakage | No repo-root `data`, `auth`, `logs`, `.env`, sqlite, or encrypted session files were created |

## 0.8.4 validation notes

- 0.8.4 is a retrieval-quality release, not a new-model release.
- Added query intent parsing for regulation lookup, procedure, eligibility, duration, amount, definition, article lookup, and general questions.
- Added scope-aware reranking for common Korea University scopes such as 일반대학원, 교육대학원, 법학전문대학원, 세종캠퍼스, 교원, 직원, 조교, and students.
- Question words such as `방법`, `알려줘`, `설명`, `규정`, and `기준` are now treated as intent words or stopwords instead of high-weight search terms.
- Korean domain verbs such as `복학하는`, `휴학하려면`, and `신청하려면` are normalized to their core domain terms.
- Regulation-name questions such as `일반대학원 장학금 규정` now prioritize matching regulation names before broad article-body matches.
- Search results now include relevance groups: 적용 가능성 높음, 참고, 다른 소속 가능성, 낮은 관련도.
- The ask screen selects 적용 가능성 높음 and 참고 candidates by default; lower-relevance and out-of-scope candidates remain visible and can be selected manually.
- Default visible search candidates are 30, while the default AI evidence limit is 12 and the hard AI evidence cap is 15.
- AI prompt instructions now tell the model not to use out-of-scope candidate articles as direct evidence and to include only actually used article IDs.
- Added search-quality regression fixtures for 복학 procedure queries, 일반대학원 장학금 regulation lookup, 제76조의2 exact article lookup, and broad 장학금 diversity.
- Representative full local DB checks:
  - `복학하는 방법을 알려줘`: 복학-related articles ranked above unrelated method articles.
  - `일반대학원 장학금 규정`: `장학금 지급 규정 제15조` and `일반대학원 장학금 지급 세칙` articles ranked first.
  - `고려대에서 학생이 우주선을 빌릴 수 있나요?`: returned `NO_RELEVANT_ARTICLES`.
- Local silent update install passed with exit code 0, and the installed app process launched successfully.

## 0.8.3 validation notes

- Question search now retrieves a larger local candidate pool and reranks it before showing the configured number of candidates.
- Leave-duration questions such as `일반 휴학은 몇학기까지 가능한가요?` now boost terms such as `일반휴학`, `휴학기간`, `휴학연한`, `통산`, and `학기`.
- Generic standalone terms such as `일반` and `몇학기` are filtered so unrelated matches like tutorial/general committee text are less likely to outrank actual leave-duration rules.
- Broad leave-duration searches apply a light regulation-diversity pass so one regulation does not dominate all visible candidates.
- If more local candidates exist than the visible candidate limit, the ask screen explains that the answer is based on the visible top candidates and suggests narrowing the scope or increasing the candidate limit.
- Gemini prompt instructions now distinguish app-internal `ARTICLE_ID` values from real article numbers and require regulation name plus actual article number in the answer.
- Answer validation now flags suspicious citations such as using a large internal ID as `제12345조`.
- Generated answers include warnings when only part of the selected candidate list is sent to the AI because of the configured maximum.

## 0.8.2 validation notes

- 0.8.2 is a refactoring and stability release, not a feature-expansion release.
- Main-process IPC handlers were split by responsibility while preserving existing IPC channel names.
- Database access was reorganized behind repository classes while preserving the existing SQLite schema behavior.
- Regulation sync flow was split into target-cache, fetch/parse, progress, and runner modules without changing request delay or login behavior.
- Gemini response handling now separates connection-test prompting, JSON parsing, answer validation, and usage handling.
- Renderer pages now share small page-header, status-message, and stat-card components without changing the main screen flow.
- Shared TypeScript types were tightened for auth status, sync status, answer confidence, and API result shape.
- AI candidate-limit inputs now capture input values before the React state updater runs, preventing the settings page from turning blank while editing those numbers.
- Existing Windows installer, AppData, login-session, encrypted Gemini API key, regulation sync, search, AI answer, and data-management behaviors were preserved.

## 0.8.1 validation notes

- Candidate-count inputs in AI settings now keep draft values as text while editing, so blank or intermediate number input states no longer feed invalid numeric values into React state.
- Candidate-count saving now validates values before sending them to the main process and shows a Korean validation message for out-of-range input.
- Starting a new sync clears the previous sync failure list in both the UI and the local `sync_failures` table.
- Added `저장 데이터 폴더 열기` to the data management screen. It opens `%APPDATA%\KU Regulation Searcher\` in Windows Explorer.

## 0.8.0 validation notes

- Investigated representative sync failures reported from the Windows PC.
- Regulations that return a `처리 중 입니다` placeholder from the iframe content endpoint are retried through the full-view page.
- File-only regulations that expose HWP/PDF downloads but no HTML body are now saved as a `원문 파일` record instead of failing as `NOT_FOUND`.
- Unnumbered guidelines and directions are now saved as a searchable `본문` record instead of failing with `파싱된 조문이 없습니다`.
- Department-unlisted regulations are now saved as an `안내` record explaining that the regulation is not listed in the regulation book at the department's request.
- Appendix/form-only pages are now saved as `별표/서식` records so file names remain searchable.
- Large regulation pages that contain ordinary forms and `login`/`password` words are no longer mistaken for expired login sessions unless an actual password input form is present.
- Rechecked the reported failing examples, including `10-0-159`, `10-0-231`, `5-0-145`, `3-1-177`, and `1-0-1`; each produced at least one storable record after the fix.
- A temporary-DB sync check for representative failures completed with 5/5 successes and 122 saved article records.

## 0.5.0 validation notes

- Login screen now explains that users must log in through the official Korea University login window and close that login window to refresh the app login state.
- Sync progress, refresh messages, and error notices appear above the long regulation tree instead of below it.
- Sync status numbers show current success/failure counts while a sync job is running.
- Sync progress shows estimated remaining time and estimated total time after at least one regulation completes.
- In-progress refresh notices are no longer duplicated.
- The visible-list selection button toggles between select all and clear all.
- Folder-level selection buttons also toggle between selecting and clearing that folder.
- Sync status pills have distinct colors for idle, running, stopping, completed, failed, and cancelled states.

## 0.4.0 validation notes

- Program branding changed to `KU Regulation Searcher`.
- Installer, unpacked exe, installed exe, app header, and shortcuts use the new name.
- The app icon was regenerated from `KU_Regulation_Searcher.png` and embedded into Windows executable resources with `rcedit`.
- Korea University style colors are applied to the app shell and main controls.
- Pretendard Variable is bundled from the official `pretendard` package.
- Regulation list refresh shows an in-progress message and a completion message.
- If login is required during list refresh or sync, the UI tells the user to log in through the official login window and close that window before retrying.
- Regulation targets are loaded in the regulation-management-system order and grouped into folder-like categories.
- Search boxes support quoted phrases, `OR` / `|`, and excluded terms with `-term` or `NOT term`.
- Matching search terms are highlighted in search and candidate article views.
- HWP/PDF download buttons are available for synced regulation articles.
- Attached/appendix file buttons are loaded when the regulation system exposes attachment metadata.
- AI request/token usage and stored regulation size are displayed.
- API key input is disabled while a key is already saved, and becomes editable after deleting the saved key.
- English internal statuses shown to users were translated to Korean labels where practical.
- Query synonym expansion was narrowed so distinct terms such as `교원`, `직원`, and `조교` are not treated as the same meaning.

## Manual checks

- The user completed Gemini API key saving and Korea University login through the app UI during Windows validation.
- Login cookies and the Gemini API key persisted across app restart through encrypted files under `%APPDATA%\KU Regulation Searcher\auth\`.
- API key and login credentials were not written to README, TESTING, source files, or git diffs.
- Full live regulation interpretation remains advisory; final academic/regulatory decisions should still be confirmed with the department office or responsible office.
