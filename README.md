<div align="center">
  <img src="build/icon.png" alt="KU Regulation Searcher 아이콘" width="140" />

  <h1>KU Regulation Searcher</h1>

  <p><strong>고려대학교 규정을 검색하고, 근거 조항 기반으로 AI 답변을 생성하는 Windows 앱</strong></p>

  <p>
    <a href="https://github.com/kelvin926/KU_Regulation_Searcher/releases">최신 버전 다운로드</a>
    ·
    <a href="#처음-사용하기">처음 사용하기</a>
    ·
    <a href="#gemini-api-key-만들기">Gemini API Key 만들기</a>
    ·
    <a href="#검색-연산자">검색 연산자</a>
  </p>
</div>

---

## 소개

KU Regulation Searcher는 고려대학교 규정관리시스템의 규정을 로컬 PC에 저장한 뒤, 사용자가 자연어로 질문하면 관련 조항을 먼저 검색하고 그 조항만 Gemini API에 보내 답변을 생성하는 프로그램입니다.

앱은 고려대학교 공식 로그인 창을 통해 사용자가 직접 로그인한 세션으로 접근 가능한 규정만 수집합니다. 고려대 아이디와 비밀번호는 저장하지 않습니다.

규정 해석의 최종 판단은 반드시 학과사무실, 행정부서, 담당 부서의 안내를 확인하세요.

