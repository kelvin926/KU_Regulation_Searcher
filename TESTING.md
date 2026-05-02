# Windows validation

Validation date: 2026-05-03 KST
Primary environment: Windows 11, PowerShell
Repository: `https://github.com/kelvin926/KU_Regulation_Searcher`
Branch: `main`

## Command validation

| Check | Result |
| --- | --- |
| `npm install` | Passed |
| `npm test` | Passed, 6 files / 12 tests |
| `npm run build` | Passed |
| `npm run rebuild:electron` | Passed |
| `npm run dist:win` | Passed |
| `git diff --check` | Passed |

## Installer validation

| Check | Result |
| --- | --- |
| Installer file | `release\KU-Regulation-Setup-0.4.0.exe` |
| Installer size | 192,926,972 bytes, about 184.0 MiB |
| SHA-256 | `B051EE5446CAE4E844B9C5F146FAF1556B7B075D817CB670F6B171566C567343` |
| Install type | Per-user NSIS install |
| Admin permission | Not required in silent install validation |
| Install success | Passed, exit code 0 |
| App launch success | Passed |
| Window title | `KU Regulation Searcher` |
| Process name | `KU Regulation Searcher` |
| Desktop shortcut | Created and targets `KU Regulation Searcher.exe` |
| Start menu shortcut | Created and targets `KU Regulation Searcher.exe` |
| Installer icon | Verified by extracting the associated icon from the setup exe |
| Packaged exe icon | Verified by extracting the associated icon from `release\win-unpacked\KU Regulation Searcher.exe` |
| Installed exe icon | Verified by extracting the associated icon from the installed exe |
| SmartScreen | Possible because the MVP installer is unsigned |

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
