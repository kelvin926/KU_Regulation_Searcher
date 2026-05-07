# Windows validation

Validation date: 2026-05-07 KST
Primary environment: Windows 11, PowerShell
Repository: `https://github.com/kelvin926/KU_Regulation_Searcher`
Branch: `main`

## Command validation

| Check | Result |
| --- | --- |
| `npm install` | Passed |
| `npm test` | Passed, 13 files / 65 tests |
| `npm run eval:local-search:complex` | Passed, 10,000 / 10,000 generated natural-language complex local DB questions |
| `npm run build` | Passed |
| `npm run rebuild:electron` | Passed |
| `npm run dist:win` | Passed |
| `npm run dev` | Passed, Vite served `http://127.0.0.1:6127/` and Electron process started |
| `git diff --check` | Passed |

## Installer validation

| Check | Result |
| --- | --- |
| Installer file | `release\KU-Regulation-Setup-0.9.1.exe` |
| Installer size | 179,052,992 bytes, about 170.8 MiB |
| SHA-256 | `75A8D644CBAEC0FF39732E52D3B64D1BB22542890942D1CA789BC818984FBB94` |
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
| Installed version | `KU Regulation Searcher 0.9.1` in the current-user uninstall registry |
| App display version | `0.9.1` embedded in the renderer bundle |
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

## 0.9.1 validation notes

- 0.9.1 keeps the compound natural-language routing and separates manual narrowing into two independent controls: campus and query group.
- Campus can be selected separately from group, so combinations such as `서울캠퍼스 / 학부생` and `세종캠퍼스 / 학부생` are searchable without treating campus as the student's status.
- Custom regulations now store both applicable campus and applicable group, then participate in the same search index as official regulations.
- The app header display version, package version, Windows uninstall registry version, and installer filename were checked against `0.9.1`.
- Search diagnostics now include routing notes and suggested re-search examples when results are broad or weak.
- Long evidence articles are compacted before being sent to AI, while preserving article identity and the head/tail context needed for citation-grounded answers.
- Graduate-student withdrawal, advisor-change, military-leave transition, student-council comparison, and new-faculty English lecture questions were checked against the local DB.
- The 10,000-question complex evaluation passed 10,000/10,000 checks: article lookup 1,770/1,770, title lookup 1,500/1,500, procedure 1,700/1,700, duration 646/646, eligibility 1,484/1,484, amount 700/700, evidence check 1,200/1,200, exception check 1,000/1,000.

## 0.8.7.1 validation notes

- 0.8.7.1 expands the local-search evaluation to 10,000 natural-language complex questions generated from the locally stored regulation DB.
- The 10,000-question run passed 10,000/10,000 checks: article lookup 1,770/1,770, title lookup 1,500/1,500, procedure 1,700/1,700, duration 646/646, eligibility 1,484/1,484, amount 700/700, evidence check 1,200/1,200, exception check 1,000/1,000.
- Directly named regulations are collected even when the regulation name appears inside a longer natural sentence, not only at the start of the query.
- Directly named regulations now stay eligible for AI evidence even when inferred scope terms such as `학부`, `직원`, or `조교` would otherwise mark the article out of scope.
- `회의의 소집과 의결`-style questions no longer trigger military-leave keyword expansion from the word `소집`.
- The npm package version is `0.8.7-1` for semver compatibility; the user-facing app/release version is `0.8.7.1`.

## 0.8.7 validation notes

- 0.8.7 adds a generated local-search evaluation harness and uses 5,000 questions produced from the locally stored regulation DB.
- The 5,000-question run passed 5,000/5,000 checks: article lookup 1,204/1,204, title lookup 1,200/1,200, procedure 950/950, duration 646/646, eligibility 700/700, amount 300/300.
- Directly named regulation questions now seed candidates by compact regulation-name matching, so `고려대학교 학칙 제1조`, spaced regulation names such as `구 매 규 정 제2조`, and `대학원학칙 ... 시행세칙` questions are not reduced to only `제N조` or generic title matches.
- Direct article-title and regulation-name matches now remain eligible for AI evidence even when the question has weak generic terms such as `대상`, `요건`, `지급 기준`, or `금액`.
- Scope detection now gives personnel terms such as `교원`, `직원`, and `조교` precedence over department words, so `경제학과 신임교원...` is not treated as a 학부생 question.
- The generated evaluation reports are written under `reports/` and are ignored by git.

## 0.8.6 validation notes