- 제작자: [kelvin926](https://github.com/kelvin926)
- 현재 버전: `0.5.0`
- 기준 환경: Windows

## 다운로드

1. [GitHub Releases](https://github.com/kelvin926/KU_Regulation_Searcher/releases)에 들어갑니다.
2. 최신 버전의 `KU-Regulation-Setup-0.5.0.exe`를 다운로드합니다.
3. 다운로드한 설치 파일을 실행합니다.

일반 사용자는 Node.js, Python, 별도 데이터베이스, 별도 브라우저를 설치할 필요가 없습니다.

아직 코드 서명이 적용되지 않았기 때문에 Windows SmartScreen 경고가 표시될 수 있습니다. 이번 MVP 단계에서는 코드 서명을 하지 않았으며, 경고가 뜨면 게시자가 표시되지 않는 이유가 코드 서명이 없기 때문입니다.

## 처음 사용하기

1. 앱을 실행합니다.
2. `로그인` 화면에서 `로그인 열기`를 누릅니다.
3. 새로 열린 고려대학교 공식 로그인 창에서 직접 아이디와 비밀번호를 입력합니다.
4. 로그인에 성공하면 로그인 창을 닫습니다.
5. `AI 설정` 화면에서 Gemini API Key를 저장합니다.
6. `규정 동기화` 화면에서 `규정 목록 새로고침`을 누릅니다.
7. 필요한 규정을 폴더 목록에서 선택하고 `선택 규정 동기화`를 누릅니다.
8. `규정 검색` 또는 `규정 질의` 화면에서 검색하거나 질문합니다.

규정을 전체 선택해서 동기화하면 이 Windows PC 기준으로 약 1시간이 걸릴 수 있습니다. 네트워크 상태, 규정관리시스템 응답 속도, 선택한 규정 수에 따라 더 짧거나 길어질 수 있습니다.

## Gemini API Key 만들기

AI 답변 생성 기능을 사용하려면 Google AI Studio에서 Gemini API Key를 만들어야 합니다. API Key는 쉽게 말해 내 Google 계정으로 Gemini API를 사용할 수 있게 해주는 개인용 비밀번호입니다.

1. 웹브라우저에서 [Google AI Studio API Keys](https://aistudio.google.com/app/apikey)를 엽니다.
2. Google 계정으로 로그인합니다.
3. 처음 사용하는 경우 약관 동의 화면이 나오면 내용을 확인하고 동의합니다.
4. `Create API key`, `API 키 만들기`, 또는 비슷한 이름의 버튼을 누릅니다.
5. 프로젝트를 고르라고 나오면 기본 프로젝트를 선택하거나 새 프로젝트를 만듭니다.
6. API Key가 만들어지면 긴 문자열이 표시됩니다.
7. `Copy` 또는 복사 버튼을 눌러 복사합니다.

Google 공식 문서에 따르면 Gemini API Key는 Google AI Studio의 API Keys 페이지에서 만들고 관리할 수 있습니다. 자세한 내용은 [Google AI for Developers: Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)를 참고하세요.

## 앱에 Gemini API Key 입력하기

1. KU Regulation Searcher를 실행합니다.
2. 왼쪽 메뉴에서 `AI 설정`을 누릅니다.
3. `Gemini API Key` 입력칸에 방금 복사한 키를 붙여넣습니다.
4. 사용할 모델을 선택합니다.
5. `API Key 저장`을 누릅니다.
6. `연결 테스트`를 눌러 정상 동작하는지 확인합니다.

API Key가 정상적으로 저장되면 입력칸은 비활성화됩니다. 다시 입력하고 싶으면 먼저 `API Key 삭제`를 누른 뒤 새 키를 입력하세요.

## Gemini API Key 보안 주의사항

- API Key 전체 값을 다른 사람에게 보내지 마세요.
- API Key를 GitHub, 블로그, 카카오톡, 이메일, README, `.env` 파일에 올리지 마세요.
- Codex나 ChatGPT 대화창에도 API Key 전체 값을 붙여넣지 않는 것을 권장합니다.
- 이 앱은 API Key를 `%APPDATA%\KU Regulation Searcher\auth\gemini-api-key.enc`에 암호화해서 저장합니다.
- 키가 노출된 것 같으면 Google AI Studio에서 해당 키를 삭제하고 새로 만드세요.
- 사용량이나 과금이 걱정되면 Google Cloud Console에서 결제 및 할당량 상태를 확인하세요.

## 주요 기능

- 고려대학교 규정관리시스템 순서 기반 규정 목록 표시
- 대분류와 소분류 폴더 형태의 규정 선택
- 선택한 규정만 로컬 DB에 동기화
- 동기화 진행률, 예상 소요 시간, 성공/실패 수 표시
- SQLite FTS5 기반 조항 검색
- 검색 연산자 지원
- 검색어와 일치하는 내용 형광펜 표시
- Gemini API 기반 근거 조항 제한 답변 생성
- AI가 언급한 조항과 내용을 답변 아래에 강조 표시
- 규정 HWP/PDF 다운로드
- 별첨/별표 파일 다운로드
- AI 호출 및 토큰 사용량 표시와 초기화
- 저장된 규정 데이터 용량 표시
- 로그인 세션과 Gemini API Key의 안전 저장

## 검색 연산자

검색창이 있는 화면에서는 다음 연산자를 사용할 수 있습니다.

| 입력 예시 | 의미 |
| --- | --- |
| `"일반휴학"` | 정확히 같은 문구 검색 |
| `휴학 OR 복학` | 둘 중 하나라도 포함 |
| `휴학 -군입대` | `군입대`가 들어간 결과 제외 |
| `휴학 NOT 군입대` | `군입대`가 들어간 결과 제외 |
| `제76조의2` | 특정 조문 번호 검색 |

여러 단어를 그냥 띄어 쓰면 입력한 단어를 모두 포함하는 결과를 우선 찾습니다.

## AI 답변 방식

`규정 질의`는 다음 순서로 동작합니다.

1. 사용자가 질문을 입력하고 Enter를 누르거나 `관련 조항 찾기`를 누릅니다.
2. 앱이 로컬 DB에서 관련 조항 후보를 먼저 찾습니다.
3. 사용자가 근거 조항을 확인하고 선택합니다.
4. `AI 답변 생성`을 누르면 선택된 조항만 Gemini API로 전송합니다.
5. AI 답변에는 사용된 조항 ID와 근거 정보가 포함됩니다.
6. 앱이 `used_article_ids`와 조문 인용을 로컬 DB 기준으로 다시 검증합니다.

관련 조항이 없으면 모델을 호출하지 않고 `[근거 없음]`으로 처리합니다.

## 저장 위치

Windows 기준 저장 위치는 다음과 같습니다.

| 항목 | 위치 |
| --- | --- |
| 앱 데이터 | `%APPDATA%\KU Regulation Searcher\` |
| DB | `%APPDATA%\KU Regulation Searcher\data\ku-policy.sqlite` |
| 로그인 세션 | `%APPDATA%\KU Regulation Searcher\auth\cookies.enc` |
| Gemini API Key | `%APPDATA%\KU Regulation Searcher\auth\gemini-api-key.enc` |
| 설정 및 사용량 | `%APPDATA%\KU Regulation Searcher\config\settings.json` |
| 규정 목록 캐시 | `%APPDATA%\KU Regulation Searcher\config\regulation-targets.json` |
| 로그 | `%APPDATA%\KU Regulation Searcher\logs\app.log` |

0.3.0 이하에서 사용하던 `%APPDATA%\KU Regulation Assistant\` 데이터는 0.4.0 이상 실행 시 새 경로로 복사됩니다.

## 보안 원칙

- 고려대 아이디와 비밀번호는 저장하지 않습니다.
- 사용자는 고려대학교 공식 로그인 창에서 직접 로그인합니다.
- 로그인 우회, 권한 우회, 비인가 접근 기능은 없습니다.
- 사용자가 본인 계정으로 접근 가능한 규정만 수집합니다.
- Gemini API Key는 Electron safeStorage로 암호화해서 저장합니다.
- API Key, 쿠키, 세션, DB, 로그, `.env` 파일은 GitHub에 커밋하지 않습니다.

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

개발 모드 실행:

```bash
npm run dev
```

Vite 개발 포트는 `6127`입니다. 이 Windows PC에서 기본 포트 `5173`이 excluded port range에 걸려 `EACCES`가 발생했기 때문에 변경했습니다.

Windows 검증 기록은 [TESTING.md](TESTING.md)에 정리되어 있습니다.
