# Frontend Contract

모든 Socket.IO 이벤트는 `/realtime` namespace에서 동작하며, handshake `auth.token`에 JWT가 필요합니다.

응답 공통 형태:

```ts
type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

## Session 이벤트

### `session:join`
입력: `{ sessionId }`

사용자를 예약/초대된 Session에 입장시킵니다. 사용자가 임의의 WebRTC room을 만들 수 없습니다.

### `session:ready`
입력: `{ sessionId, ready: boolean }`

로컬 카메라/마이크/네트워크 점검 후 준비 상태를 전달합니다.

### `session:start`
입력: `{ sessionId }`

`manageSession` 권한과 Host 권한이 있는 참가자만 실행할 수 있습니다. 이 시점에 내부 mediasoup Router가 생성됩니다.

### `session:end`
입력: `{ sessionId }`

전체 진료/세션 종료. Router, Transport, Producer, Consumer를 닫습니다.

### `session:leave`
입력: `{ sessionId }`

개인 퇴장.

## RTC 이벤트

### `rtc:join`
입력: `{ sessionId, resume?: boolean }`

Session이 LIVE일 때만 가능합니다. 성공 응답에는 `routerRtpCapabilities`, `existingProducers`가 포함됩니다.

### `rtc:create-transport`
입력: `{ sessionId, direction: 'send' | 'recv' }`

반환된 `transportOptions`를 `mediasoup-client`의 `device.createSendTransport()` 또는 `device.createRecvTransport()`에 사용합니다.

### `rtc:connect-transport`
입력: `{ sessionId, transportId, dtlsParameters }`

### `rtc:produce`
입력:

```ts
{
  sessionId,
  transportId,
  kind: 'audio' | 'video',
  rtpParameters,
  appData: { source: 'microphone' | 'camera' | 'screen' }
}
```

새 Producer는 다른 참가자에게 `rtc:new-producer`로 통지됩니다.

### `rtc:consume`
입력: `{ sessionId, transportId, producerId, rtpCapabilities }`

Consumer는 서버에서 paused 상태로 생성됩니다.

### `rtc:resume-consumer`
입력: `{ sessionId, consumerId }`

브라우저 Consumer 생성 직후 호출합니다.

### 다자통화 최적화

- `rtc:set-preferred-layers`: `{ sessionId, consumerId, spatialLayer, temporalLayer? }`
- `rtc:pause-consumer`
- `rtc:pause-producer`
- `rtc:resume-producer`
- `rtc:close-producer`

프론트에서는 영상 Producer에 simulcast encodings를 사용하는 것을 권장합니다. 메인 화자/선택 영상은 높은 spatial layer, 썸네일은 낮은 layer로 전환합니다.

## 서버 Push 이벤트

- `connection:ready`
- `connection:error`
- `session:participant-joined`
- `session:participant-ready`
- `session:participant-disconnected`
- `session:participant-left`
- `session:started`
- `session:ended`
- `rtc:peer-joined`
- `rtc:peer-resumed`
- `rtc:peer-left`
- `rtc:new-producer`
- `rtc:producer-paused`
- `rtc:producer-resumed`
- `rtc:producer-closed`

### `rtc:restart-ice`
입력: `{ sessionId, transportId }`

네트워크 전환(Wi-Fi/LTE 등) 시 서버에서 새 ICE parameters를 발급받고 `mediasoup-client transport.restartIce()`에 적용합니다.

### `rtc:close-transport`
입력: `{ sessionId, transportId }`

해당 send/recv transport를 닫습니다. 새 transport를 만들기 전 기존 transport를 정리할 때 사용합니다.
