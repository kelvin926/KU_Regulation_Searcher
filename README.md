# KU Regulation Searcher

고려대학교 규정을 Windows PC에 저장해 검색하고, 선택한 근거 조항만 Gemini API로 보내 답변을 생성하는 로컬 규정 검색 앱입니다.

이 앱은 고려대학교 규정관리시스템을 우회하지 않습니다. 사용자가 고려대학교 공식 로그인 창에서 직접 로그인하면, 본인 계정으로 접근 가능한 규정만 로컬 DB에 저장합니다. 규정 해석의 최종 판단은 학과사무실 또는 담당 부서 확인이 필요합니다.

제작자: [kelvin926](https://github.com/kelvin926)

현재 버전: `0.5.0`

## 다운로드

1. [GitHub Releases](https://github.com/kelvin926/KU_Regulation_Searcher/releases)로 이동합니다.
2. 최신 버전의 `KU-Regulation-Setup-0.5.0.exe`를 다운로드합니다.
3. 다운로드한 설치 파일을 실행합니다.

Node.js, Python, 별도 데이터베이스, 별도 브라우저를 설치할 필요가 없습니다.

아직 코드서명은 적용하지 않았습니다. Windows SmartScreen 경고가 표시될 수 있으며, 이 경우 게시자가 표시되지 않는 이유는 코드서명이 없기 때문입니다.

## 처음 사용하는 순서

1. `로그인` 화면에서 `로그인 열기`를 누릅니다.
2. 고려대학교 공식 로그인 창이 열리면, 그 창에서 직접 아이디와 비밀번호를 입력합니다.
3. 로그인에 성공하면 로그인 창을 닫습니다. 창을 닫아야 앱의 로그인 상태가 갱신됩니다.
4. `AI 설정` 화면에서 Gemini API 키를 저장합니다.
5. `규정 동기화` 화면에서 `규정 목록 새로고침`을 누릅니다.
6. 필요한 규정을 폴더 목록에서 선택하고 `선택 규정 동기화`를 누릅니다.
   - 규정을 전체 선택해서 동기화하면 이 Windows PC 기준으로 약 1시간이 걸릴 수 있습니다. 네트워크 상태, 규정관리시스템 응답 속도, 선택한 규정 수에 따라 더 짧거나 길어질 수 있습니다.
7. `규정 질의` 또는 `규정 검색`에서 질문하거나 조항을 검색합니다.

## Gemini API 키 만들기

AI 답변 생성 기능을 쓰려면 Google AI Studio에서 Gemini API 키를 만들어야 합니다. API 키는 쉽게 말해 “내 Google 계정으로 Gemini API를 사용할 수 있게 해주는 개인용 비밀번호”입니다.

1. 웹브라우저에서 [Google AI Studio API Keys](https://aistudio.google.com/app/apikey) 페이지를 엽니다.
2. Google 계정으로 로그인합니다.
3. 처음 사용하는 경우 약관 동의 화면이 나오면 내용을 확인하고 동의합니다.
4. `Create API key`, `API 키 만들기`, 또는 비슷한 이름의 버튼을 누릅니다.
5. 프로젝트를 고르라고 나오면 기본 프로젝트를 선택하거나 새 프로젝트를 만듭니다.
6. 키가 만들어지면 긴 문자열이 표시됩니다. `Copy` 또는 복사 버튼을 눌러 복사합니다.

Google 공식 문서에 따르면 Gemini API 키는 Google AI Studio의 API Keys 페이지에서 만들고 관리할 수 있습니다. 새 사용자는 약관 동의 후 기본 Google Cloud 프로젝트와 API 키가 자동으로 만들어질 수 있습니다. 자세한 내용은 [Google AI for Developers: Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)를 참고하세요.

## 앱에 Gemini API 키 입력하기

1. KU Regulation Searcher를 실행합니다.
2. 왼쪽 메뉴에서 `AI 설정`을 누릅니다.
3. `Gemini API 키` 입력칸에 방금 복사한 키를 붙여넣습니다.
4. 사용할 모델을 선택합니다.
5. `API 키 저장`을 누릅니다.
6. `연결 테스트`를 눌러 정상 동작하는지 확인합니다.

키가 정상적으로 저장되면 입력칸은 비활성화됩니다. 다시 입력하고 싶으면 먼저 `API 키 삭제`를 누른 뒤 새 키를 입력하세요.

## Gemini API 키 보안 주의사항

- API 키 전체 값을 다른 사람에게 보내지 마세요.
- API 키를 GitHub, 블로그, 카카오톡, 이메일, README, `.env` 파일에 올리지 마세요.
- Codex나 ChatGPT 대화창에도 API 키 전체 값을 붙여넣지 않는 것을 권장합니다.
- 이 앱은 API 키를 `%APPDATA%\KU Regulation Searcher\auth\gemini-api-key.enc`에 암호화해서 저장합니다.
- 키가 유출된 것 같으면 Google AI Studio에서 해당 키를 삭제하고 새로 만드세요.
- 사용량이나 과금이 걱정되면 Google Cloud Console에서 결제/할당량 상태를 확인하세요.

Google 공식 문서도 API 키를 비밀번호처럼 다루고, 소스 코드 관리 시스템에 커밋하지 말라고 안내합니다.

## 주요 기능

- 규정관리시스템 순서의 폴더형 규정 목록
- 선택한 규정만 동기화
- 동기화 진행률, 예상 소요 시간, 성공/실패 숫자 실시간 표시
- 표시된 규정 목록 전체 선택/전체 해제 토글
- SQLite FTS5 기반 로컬 조항 검색
- Gemini API 기반 근거 조항 한정 답변 생성
- 답변에 사용된 조항 하이라이트 및 검증 경고
- 규정 HWP/PDF 다운로드
- 별첨/별표 파일 다운로드
- 검색 연산자와 검색어 하이라이트
- AI 호출/토큰 사용량 표시 및 초기화
- 저장된 규정 용량 표시
- 로그인 세션과 Gemini API 키의 안전 저장

## 검색 연산자

검색창에서는 다음 연산자를 사용할 수 있습니다.

- `"정확한 문구"`: 문구 그대로 검색
- `휴학 OR 복학`: 둘 중 하나라도 포함
- `-군입대` 또는 `NOT 군입대`: 해당 단어 제외
- 띄어쓰기: 입력한 단어를 모두 포함

예: `"일반휴학" -군입대`, `학칙 OR 대학원`, `제76조의2`

## AI 답변 방식

`규정 질의`는 다음 순서로 동작합니다.

1. 질문을 입력하고 Enter를 누르거나 `관련 조항 찾기`를 누릅니다.
2. 앱이 로컬 DB에서 관련 조항 후보를 먼저 찾습니다.
3. 사용자가 근거 조항을 선택합니다.
4. `AI 답변 생성`을 누르면 선택된 조항만 Gemini API로 전송합니다.
5. 답변 아래에 AI가 사용한 조항과 내용을 하이라이트합니다.
6. 앱이 `used_article_ids`와 조문 인용을 로컬 DB 기준으로 검증합니다.

관련 조항이 없으면 모델을 호출하지 않고 `[근거 없음]`으로 처리합니다.

## 저장 위치

Windows 기준 저장 위치는 다음과 같습니다.

- 앱 데이터: `%APPDATA%\KU Regulation Searcher\`
- DB: `%APPDATA%\KU Regulation Searcher\data\ku-policy.sqlite`
- 로그인 세션: `%APPDATA%\KU Regulation Searcher\auth\cookies.enc`
- Gemini API 키: `%APPDATA%\KU Regulation Searcher\auth\gemini-api-key.enc`
- 설정 및 사용량: `%APPDATA%\KU Regulation Searcher\config\settings.json`
- 규정 목록 캐시: `%APPDATA%\KU Regulation Searcher\config\regulation-targets.json`
- 로그: `%APPDATA%\KU Regulation Searcher\logs\app.log`

0.3.0 이하에서 사용하던 `%APPDATA%\KU Regulation Assistant\` 데이터는 0.4.0 이상 실행 시 새 경로로 복사됩니다.

## 보안 원칙

- 고려대 아이디/비밀번호를 저장하지 않습니다.
- 사용자는 고려대 공식 로그인 창에 직접 로그인합니다.
- 로그인 우회, 권한 우회, 비인가 접근 기능은 없습니다.
- Gemini API 키는 Electron safeStorage로 암호화해 저장합니다.
- API 키, 쿠키, 세션, DB, 로그, `.env` 파일은 GitHub에 커밋하지 않습니다.

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

Windows 검증 기록은 [TESTING.md](TESTING.md)에 정리합니다.
