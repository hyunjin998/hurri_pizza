import type { Locale } from './locale'

/*
 * 사용 설명서(매뉴얼) 문구 (한국어 / 영어).
 * ----------------------------------------------------------------
 * 웹앱·데스크탑 앱의 "사용 방법" 창과 확장의 manual.html이 같이 쓴다.
 * 내용을 고치려면 이 파일만 수정하면 된다 (렌더링은 src/manual/ManualContent.tsx).
 *
 * 섹션 하나 = 제목 + (문단들) + (번호 단계들) + (강조 박스). 전부 선택 항목이다.
 */
export interface ManualSection {
  id: string
  title: string
  paragraphs?: string[]
  steps?: string[]
  callout?: { kind: 'info' | 'warning'; title: string; body: string }
}

export interface ManualStrings {
  title: string
  intro: string
  sections: ManualSection[]
}

const ko: ManualStrings = {
  title: 'Huri Pizza 사용 설명서',
  intro:
    '카메라로 앉은 자세를 살펴보고, 목이 앞으로 나오거나 구부정해지면 알려주는 자세 알리미예요. 영상은 이 기기 안에서만 분석되고 저장되거나 전송되지 않아요.',
  sections: [
    {
      id: 'notification',
      title: '⚠️ 먼저 알림부터 허용해주세요',
      paragraphs: [
        '자세 경고와 응원 메시지는 모두 “알림”으로 전달돼요. 크롬(브라우저)의 알림 설정이 허용되어 있어야 알림을 받을 수 있어요. 알림이 막혀 있으면 감지는 되지만 아무 알림도 오지 않아요.',
      ],
      steps: [
        '크롬 주소창에 chrome://settings/content/notifications 를 입력해 이동해요.',
        '“사이트에서 알림을 보내도록 허용” (또는 “알림 표시 허용”)이 선택되어 있는지 확인해요. “알림을 보내지 않음”이면 알림이 오지 않아요.',
        '웹앱을 쓰는 경우: 위 화면의 “알림 전송이 허용되지 않음” 목록에 Huri Pizza 주소가 있으면 삭제하거나 “허용” 목록으로 옮겨요. 또는 주소창 왼쪽 자물쇠 아이콘 → 알림 → 허용.',
        'Windows: 설정 → 시스템 → 알림에서 Google Chrome을 켜고, “방해 금지 / 집중 지원”을 꺼요.',
        'macOS: 시스템 설정 → 알림 → Google Chrome에서 “알림 허용”을 켜고, “집중 모드 / 방해 금지”를 꺼요.',
      ],
      callout: {
        kind: 'warning',
        title: '알림이 안 오나요?',
        body: '① 크롬 알림 허용 → ② 운영체제(Windows/macOS) 알림에서 Chrome 허용 → ③ 방해 금지/집중 모드 해제, 이 세 가지를 순서대로 확인해보세요. 데스크탑(.exe/.dmg) 앱은 운영체제 알림 설정에서 Huri Pizza를 허용해야 해요.',
      },
    },
    {
      id: 'start-extension',
      title: '시작하기 — 크롬 확장 프로그램',
      steps: [
        '크롬 툴바의 Huri Pizza 아이콘을 눌러요.',
        '“백그라운드 감시 켜기”를 누르고, 카메라 권한 창이 뜨면 “허용”을 눌러요. (팝업에서 권한 창이 안 뜨면 새 탭이 열리니 거기서 허용해요.)',
        '열린 “내 모습” 창에서 어깨와 얼굴이 모두 보이게 자리를 잡아요.',
        '바른 자세로 앉은 채 “바른 자세로 기준 설정”을 눌러요. 1~2초 뒤 “보정 완료”가 뜨면 끝이에요.',
        '이제 이 창은 닫아도 돼요. 크롬이 켜져 있는 동안 백그라운드에서 계속 감지해요.',
      ],
    },
    {
      id: 'start-web',
      title: '시작하기 — 웹앱 / 데스크탑 앱',
      steps: [
        '“카메라 시작”을 누르고 카메라 권한과 알림 권한을 모두 “허용”해요.',
        '바른 자세로 앉은 채 “바른 자세로 기준 설정”을 눌러요.',
        '웹앱은 이 페이지(탭)가 열려 있는 동안에만 동작해요. 탭이 오래 가려져 있으면 크롬이 동작을 늦출 수 있으니, 백그라운드에서 계속 쓰려면 확장 프로그램이나 데스크탑 앱을 추천해요.',
      ],
    },
    {
      id: 'status',
      title: '자세 상태 보는 법',
      paragraphs: [
        '기준 자세와 비교해서 귀와 어깨의 위치가 얼마나 달라졌는지로 판단해요.',
        '양호 — 기준 자세와 비슷해요. / 주의 — 고개가 앞으로 기울기 시작했어요. / 자세 점검 — 고개가 많이 기울었어요. / 자리 비움 — 카메라에 사람이 보이지 않아요. / 보정 필요 — 아직 기준 자세를 설정하지 않았어요.',
      ],
    },
    {
      id: 'alerts',
      title: '알림 종류',
      paragraphs: [
        '자세 경고: “주의” 또는 “자세 점검” 상태가 3초 이상 이어지면 알려줘요. 알림이 너무 자주 오지 않도록 최소 1분 간격을 둬요.',
        '응원 알림: 바른 자세를 5분 연속 유지할 때마다(5분, 10분, 15분…) 재미있는 문구로 응원해줘요. 제목에 유지한 시간이 함께 표시돼요. 잠깐(5초 미만) 흐트러진 건 기록이 끊기지 않아요.',
        '자리를 30초 넘게 비우면 연속 기록이 초기화돼요.',
      ],
    },
    {
      id: 'tips',
      title: '더 정확하게 쓰는 팁',
      steps: [
        '카메라를 눈높이 정면에 두고, 어깨와 귀가 모두 화면에 들어오게 해요.',
        '얼굴이 밝게 보이도록 조명을 켜주세요. 역광은 피해요.',
        '의자·모니터 위치를 바꿨다면 “기준 자세 다시 설정”을 눌러 다시 보정해요.',
        '배터리를 아끼려고 자세에 따라 감지 주기를 자동으로 조절해요. 자리를 비우면 더 천천히 확인해요.',
      ],
    },
    {
      id: 'troubleshooting',
      title: '문제 해결',
      steps: [
        '카메라가 안 켜져요 → Zoom 등 다른 프로그램이 카메라를 쓰고 있는지 확인하고, chrome://settings/content/camera 에서 차단 목록을 확인해요.',
        '자세가 계속 “자리 비움”이에요 → 어깨와 얼굴이 화면에 보이는지, 조명이 충분한지 확인해요.',
        '알림이 안 와요 → 맨 위의 “알림부터 허용해주세요”를 따라 확인해요.',
        '언어를 바꾸고 싶어요 → 화면 오른쪽 위 🌐 버튼을 눌러요.',
      ],
      callout: {
        kind: 'info',
        title: '참고',
        body: '이 앱의 결과는 자세를 확인하기 위한 참고용이며 의료적인 진단이 아니에요.',
      },
    },
  ],
}

