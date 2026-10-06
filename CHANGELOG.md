# 릴리즈 노트 / Release Notes

## v0.2.0

### 한국어

**새 기능**
- 🎉 **응원 알림**: 바른 자세를 5분 연속 유지할 때마다(5분, 10분, 15분…) 재미있는 문구로 응원 알림을 보내줘요. 알림 제목에 유지한 시간이 함께 표시돼요. (거북이·피자 드립 20종, 유지 시간에 따라 문구가 달라져요)
- 🌐 **한국어 / English 전환**: 웹앱, 확장 프로그램(팝업·미리보기·권한 안내), 알림 문구까지 모두 두 언어를 지원해요. 처음엔 브라우저 언어를 따라가고, 우상단 🌐 버튼으로 바꿀 수 있어요.
- 자리를 비우면 화면에 "자리 비움"으로 표시돼요.
- 📖 **사용 설명서 페이지**: 웹앱의 '사용 방법' 버튼과 확장 팝업의 '사용 방법 · 알림 설정' 링크로 열 수 있어요. 알림을 받으려면 크롬(브라우저) 알림이 허용되어 있어야 한다는 안내와 설정 방법이 들어 있어요.
- 웹앱에서 알림이 꺼져 있으면 상단에 안내 배너가 떠요.

**개선**
- 🔋 **배터리 사용량 감소**: 자세 상태에 맞춰 감지 주기를 자동 조절해요 (양호 1초 / 주의 0.5초 / 자리 비움 2~10초). 카메라도 낮은 해상도·프레임으로 열고, 웹앱은 창이 가려져 있으면 화면 그리기를 건너뛰어요.
- 자리를 비운 상태에서 이전 자세 상태로 경고·응원 알림이 가던 문제를 막았어요.
- 보정 버튼을 누른 채 자리를 비우면 15초 뒤 자동 취소돼요.
- Electron 앱: 창이 최소화돼도 감지·알림이 제때 동작해요.
- Electron 앱: 알림 권한이 거부되던 문제를 고쳤어요.

**기타**
- 응원 문구는 `src/i18n/cheerMessages.ts`, 화면 문구는 `src/i18n/strings.ts`에서 수정할 수 있어요.

### English

**New**
- 🎉 **Cheer notifications**: Keep good posture for 5 minutes straight (and every 5 minutes after) and get a fun encouragement message, with the streak time shown in the title (20 turtle- and pizza-themed lines that change with how long you've held it).
- 🌐 **Korean / English**: The web app, extension (popup, preview window, permission page) and notifications are fully bilingual. It follows your browser language at first; switch any time with the 🌐 button.
- An "Away" status is shown when nobody is in front of the camera.
- 📖 **User guide page**: open it from the "How to use" button in the web app or the "Guide & notification setup" link in the extension popup. It explains that Chrome notifications must be allowed to receive alerts, and how to enable them.
- The web app shows a banner when notifications are turned off.

**Improved**
- 🔋 **Lower battery usage**: Detection frequency now adapts to your posture state (good 1s / caution 0.5s / away 2–10s). The camera opens at lower resolution and frame rate, and the web app skips drawing while the window is hidden.
- No more warning or cheer notifications based on a stale posture while you're away from the desk.
- Calibration is cancelled automatically after 15 seconds if no one is in view.
- Desktop (Electron) app: detection and notifications keep running on time when the window is minimized.
- Desktop (Electron) app: fixed notification permission being denied.
