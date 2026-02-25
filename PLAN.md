# Mini Claude Code Slack Bot - 구현 계획

## Context
Slack에서 Claude Code를 사용할 수 있는 봇을 만듭니다. 사용자가 슬랙에서 메시지를 보내면 Claude Code SDK가 처리하고, 결과를 슬랙 스레드에 답변합니다. 기존 오픈소스([mpociot/claude-code-slack-bot](https://github.com/mpociot/claude-code-slack-bot))를 참고하되, 핵심 기능만 담은 미니 버전을 만듭니다.

## 기술 스택
- **Runtime**: Node.js + TypeScript
- **Slack**: `@slack/bolt` (Socket Mode - 별도 서버/ngrok 불필요)
- **AI**: `@anthropic-ai/claude-code` SDK (`query` 함수)
- **빌드**: `tsx` (개발), `tsc` (프로덕션)

## 핵심 기능
1. **DM 지원** - 봇에 직접 메시지 보내기
2. **채널 멘션** - `@봇이름` 으로 호출
3. **스레드 컨텍스트** - 스레드 내 대화 맥락 유지 (session resume)
4. **스트리밍 응답** - "생각 중..." → 도구 사용 표시 → 최종 답변
5. **작업 디렉토리 설정** - `cwd /path/to/project` 명령으로 Claude Code 작업 폴더 지정

## 프로젝트 구조
```
mini-claude-slackbot/
├── src/
│   ├── app.ts              # 엔트리포인트 (Slack App 초기화 + 시작)
│   ├── claude.ts           # Claude Code SDK 래퍼 (query 호출, 세션 관리)
│   └── slack-handler.ts    # Slack 이벤트 핸들러 (메시지, 멘션 처리)
├── .env.example            # 환경변수 템플릿
├── package.json
├── tsconfig.json
└── README.md               # Slack 앱 생성 가이드 포함
```

## 구현 상세

### 1. `package.json`
의존성:
- `@slack/bolt` ^4.4.0
- `@anthropic-ai/claude-code` ^1.0.35
- `dotenv` ^16.6.0
- dev: `tsx`, `typescript`, `@types/node`

### 2. `src/app.ts` - 엔트리포인트
- dotenv 로드
- Slack `App` 생성 (socketMode: true)
- ClaudeHandler, SlackHandler 초기화
- 이벤트 핸들러 등록
- `app.start()` 호출

### 3. `src/claude.ts` - Claude Code SDK 래퍼
- `query()` 함수를 사용하여 Claude Code 호출
- 세션 관리 (Map 기반, `resume` 옵션으로 대화 이어가기)
- `includePartialMessages` 옵션으로 스트리밍
- `permissionMode: 'bypassPermissions'` (봇이라 사용자 확인 불가)
- 작업 디렉토리 (`cwd`) 옵션 지원
- 비활성 세션 정리 (30분)

### 4. `src/slack-handler.ts` - Slack 이벤트 핸들러
- `app.message()` → DM 처리
- `app.event('app_mention')` → 채널 멘션 처리
- `cwd` 명령 파싱 (작업 디렉토리 설정/조회)
- 응답 흐름:
  1. "🤔 생각 중..." 메시지 전송
  2. Claude SDK 스트리밍 순회
  3. 도구 사용 시 간단히 표시 (📝 편집, 🖥️ 명령 실행 등)
  4. 최종 텍스트 답변 전송
  5. 상태 메시지를 "✅ 완료"로 업데이트
- AbortController로 중복 요청 취소

### 5. `.env.example`
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
ANTHROPIC_API_KEY=...        # Claude Code 구독 없을 때만 필요
```

## Slack 앱 설정 (사용자가 직접 수행)
1. https://api.slack.com/apps 에서 "Create New App" → "From scratch"
2. **Socket Mode** 활성화 → App Token 생성 (`connections:write` scope)
3. **OAuth & Permissions**에서 Bot Token Scopes 추가:
   - `app_mentions:read`, `chat:write`, `im:read`, `im:write`, `im:history`, `channels:history`
4. **Event Subscriptions** 활성화 → Bot Events 추가:
   - `app_mention`, `message.im`
5. **App Home** → Messages Tab 활성화
6. 워크스페이스에 설치 → Bot Token 복사

## 검증 방법
1. `npm install` → `npm run dev` 로 봇 시작
2. Slack에서 봇에 DM으로 `cwd /path/to/project` 전송 → 작업 디렉토리 설정 확인
3. `안녕하세요` 등 메시지 전송 → Claude 응답 확인
4. 채널에서 `@봇이름 이 코드 설명해줘` → 스레드에 답변 확인
5. 스레드에서 추가 질문 → 컨텍스트 유지 확인