const en: ManualStrings = {
  title: 'Huri Pizza User Guide',
  intro:
    'Huri Pizza watches your sitting posture through your camera and nudges you when your neck juts forward or you start to slouch. Video is analyzed only on this device and is never stored or sent anywhere.',
  sections: [
    {
      id: 'notification',
      title: '⚠️ First, allow notifications',
      paragraphs: [
        'Posture warnings and cheer messages are delivered as notifications. Chrome (the browser) must be allowed to show notifications, otherwise detection still works but you will not receive any alerts.',
      ],
      steps: [
        'Open chrome://settings/content/notifications in the address bar.',
        'Make sure “Sites can ask to send notifications” (or “Allow notifications”) is selected. “Don’t allow sites to send notifications” blocks all alerts.',
        'Using the web app? If the Huri Pizza address appears under “Not allowed to send notifications”, remove it or move it to “Allowed”. You can also click the lock icon left of the address bar → Notifications → Allow.',
        'Windows: Settings → System → Notifications, turn on Google Chrome and turn off Do Not Disturb / Focus Assist.',
        'macOS: System Settings → Notifications → Google Chrome, turn on “Allow notifications” and turn off Focus / Do Not Disturb.',
      ],
      callout: {
        kind: 'warning',
        title: 'Not getting notifications?',
        body: 'Check in this order: ① Chrome notifications allowed → ② Chrome allowed in your OS notification settings → ③ Do Not Disturb / Focus mode off. For the desktop (.exe/.dmg) app, allow Huri Pizza in your OS notification settings.',
      },
    },
    {
      id: 'start-extension',
      title: 'Getting started — Chrome extension',
      steps: [
        'Click the Huri Pizza icon in the Chrome toolbar.',
        'Press “Start background monitoring” and click “Allow” when Chrome asks for camera access. (If the prompt does not appear in the popup, a new tab opens — allow it there.)',
        'In the camera window, position yourself so your face and shoulders are visible.',
        'Sit up straight and press “Set baseline (sit up straight)”. After a second or two you will see “Calibrated”.',
        'You can now close that window. Detection keeps running in the background while Chrome is open.',
      ],
    },
    {
      id: 'start-web',
      title: 'Getting started — web app / desktop app',
      steps: [
        'Press “Start camera” and allow both camera and notification permissions.',
        'Sit up straight and press “Set baseline (sit up straight)”.',
        'The web app only works while its tab is open. Chrome may slow down tabs that stay hidden for a long time, so for continuous background use we recommend the extension or the desktop app.',
      ],
    },
    {
      id: 'status',
      title: 'Reading your posture status',
      paragraphs: [
        'Your posture is judged by how far your ear and shoulder positions drift from your baseline.',
        'Good — close to your baseline. / Caution — your head is starting to lean forward. / Check posture — your head is leaning far forward. / Away — nobody is visible on camera. / Setup needed — no baseline has been set yet.',
      ],
    },
    {
      id: 'alerts',
      title: 'Types of notifications',
      paragraphs: [
        'Posture warning: sent when “Caution” or “Check posture” lasts 3 seconds or more, with at least 1 minute between warnings.',
        'Cheer: every 5 minutes of continuous good posture (5, 10, 15 min…) you get a fun encouragement message, with the streak time shown in the title. A slip shorter than 5 seconds does not break your streak.',
        'If you leave the desk for more than 30 seconds, the streak resets.',
      ],
    },
    {
      id: 'tips',
      title: 'Tips for better accuracy',
      steps: [
        'Place the camera at eye level, facing you, with both ears and shoulders in frame.',
        'Keep your face well lit and avoid backlighting.',
        'If you move your chair or monitor, press “Reset baseline” to calibrate again.',
        'To save battery, detection frequency adapts to your posture and slows down when you are away.',
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      steps: [
        'Camera will not start → check whether another app (Zoom, etc.) is using it, and review the blocked list at chrome://settings/content/camera.',
        'Always shows “Away” → make sure your face and shoulders are visible and the room is bright enough.',
        'No notifications → follow “First, allow notifications” at the top.',
        'Want another language? → press the 🌐 button at the top right.',
      ],
      callout: {
        kind: 'info',
        title: 'Note',
        body: 'Results are for reference only and are not a medical diagnosis.',
      },
    },
  ],
}

export const MANUALS: Record<Locale, ManualStrings> = { ko, en }

export function getManual(locale: Locale): ManualStrings {
  return MANUALS[locale]
}
