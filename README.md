# KU Regulation Assistant

고려대학교 규정관리시스템에 사용자가 직접 로그인한 뒤, 접근 가능한 규정을 로컬 SQLite DB에 수집하고 조문 단위로 검색해 Gemini API로 근거 중심 답변을 생성하는 Windows GUI 앱입니다.

LLM이 고려대학교 사이트를 직접 검색하지 않습니다. 앱이 먼저 로그인 세션으로 규정을 수집하고, 질문 시 로컬 DB에서 찾은 관련 조항만 모델에 전달합니다. 근거가 부족하면 `[근거 없음]`으로 처리합니다.

## 설치

최종 사용자는 `KU-Regulation-Setup-${version}.exe` 하나만 실행해 설치합니다.

- Node.js, Python, Playwright, 별도 브라우저, 별도 DB 설치가 필요하지 않습니다.
- 설치는 기본적으로 per-user 방식이며 관리자 권한 없이 설치하도록 구성되어 있습니다.
- 코드 서명은 MVP에서 선택 사항입니다. 서명하지 않은 설치 파일은 Windows SmartScreen 경고가 표시될 수 있습니다.

## 고려대 로그인

앱의 `로그인` 화면에서 `로그인 열기`를 누르면 고려대학교 규정관리시스템 공식 페이지가 Electron BrowserWindow 안에서 열립니다.

- 사용자가 직접 고려대 아이디/비밀번호를 입력합니다.
- 앱은 아이디/비밀번호를 저장하지 않습니다.
- 로그인 후 생성된 세션/cookie만 로컬 사용자 데이터 폴더 아래에 저장합니다.
- 로그아웃 또는 세션 삭제 시 저장된 세션과 쿠키가 삭제됩니다.

세션이 없으면 `[AUTH_REQUIRED]`, 세션 만료가 감지되면 `[AUTH_EXPIRED]`가 표시됩니다.

## Gemini API Key

`AI 설정` 화면에서 Google AI Studio / Gemini API Key를 입력합니다.

- Google AI Studio에서 API Key를 생성한 뒤 앱에 붙여넣고 `API Key 저장`을 누릅니다.
- API Key는 Electron `safeStorage`로 암호화해 저장합니다.
- API Key는 평문 파일에 저장하지 않습니다.
- 연결 테스트는 현재 선택된 모델로 짧은 JSON 응답을 요청합니다.
- Gemini API 호출 시 사용자 질문과 선택된 관련 조항 일부가 Google API로 전송됩니다.
- 개인정보, 학생정보, 민감한 내부 문서는 질문에 입력하지 마세요.

## 모델 선택

지원 모델은 두 개만 제공합니다.

- `Gemma 4 31B` (`gemma-4-31b-it`): 호출량이 많고 비용 민감한 일반 규정 질의용 기본 모델
- `Gemini 3.1 Flash Lite` (`gemini-3.1-flash-lite-preview`): 빠른 응답과 Gemini 계열 지시 이행 우선

`Gemini 3.1 Flash Lite`는 preview 모델입니다. UI에 “Preview 모델은 제공 여부, 모델명, 가격, 제한이 변경될 수 있습니다.” 경고가 표시됩니다.

## 규정 동기화

`동기화` 화면에서 사용자가 버튼을 누를 때만 동기화합니다. 앱 시작 시 자동 전체 동기화는 하지 않습니다.

현재 MVP 동기화 대상:

- 고려대학교 학칙
- 학사운영 규정
- 대학원학칙

요청 간 기본 지연은 1초 이상입니다. 진행률, 성공/실패 통계, 실패 목록, 마지막 동기화 시각을 화면에 표시합니다.

## 자연어 질의

`규정 질의` 화면 흐름:

1. 질문을 입력합니다.
2. `관련 조항 찾기`를 누릅니다.
3. SQLite FTS5와 간단한 한국어 규정 용어 동의어 확장으로 관련 조항 후보를 찾습니다.
4. 후보 조항을 확인하고 필요한 근거만 선택합니다.
5. `답변 생성`을 누르면 선택된 조항만 Gemini API에 전달합니다.
6. 답변 아래에 사용된 근거 조항과 검증 경고를 표시합니다.

로컬 DB가 비어 있으면 `[LOCAL_DB_EMPTY]`가 표시됩니다. 관련 조항이 없으면 모델을 호출하지 않고 `[근거 없음]`을 표시합니다.

## 규정 검색

`규정 검색` 화면에서 다음 조건으로 로컬 DB를 조회할 수 있습니다.

- 규정명 검색
- 조문 본문 검색
- 조문번호 직접 조회 (`제76조`, `제76조의2` 등)

