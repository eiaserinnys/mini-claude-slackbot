# Mini Claude Code Slack Bot

Slack에서 Claude Code를 사용할 수 있는 **미니멀 봇**입니다. [mpociot/claude-code-slack-bot](https://github.com/mpociot/claude-code-slack-bot)을 참고하되, 핵심 기능만 담아 가볍게 구현했습니다.

이 프로젝트 자체가 **Claude Code로 계획부터 구현까지 진행한 과정**을 기록한 리포지토리이기도 합니다.

- [PLAN.md](./PLAN.md) — 구현 전 작성한 작업 계획
- [SESSION_LOG.md](./SESSION_LOG.md) — Claude Code와의 실제 대화 내역

## 주요 기능

- **DM 대화** — 봇에 직접 메시지를 보내면 Claude Code가 답변
- **채널 멘션** — `@봇이름` 으로 호출하면 스레드에 답변
- **스레드 컨텍스트 유지** — 같은 스레드 내에서 대화 맥락을 이어감 (session resume)
- **작업 상태 표시** — "생각 중..." → 도구 사용 현황 → "완료" 순으로 상태 업데이트
- **작업 디렉토리 설정** — `cwd /path/to/project` 명령으로 Claude Code가 작업할 폴더 지정

## 기술 스택

| 구분 | 사용 |
|------|------|
| Runtime | Node.js + TypeScript |
| Slack | `@slack/bolt` (Socket Mode) |
| AI | `@anthropic-ai/claude-code` SDK |
| 빌드 | `tsx` (개발) / `tsc` (프로덕션) |

## 설치 및 실행

### 0. 가장 쉬운 방법

Claude Code가 설치되어 있다면, 아래 한 줄이면 됩니다:

```
이 리포(https://github.com/eiaserinnys/mini-claude-slackbot)를 clone하고 README.md를 읽고 설치해줘
```

### 1. Slack 앱 생성

1. https://api.slack.com/apps → **Create New App** → **From scratch**
2. **Socket Mode** 활성화 → App Token 생성 (scope: `connections:write`)
3. **OAuth & Permissions** → Bot Token Scopes 추가:
   - `app_mentions:read`, `chat:write`, `im:read`, `im:write`, `im:history`, `channels:history`
4. **Event Subscriptions** 활성화 → Bot Events 추가:
   - `app_mention`, `message.im`
5. **App Home** → Messages Tab 활성화
6. 워크스페이스에 설치 → Bot Token 복사

### 2. 프로젝트 설정

```bash
git clone https://github.com/eiaserinnys/mini-claude-slackbot.git
cd mini-claude-slackbot
npm install
```

### 3. 환경변수

```bash
cp .env.example .env
```

`.env` 파일에 토큰 값 입력:

```
SLACK_BOT_TOKEN=xoxb-...        # OAuth & Permissions 페이지
SLACK_APP_TOKEN=xapp-...        # Socket Mode App Token
SLACK_SIGNING_SECRET=...        # Basic Information 페이지
ANTHROPIC_API_KEY=...           # Claude Code 구독 없을 때만 필요
```

### 4. 실행

```bash
# 개발
npm run dev

# 프로덕션
npm run build
npm start
```

## 사용법

| 명령 | 설명 |
|------|------|
| DM으로 메시지 전송 | 봇이 Claude Code로 처리 후 답변 |
| `@봇이름 질문` | 채널에서 멘션하면 스레드에 답변 |
| `cwd /path/to/project` | Claude Code 작업 디렉토리 설정 |
| `cwd` | 현재 설정된 작업 디렉토리 확인 |

## 프로젝트 구조

```
src/
├── app.ts              # 엔트리포인트 (Slack App 초기화)
├── claude.ts           # Claude Code SDK 래퍼 (세션 관리, 스트리밍)
└── slack-handler.ts    # Slack 이벤트 핸들러 (DM, 멘션, cwd)
```

## 만든 과정

이 프로젝트는 Claude Code에게 계획을 세우게 하고, 그 계획을 바로 구현하도록 하는 방식으로 만들어졌습니다.

1. **계획 수립** — Claude Code에게 요구사항을 설명하고 [구현 계획](./PLAN.md)을 작성
2. **구현** — 계획을 그대로 전달하여 코드 생성 + 타입 오류 수정까지 자동 완료
3. **설정 지원** — Slack 앱 설정 과정에서 발생한 에러(`invalid_auth`)도 함께 디버깅

전체 대화 내역은 [SESSION_LOG.md](./SESSION_LOG.md)에서 확인할 수 있습니다.
