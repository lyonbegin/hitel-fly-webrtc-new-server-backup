# Realtime Session Server

범용 실시간 영상 세션 엔진 + 원격진료 Wrapper 서버입니다.

이 프로젝트는 기존 채팅/커뮤니티 서버와 호환하기 위한 코드가 아닙니다. 기존 소스에서는 mediasoup 운용 경험만 참고하고, API와 상태 모델은 새로 설계했습니다.

## 구조

- `src/mediasoup`: 범용 SFU 코어. Worker, Worker별 WebRtcServer, Router, Transport, Producer/Consumer 관리.
- `src/realtime`: 범용 Session 계층과 Socket.IO signaling. 서비스 종류에 종속되지 않음.
- `src/telemedicine`: 원격진료 정책 Wrapper. DOCTOR/PATIENT/CONSULTING_DOCTOR/NURSE/GUARDIAN/INTERPRETER 역할 정의.
- `src/auth`: JWT 인증. 개발환경에서만 dev token 발급 가능.

## 핵심 설계

1. 사용자가 직접 `roomId`를 만들지 않습니다.
2. 상위 객체는 `Session`이고, mediasoup `RtcRoom`은 Session이 LIVE가 될 때 내부적으로 자동 생성됩니다.
3. 코어는 1:1, 1:N, N:N을 모두 지원합니다.
4. 원격진료 Wrapper는 기본 진료뿐 아니라 여러 의사/여러 환자가 함께 들어가는 협진 세션도 지원합니다.
5. 각 mediasoup Worker는 `WebRtcServer` 하나를 가지고 UDP/TCP 포트 하나를 공유합니다. WebRtcTransport마다 포트를 하나씩 소비하지 않습니다.
6. 다자 영상에서는 프론트에서 simulcast를 사용하고, 서버의 `rtc:set-preferred-layers`로 소비 레이어를 조절할 수 있습니다.

## 로컬 실행

```bash
cp .env.example .env
npm install
npm run start:dev
```

기본 HTTP/Socket 서버: `http://localhost:8080`
Socket.IO namespace: `/realtime`

### 개발 토큰

production에서는 자동 차단됩니다.

```bash
curl -X POST http://localhost:8080/auth/dev-token \
  -H 'Content-Type: application/json' \
  -d '{"userId":"doctor-1","name":"Doctor","platformRole":"doctor"}'
```

환자 토큰은 `platformRole: user`로 발급할 수 있습니다.

## 원격진료 REST

모든 요청은 `Authorization: Bearer <token>` 필요.

### 진료 생성

`POST /telemedicine/consultations`

```json
{
  "title": "협진 세션",
  "scheduledAt": "2026-09-01T10:00:00+09:00",
  "maxParticipants": 12,
  "participants": [
    { "userId": "doctor-1", "displayName": "주치의", "role": "DOCTOR" },
    { "userId": "doctor-2", "displayName": "협진의", "role": "CONSULTING_DOCTOR" },
    { "userId": "patient-1", "displayName": "환자 A", "role": "PATIENT" },
    { "userId": "patient-2", "displayName": "환자 B", "role": "PATIENT" }
  ]
}
```

### 내 진료

`GET /telemedicine/consultations/me`

### 진료 상태

`GET /telemedicine/consultations/:id`

### 진료 시작 / 종료

`POST /telemedicine/consultations/:id/start`

`POST /telemedicine/consultations/:id/end`

## Socket.IO 연결

```ts
const socket = io(`${SERVER_URL}/realtime`, {
  transports: ['websocket'],
  auth: { token: accessToken }
});
```

## 권장 프론트 흐름

1. `session:join`
2. 카메라/마이크 로컬 점검
3. `session:ready`
4. 주치의가 `session:start`
5. 모든 참가자에게 `session:started`
6. 각 클라이언트 `rtc:join`
7. `rtc:create-transport` send / recv 각각 생성
8. mediasoup-client Device + transports 연결
9. `rtc:produce` audio/video
10. `rtc:new-producer`를 받으면 `rtc:consume`
11. Consumer 생성 후 `rtc:resume-consumer`
12. 종료 시 `session:end` 또는 개인 퇴장 시 `session:leave`

상세 이벤트 계약은 `FRONTEND_CONTRACT.md` 참고.

## Fly.io

`fly.toml`은 최대 4개의 Worker용 WebRtcServer 포트(40000~40003)를 노출합니다. 기본 Worker 수는 2입니다.

필수 secret/env:

- `JWT_SECRET`
- `MEDIASOUP_ANNOUNCED_ADDRESS`: Fly에서 실제 클라이언트에게 광고할 공인 주소/IP
- `MEDIA_NODE_PUBLIC_URL`: 프론트가 Socket.IO로 접속할 이 미디어 노드 URL

Worker 수를 늘리려면 노출된 포트 수 이하에서 `MEDIASOUP_WORKERS`를 변경합니다. 사용자 수 증가 시 포트를 사용자 수만큼 늘리는 방식이 아니라, 향후 Media Node 자체를 수평 확장하는 구조를 사용합니다.