결과를 선택하면 원문 줄바꿈을 보존한 조문 본문, 출처 URL, 수집 시각을 확인할 수 있습니다.

## 로컬 데이터 위치

Electron `app.getPath("userData")`와 `path.join`으로 경로를 구성합니다. Windows 기본 위치는 다음과 같습니다.

- 앱 데이터: `%APPDATA%\KU Regulation Assistant\`
- DB: `%APPDATA%\KU Regulation Assistant\data\ku-policy.sqlite`
- 세션: `%APPDATA%\KU Regulation Assistant\auth\`
- 로그: `%APPDATA%\KU Regulation Assistant\logs\app.log`

## 데이터 삭제

`데이터 관리` 화면에서 다음 작업을 할 수 있습니다.

- 로컬 DB 초기화
- 세션 삭제
- API Key 삭제
- 전체 로컬 데이터 삭제

## 보안 주의사항

- 고려대 아이디/비밀번호는 절대 저장하지 않습니다.
- Gemini API Key는 평문 파일로 저장하지 않습니다.
- 로그에는 쿠키, 세션, API Key, 비밀번호, 개인정보를 남기지 않습니다.
- Git에는 세션, DB, 로그, API Key, 빌드 산출물을 커밋하지 않습니다.
- 원격 서버, Cloudflare Worker, 외부 백엔드는 사용하지 않습니다.
- 로그인 우회, 권한 우회, 비인가 접근을 구현하지 않습니다.
- 사용자가 본인 계정으로 접근 가능한 범위만 수집합니다.

규정 해석의 최종 판단은 학과사무실 또는 담당 부서 확인이 필요합니다.

## 알려진 한계

- MVP는 전체 규정이 아니라 3개 핵심 규정의 end-to-end 동기화부터 구현합니다.
- 고려대학교 규정관리시스템의 HTML 구조가 바뀌면 파서 보정이 필요할 수 있습니다.
- 한국어 FTS는 형태소 분석기가 아니라 SQLite FTS5와 간단한 동의어 확장 기반입니다.
- preview 모델은 제공 여부, 모델명, 가격, 제한이 바뀔 수 있습니다.
- macOS에서 실행되는 것은 최종 성공 기준이 아닙니다. 최종 기준은 Node.js가 없는 Windows PC에서 설치 파일 하나로 설치/실행되는 것입니다.

## 문제 해결

- `[AUTH_REQUIRED]`: `로그인` 화면에서 공식 로그인 창을 열고 다시 로그인합니다.
- `[AUTH_EXPIRED]`: 로그아웃 후 다시 로그인하고 동기화를 재시도합니다.
- `[LOCAL_DB_EMPTY]`: `동기화` 화면에서 규정을 먼저 수집합니다.
- `[NO_RELEVANT_ARTICLES]`: 질문 표현을 바꾸거나 `규정 검색`에서 조문을 직접 찾습니다.
- `[API_KEY_MISSING]`: `AI 설정` 화면에서 Gemini API Key를 저장합니다.
- `[API_KEY_INVALID]`: Google AI Studio에서 API Key 상태를 확인한 뒤 새 Key를 저장합니다.
- `[RATE_LIMITED]`: 잠시 후 다시 시도하거나 모델/호출량 제한을 확인합니다.
- `[MODEL_UNAVAILABLE]`: 선택한 모델 제공 여부와 모델명을 확인합니다.
- 설치 시 SmartScreen 경고가 나오면 배포자가 제공한 파일인지 확인한 뒤 실행 여부를 판단합니다.

## Windows 설치 테스트 체크리스트

실제 Windows 검증 기록은 [`TESTING.md`](TESTING.md)에 정리합니다.

배포 전에는 여자친구 컴퓨터에 전달하기 전에 별도 Windows PC 또는 VM에서 먼저 확인합니다.

1. Node.js가 설치되지 않은 Windows PC 또는 VM을 준비합니다.
2. GitHub Actions artifact에서 `KU-Regulation-Setup-${version}.exe`를 다운로드합니다.
3. 설치 파일을 실행하고 관리자 권한 없이 설치되는지 확인합니다.
4. 시작 메뉴 또는 바탕화면 바로가기가 생성되는지 확인합니다.
5. 앱이 정상 실행되는지 확인합니다.
6. `%APPDATA%\KU Regulation Assistant\` 경로가 생성되는지 확인합니다.
7. `%APPDATA%\KU Regulation Assistant\data\`, `auth\`, `logs\` 하위 경로가 생성되는지 확인합니다.
8. 앱 종료 후 재실행이 정상인지 확인합니다.
9. 제거 프로그램으로 uninstall이 되는지 확인합니다.
10. 재설치가 정상인지 확인합니다.

개인용 MVP라 코드 서명은 아직 적용하지 않았습니다. 서명하지 않은 installer는 Windows SmartScreen 경고가 표시될 수 있습니다.

## Gemini API Key 테스트 체크리스트

실제 API Key는 GitHub Actions나 저장소에 넣지 말고 Windows 앱에서 사용자가 직접 입력합니다.

1. `AI 설정` 화면에서 Gemini API Key를 입력하고 저장합니다.
2. 앱 재시작 후 API Key가 유지되는지 확인합니다.
3. API Key를 삭제한 뒤 호출 시 `[API_KEY_MISSING]`이 표시되는지 확인합니다.
4. 잘못된 API Key 입력 시 `[API_KEY_INVALID]` 또는 적절한 API 오류가 표시되는지 확인합니다.
5. 모델 선택이 저장되고 앱 재시작 후 유지되는지 확인합니다.
6. `Gemma 4 31B` (`gemma-4-31b-it`) 연결 테스트와 답변 생성을 확인합니다.
7. `Gemini 3.1 Flash Lite` (`gemini-3.1-flash-lite-preview`) 연결 테스트와 답변 생성을 확인합니다.
8. 로그 파일에 API Key가 남지 않는지 확인합니다.

## End-to-End 테스트 체크리스트

실제 고려대 계정은 사용자가 공식 로그인 창에 직접 입력합니다. 앱은 아이디/비밀번호를 저장하지 않습니다.

1. `로그인 열기`를 눌러 고려대학교 규정관리시스템 공식 로그인 페이지가 열리는지 확인합니다.
2. 직접 로그인한 뒤 로그인 상태가 확인되는지 확인합니다.
3. 앱 재시작 후 세션이 유지되는지 확인합니다.
4. 로그아웃 또는 세션 삭제 후 규정 접근 시 `[AUTH_REQUIRED]`가 표시되는지 확인합니다.
5. 세션 만료 시 `[AUTH_EXPIRED]`가 표시되는지 확인합니다.
6. MVP 대상 3개 규정인 고려대학교 학칙, 학사운영 규정, 대학원학칙을 선택 동기화합니다.
7. 요청 간격이 1초 이상 유지되는지 확인합니다.
8. SQLite DB의 `regulations`, `articles`, `article_fts`, `sync_logs`가 정상 동작하는지 확인합니다.
9. `source_url`, `fetched_at`, `seq_history`가 저장되는지 확인합니다.
10. `제76조`와 `제76조의2`가 구분되는지 확인합니다.
11. “휴학은 몇 학기까지 가능한가요?”로 관련 조항 검색 후 답변 생성을 확인합니다.
12. “수료연구등록은 어떤 경우에 하나요?”로 관련 조항 검색 후 답변 생성을 확인합니다.
13. “학위청구논문 심사는 어떤 조건이 필요한가요?”로 관련 조항 검색 후 답변 생성을 확인합니다.
14. “제76조의2와 관련된 내용 찾아줘.”에서 조문번호 검색이 정상인지 확인합니다.
15. “고려대에서 학생이 우주선을 빌릴 수 있나요?”에서 모델 호출 없이 `[근거 없음]`으로 처리되는지 확인합니다.
16. 답변에 `used_article_ids`가 포함되고 실제 검색 후보 안의 ID인지 검증되는지 확인합니다.
17. 답변 아래에 `regulation_name`, `article_no`, `source_url`, `fetched_at`이 표시되는지 확인합니다.
18. 근거 후보에 없는 조문을 모델이 언급하면 검증 경고가 표시되고 복사 시 경고도 포함되는지 확인합니다.

## 개발

```bash
npm install
npm run dev
```

검증:

```bash
npm test
npm run build
```

`better-sqlite3`는 native 모듈입니다. `npm run dev`는 Electron 실행용으로 재빌드하고, `npm test`는 Node.js 단위 테스트용으로 재빌드합니다.

## Windows 설치 파일 빌드

Windows 환경 또는 GitHub Actions `windows-latest` runner에서 빌드합니다.

```bash
npm ci
npm test
npm run build
npx electron-builder --win nsis --x64
```

산출물:

```text
release/KU-Regulation-Setup-${version}.exe
```

## GitHub Actions artifact 다운로드

1. GitHub 저장소의 `Actions` 탭으로 이동합니다.
2. `Build Windows Installer` workflow 실행을 선택합니다.
3. 성공한 run의 `Artifacts`에서 `KU-Regulation-Setup`을 다운로드합니다.
4. 압축을 풀고 `KU-Regulation-Setup-${version}.exe`를 실행합니다.

GitHub Actions에는 Gemini API Key나 고려대 계정 정보를 넣지 않습니다. 외부 로그인이 필요한 테스트는 mock/session 없는 단위 테스트와 분리합니다.
