# KU Regulation Assistant

고려대학교 규정을 내 Windows PC에 저장해 두고, 조문을 검색하거나 Gemini API로 근거 중심 답변을 만드는 데스크톱 앱입니다.

앱은 고려대학교 규정관리시스템을 우회하지 않습니다. 사용자가 공식 로그인 창에서 직접 로그인하면, 본인 계정으로 접근 가능한 규정만 로컬 DB에 저장합니다. 질문할 때도 전체 규정집을 모델에 보내지 않고, 먼저 내 PC의 SQLite FTS 검색으로 찾은 조항만 Gemini에 전달합니다.

규정 해석의 최종 판단은 학과사무실 또는 담당 부서 확인이 필요합니다.

## 다운로드

1. GitHub 저장소의 [Releases](https://github.com/kelvin926/KU_Regulation_Searcher/releases)로 이동합니다.
2. 최신 버전의 `KU-Regulation-Setup-0.3.0.exe`를 다운로드합니다.
3. 설치 파일을 실행합니다.

Node.js, Python, 별도 DB, 별도 브라우저를 설치할 필요가 없습니다.

서명하지 않은 개인용 MVP 설치 파일이므로 Windows SmartScreen 경고가 표시될 수 있습니다. 배포자가 제공한 파일이 맞는지 확인한 뒤 실행 여부를 판단하세요.

## 설치와 업데이트

- 설치는 per-user 방식입니다. 기본 설치 경로에서는 관리자 권한이 필요하지 않습니다.
- 새 버전으로 업데이트할 때 기존 앱을 제거할 필요가 없습니다. 새 `KU-Regulation-Setup-*.exe`를 그대로 실행하면 됩니다.
- 앱 데이터는 `%APPDATA%\KU Regulation Assistant\`에 저장되며, 앱 재시작/PC 재부팅/버전 업데이트 후에도 유지됩니다.
- 제거 프로그램으로 앱을 삭제해도 로컬 데이터는 기본적으로 남깁니다. 세션, API Key, DB까지 지우려면 앱의 `데이터 관리` 화면에서 삭제하세요.

## 처음 사용하는 순서

1. `로그인` 화면에서 `로그인 열기`를 누릅니다.
2. 고려대학교 규정관리시스템 공식 로그인 창에서 직접 로그인합니다.
3. `AI 설정` 화면에서 Google AI Studio Gemini API Key를 저장합니다.
4. `동기화` 화면에서 `규정 목록 새로고침`을 누릅니다.
5. 필요한 규정만 선택하고 `선택 규정 동기화`를 누릅니다.
6. `규정 질의` 또는 `규정 검색`에서 질문하거나 조문을 찾습니다.

전체 규정 자동 동기화는 하지 않습니다. 목록을 가져온 뒤 사용자가 선택한 규정만 동기화합니다.

## 주요 화면

- `로그인`: 고려대 공식 로그인 창 열기, 로그인 상태 확인, 로그아웃
- `동기화`: 접근 가능한 규정 목록 새로고침, 공식 시스템 순서의 폴더형 목록, 검색/선택, 선택 규정 동기화
- `AI 설정`: Gemini API Key 저장/삭제, 모델 선택, 연결 테스트
- `규정 질의`: 질문 입력, Enter로 관련 조항 검색, 선택 조항 기반 AI 답변 생성
- `규정 검색`: 규정명, 본문, 조문번호로 로컬 DB 검색
- `데이터 관리`: DB, 세션, API Key, 로그 삭제

## 지원 모델

- `Gemma 4 31B` (`gemma-4-31b-it`)
- `Gemini 3.1 Flash Lite` (`gemini-3.1-flash-lite-preview`)

Google AI Studio / Gemini API Key만 사용합니다. OpenAI, Claude, Vertex AI, 로컬 LLM은 사용하지 않습니다.

## 저장 위치

Windows 기준 저장 위치는 다음과 같습니다.

- 앱 데이터: `%APPDATA%\KU Regulation Assistant\`
- DB: `%APPDATA%\KU Regulation Assistant\data\ku-policy.sqlite`
- 로그인 세션: `%APPDATA%\KU Regulation Assistant\auth\cookies.enc`
- Gemini API Key: `%APPDATA%\KU Regulation Assistant\auth\gemini-api-key.enc`
- 설정: `%APPDATA%\KU Regulation Assistant\config\settings.json`
- 규정 목록 캐시: `%APPDATA%\KU Regulation Assistant\config\regulation-targets.json`
- 로그: `%APPDATA%\KU Regulation Assistant\logs\app.log`

저장소 폴더 안에는 DB, 세션, API Key, 로그를 만들지 않습니다.

## 보안

- 고려대 아이디와 비밀번호는 저장하지 않습니다.
- 사용자가 공식 로그인 창에 직접 입력합니다.
- 로그인 세션과 API Key는 Electron `safeStorage`로 암호화해 로컬에 저장합니다.
- API Key, 쿠키, 비밀번호, 세션 값은 로그나 Git에 남기지 않습니다.
- 사용자가 본인 계정으로 접근 가능한 범위만 수집합니다.
- 로그인 우회, 권한 우회, 비인가 접근은 구현하지 않습니다.

## 답변 방식

`규정 질의`는 다음 순서로 동작합니다.

1. 질문을 입력합니다.
2. 앱이 로컬 SQLite FTS5로 관련 조항 후보를 먼저 찾습니다.
3. 후보 조항 5~12개 안에서 사용자가 근거를 선택합니다.
4. `AI 답변 생성`을 누르면 선택된 조항만 Gemini API로 전송합니다.
5. 답변에는 사용한 조항 ID, 근거 조항 정보, AI가 언급한 조항의 하이라이트가 표시됩니다.
6. 앱이 답변의 조문 인용을 로컬 DB 기준으로 다시 검증합니다.

관련 조항이 없으면 모델을 호출하지 않고 `[근거 없음]`으로 처리합니다.

## 문제 해결

- `[AUTH_REQUIRED]`: `로그인` 화면에서 다시 로그인하세요.
- `[AUTH_EXPIRED]`: 세션이 만료되었습니다. 로그아웃 후 다시 로그인하세요.
- `[LOCAL_DB_EMPTY]`: `동기화` 화면에서 규정을 먼저 동기화하세요.
- `[NO_RELEVANT_ARTICLES]`: 질문 표현을 바꾸거나 `규정 검색`에서 조문을 직접 찾아보세요.
- `[API_KEY_MISSING]`: `AI 설정`에서 Gemini API Key를 저장하세요.
- `[API_KEY_INVALID]`: Google AI Studio에서 API Key 상태를 확인하세요.
- `[RATE_LIMITED]`: 잠시 후 다시 시도하거나 Gemini 호출 제한을 확인하세요.
- 설치 파일 실행 시 SmartScreen 경고: 코드 서명이 없는 MVP라 발생할 수 있습니다.

## 개발자용

Windows가 기준 개발 환경입니다.

```bash
npm install
npm test
npm run build
npm run rebuild:electron
npm run dist:win
git diff --check
```

개발 실행:

```bash
npm run dev
```

Vite 개발 포트는 `6127`입니다. 이 Windows PC에서 기본 포트 `5173`은 excluded port range에 걸려 `EACCES`가 발생했습니다.

설치 파일 산출물:

```text
release/KU-Regulation-Setup-${version}.exe
```

Windows 검증 기록은 [TESTING.md](TESTING.md)에 정리합니다.