- 0.8.6 is a search-quality and evidence-selection patch based on the v0.8.5 follow-up checks.
- Graduate-student withdrawal questions such as `대학원생의 자퇴 방법은?` now prioritize `대학원학칙 일반대학원 시행세칙 제19조 자퇴`, `대학원학칙 제14조 자퇴`, and relevant graduate-school 자퇴 provisions instead of BK21 funding side rules.
- First-semester military-leave questions such as `학부생이 입학하자마자 군휴학 할 수 있나?` now normalize `군휴학` and `입학하자마자`, then prioritize `학사운영 규정 제30조 휴학의 제한`, `제29조 군입대 휴학`, `제24조 휴학의 분류`, and `제26조 특별휴학의 기간`.
- Broad leave-duration questions now keep the general undergraduate rule and general graduate-school rules together near the top before specific professional or special graduate-school provisions.
- Department-name questions that do not explicitly say 대학원 are treated as 학부-scoped by default, so `미래모빌리티학과 학생은 몇학기 휴학이 가능한가요?` no longer answers as if every graduate-school rule directly applied.
- Generic procedure words are added only when the question has a recognized policy topic. Out-of-domain questions such as `외계인이 침공하면 어떻게 해야하나요?` no longer expand into `신청`, `제출`, `승인` and now return no relevant articles.
- The ask screen now gives a clearer no-evidence warning when only low-relevance keyword matches exist.
- AI settings and README model descriptions now present Gemini 3.1 Flash Lite as the default practical choice and Gemma 4 31B as a comparison or fallback model, without overstating unverifiable model differences.
- Representative full local DB checks:
  - `대학원생의 자퇴 방법은?`: `대학원학칙 일반대학원 시행세칙 제19조 자퇴` ranked first; BK21 장학금 side rules were not selected as direct evidence.
  - `학부생이 입학하자마자 군휴학 할 수 있나?`: `학사운영 규정 제30조 휴학의 제한` and `제29조 군입대 휴학` ranked first and second.
  - `일반 휴학은 몇학기 가능한가요?`: `학사운영 규정 제23조`, `제25조`, `대학원학칙 일반대학원 시행세칙 제17조`, and `제16조의2` ranked before specific graduate-school rules.
  - `고려대학교 학생이 우주선을 대여할 수 있나요?`: only low-relevance keyword matches were shown, with no AI evidence selected by default.
  - `외계인이 침공하면 어떻게 해야하나요?`: returned `NO_RELEVANT_ARTICLES`.

## 0.8.5 validation notes

- 0.8.5 continues the retrieval-quality work and does not add a new LLM provider, embedding search, MCP mode, auto-update, or code signing.
- AI settings now explain the practical difference between Gemma 4 31B and Gemini 3.1 Flash Lite in non-technical Korean, including recommended use and tradeoff.
- Undergraduate military-leave questions such as `미래모빌리티학과 학부생의 군입대는 어떻게 진행해야 하나요?` now normalize `학부생의`, preserve department names ending in `학과`, and expand `군입대` into military-leave terms.
- 학부-scoped questions now boost `학사운영 규정` and `고려대학교 학칙`, while 대학원 and 교원-only rules are marked as different-scope candidates.
- Broad leave-duration questions now prefer common undergraduate and graduate authority rules first and demote specific professional/special graduate-school rules to 참고 unless the user names that scope.
- AI evidence auto-selection now selects only the highest relevance group by default, capped by the configured AI evidence limit, instead of selecting every 참고 candidate.
- Gemini prompt instructions now explicitly distinguish 학부, 일반대학원, and 전문·특수대학원 evidence usage.
- Added search-quality regression fixtures for undergraduate military-leave procedure questions and broad leave-duration authority ranking.
- Representative full local DB checks:
  - `미래모빌리티학과 학부생의 군입대는 어떻게 진행해야 하나요?`: `학사운영 규정 제29조 군입대 휴학` ranked first; graduate-school rules were marked as different-scope candidates.
  - `일반휴학은 얼마나 가능한가요?`: `학사운영 규정 제23조`, `학사운영 규정 제25조`, `대학원학칙 제12조`, and `대학원 학사운영 규정 제7조` ranked before specific graduate-school rules.
  - `복학하는 방법을 알려줘`: `학사운영 규정 제31조 복학의 신청` ranked first.
  - `고려대에서 학생이 우주선을 빌릴 수 있나요?`: returned `NO_RELEVANT_ARTICLES`.

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
