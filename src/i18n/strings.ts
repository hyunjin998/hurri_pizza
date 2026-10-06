import type { Locale } from './locale'

/*
 * 화면/알림에 쓰는 모든 문구 (한국어 / 영어).
 * ----------------------------------------------------------------
 * - 응원 알림 문구는 cheerMessages.ts에 따로 있다.
 * - 새 문구를 추가하면 Strings 인터페이스에 키를 넣고 ko/en 둘 다 채워야
 *   타입 에러가 나지 않는다 (번역 누락 방지).
 * - 자세 상태 키는 PostureStatus와 같은 문자열을 쓴다 (postureEngine.ts).
 */
type StatusKey = 'uncalibrated' | 'calibrating' | 'good' | 'warning' | 'danger'

export interface Strings {
  appName: string
  languageButtonLabel: string

  /* 자세 상태 */
  statusLabel: Record<StatusKey, string>
  statusDescription: Record<StatusKey, string>
  absentLabel: string
  absentDescription: string

  /* 공통 버튼/상태 */
  waiting: string
  off: string
  calibrate: string
  calibrateAgain: string
  calibratingButton: string

  /* 알림 */
  alertTitleWarning: string
  alertTitleDanger: string

  /* 확장 팝업 */
  popupEnable: string
  popupDisable: string
  popupShowPreview: string
  popupPermissionTab: string
  popupCalibrated: string

  /* 미리보기 창 */
  previewTitle: string
  previewCalibrated: string
  previewHintDone: string
  previewHintSetup: string

  /* 권한 안내 탭 */
  permissionTitle: string
  permissionBody: string
  permissionButton: string
  permissionRequesting: string
  permissionGranted: string

  /* 카메라 에러 */
  cameraNotAllowed: string
  cameraNotFound: string
  cameraNotReadable: string
  cameraSecurity: string
  cameraUnknown: (errorName: string) => string

  /* 사용 설명서 / 알림 안내 */
  manualButton: string
  manualClose: string
  popupManual: string
  notifBlocked: string
  notifDefault: string
  notifAllowButton: string
  notifGuideLink: string

  /* 웹앱 */
  webTagline: string
  webCameraPlaceholderTop: string
  webCameraPlaceholderBottom: string
  webStartCamera: string
  webModelLoading: string
  webStopCamera: string
  webDetectingPerson: string
  webCurrentPosture: string
  webRelative: string
  webHowTitle: string
  webHowBody: string
  webDisclaimer: string
  webModelLoadError: string
  webModelNotReady: string
}

const ko: Strings = {
  appName: 'Huri Pizza',
  languageButtonLabel: '언어 변경',

  statusLabel: {
    uncalibrated: '보정 필요',
    calibrating: '보정 중',
    good: '양호',
    warning: '주의',
    danger: '자세 점검',
  },
  statusDescription: {
    uncalibrated: '먼저 바른 자세로 기준을 설정해주세요.',
    calibrating: '바른 자세를 유지한 채 잠시만 기다려주세요...',
    good: '현재 자세가 비교적 안정적이에요.',
    warning: '고개가 기준 자세보다 앞으로 기울었어요.',
    danger: '고개가 기준 자세보다 많이 기울었어요. 자세를 한번 바꿔보세요.',
  },
  absentLabel: '자리 비움',
  absentDescription: '카메라에 사람이 보이지 않아요. 감지를 천천히 하며 배터리를 아끼는 중이에요.',

  waiting: '감지 대기 중...',
  off: '꺼져 있음',
  calibrate: '바른 자세로 기준 설정',
  calibrateAgain: '기준 자세 다시 설정',
  calibratingButton: '보정 중...',

  alertTitleWarning: '자세를 점검해주세요',
  alertTitleDanger: '자세가 많이 흐트러졌어요 🙆',

  popupEnable: '백그라운드 감시 켜기',
  popupDisable: '백그라운드 감시 끄기',
  popupShowPreview: '내 모습 보기',
  popupPermissionTab:
    '팝업에서는 카메라 권한 창이 안 뜰 수 있어요. 새 탭을 열어드릴게요 — 거기서 허용해주세요.',
  popupCalibrated: '✅ 보정 완료! 이제부터 이 자세를 기준으로 알려드려요.',

  previewTitle: 'Huri Pizza - 내 모습 보기',
  previewCalibrated:
    '✅ 보정 완료! 이제부터 이 자세를 기준으로 알려드릴게요. 이 창은 닫으셔도 감지가 계속돼요.',
  previewHintDone:
    '설정이 끝났어요. 이 창은 닫으셔도 괜찮아요 — 백그라운드에서 계속 자세를 감지하고, 자세가 흐트러지면 알림으로 알려드릴게요.',
  previewHintSetup:
    '화면에 어깨와 얼굴이 잘 보이도록 자리를 잡은 다음, 바른 자세로 앉은 상태에서 아래 버튼을 눌러주세요.',

  permissionTitle: '카메라 권한이 필요해요',
  permissionBody:
    'Huri Pizza가 백그라운드에서 자세를 감지하려면 카메라 접근 권한이 필요합니다. 아래 버튼을 누르면 크롬이 권한 요청 팝업을 보여줘요 — ‘허용’을 눌러주세요.',
  permissionButton: '카메라 권한 허용하기',
  permissionRequesting: '요청 중...',
  permissionGranted:
    '카메라 권한이 허용됐어요. 이 탭은 닫으셔도 되고, 확장 아이콘을 눌러 감시를 시작해주세요.',

  cameraNotAllowed:
    '카메라 권한이 거부되어 있어요. 이 페이지에서 다시 시도하거나, chrome://settings/content/camera 에서 이 확장이 차단 목록에 있으면 삭제해주세요.',
  cameraNotFound: '카메라 장치를 찾을 수 없어요. 웹캠이 연결되어 있는지 확인해주세요.',
  cameraNotReadable:
    '카메라를 열 수 없어요. 다른 프로그램(Zoom, 다른 브라우저 탭 등)이 카메라를 사용 중이면 종료하고 다시 시도해주세요.',
  cameraSecurity: '보안 설정 때문에 카메라 접근이 차단됐어요.',
  cameraUnknown: (name) =>
    `카메라 권한 요청에 실패했어요${name ? ` (${name})` : ''}. 다시 시도해주세요.`,

  manualButton: '사용 방법',
  manualClose: '닫기',
  popupManual: '사용 방법 · 알림 설정',
  notifBlocked:
    '브라우저 알림이 차단되어 있어서 알림을 받을 수 없어요. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꿔주세요.',
  notifDefault: '알림이 아직 허용되지 않았어요. 자세 경고와 응원 메시지를 받으려면 알림을 허용해주세요.',
  notifAllowButton: '알림 허용하기',
  notifGuideLink: '자세히 보기',

  webTagline: '카메라로 현재 자세를 확인해보세요.',
  webCameraPlaceholderTop: '카메라를 시작하면',
  webCameraPlaceholderBottom: '자세 분석을 시작합니다.',
  webStartCamera: '카메라 시작',
  webModelLoading: '모델 준비 중...',
  webStopCamera: '카메라 종료',
  webDetectingPerson: '사람을 인식하는 중...',
  webCurrentPosture: '현재 자세',
  webRelative: '기준 자세 대비',
  webHowTitle: '측정 방법',
  webHowBody:
    '먼저 바른 자세로 앉은 상태에서 ‘바른 자세로 기준 설정’을 눌러 나만의 기준을 만드세요. 이후 귀와 어깨의 위치가 그 기준에서 얼마나 벗어났는지를 비교해 자세를 판단합니다.',
  webDisclaimer: '※ 이 결과는 자세 상태를 확인하기 위한 참고용이며 의료적인 진단이 아닙니다.',
  webModelLoadError: '자세 분석 모델을 불러오지 못했습니다. 브라우저 콘솔을 확인해주세요.',
  webModelNotReady: '자세 분석 모델이 아직 준비되지 않았습니다.',
}

const en: Strings = {
  appName: 'Huri Pizza',
  languageButtonLabel: 'Change language',

  statusLabel: {
    uncalibrated: 'Setup needed',
    calibrating: 'Calibrating',
    good: 'Good',
    warning: 'Caution',
    danger: 'Check posture',
  },
  statusDescription: {
    uncalibrated: 'Set your baseline first while sitting up straight.',
    calibrating: 'Hold your good posture for a moment...',
    good: 'Your posture looks steady.',
    warning: 'Your head is leaning forward from your baseline.',
    danger: 'Your head is leaning far forward. Try adjusting your posture.',
  },
  absentLabel: 'Away',
  absentDescription: "I can't see anyone on camera. Checking less often to save battery.",

  waiting: 'Waiting for detection...',
  off: 'Off',
  calibrate: 'Set baseline (sit up straight)',
  calibrateAgain: 'Reset baseline',
  calibratingButton: 'Calibrating...',

  alertTitleWarning: 'Time for a posture check',
  alertTitleDanger: 'Your posture is slipping 🙆',

  popupEnable: 'Start background monitoring',
  popupDisable: 'Stop background monitoring',
  popupShowPreview: 'Show my camera',
  popupPermissionTab:
    "The camera prompt may not appear in a popup. We'll open a new tab — please allow it there.",
  popupCalibrated: "✅ Calibrated! I'll use this posture as your baseline from now on.",

  previewTitle: 'Huri Pizza - My camera',
  previewCalibrated:
    "✅ Calibrated! I'll use this posture as your baseline. You can close this window — detection keeps running.",
  previewHintDone:
    "You're all set. You can close this window — detection keeps running in the background and you'll get a notification when your posture slips.",
  previewHintSetup:
    'Position yourself so your face and shoulders are visible, sit up straight, then press the button below.',

  permissionTitle: 'Camera permission needed',
  permissionBody:
    'Huri Pizza needs camera access to detect your posture in the background. Press the button below and click “Allow” when Chrome asks.',
  permissionButton: 'Allow camera access',
  permissionRequesting: 'Requesting...',
  permissionGranted:
    'Camera access granted. You can close this tab and click the extension icon to start monitoring.',

  cameraNotAllowed:
    'Camera permission was denied. Try again from this page, or remove this extension from the blocked list at chrome://settings/content/camera.',
  cameraNotFound: "Couldn't find a camera. Please check that your webcam is connected.",
  cameraNotReadable:
    "Couldn't open the camera. If another app (Zoom, another browser tab, etc.) is using it, close it and try again.",
  cameraSecurity: 'Camera access was blocked by a security setting.',
  cameraUnknown: (name) =>
    `Camera permission request failed${name ? ` (${name})` : ''}. Please try again.`,

  manualButton: 'How to use',
  manualClose: 'Close',
  popupManual: 'Guide & notification setup',
  notifBlocked:
    "Browser notifications are blocked, so you won't receive alerts. Click the lock icon left of the address bar → Notifications → Allow.",
  notifDefault:
    'Notifications are not allowed yet. Allow them to receive posture warnings and cheer messages.',
  notifAllowButton: 'Allow notifications',
  notifGuideLink: 'Learn more',

  webTagline: 'Check your current posture with your camera.',
  webCameraPlaceholderTop: 'Start the camera',
  webCameraPlaceholderBottom: 'to begin posture analysis.',
  webStartCamera: 'Start camera',
  webModelLoading: 'Loading model...',
  webStopCamera: 'Stop camera',
  webDetectingPerson: 'Looking for a person...',
  webCurrentPosture: 'Current posture',
  webRelative: 'Relative to baseline',
  webHowTitle: 'How it works',
  webHowBody:
    'Sit up straight and press “Set baseline (sit up straight)” to create your own reference. After that, your posture is judged by how far your ear and shoulder positions drift from that baseline.',
  webDisclaimer: '* Results are for reference only and are not a medical diagnosis.',
  webModelLoadError: "Couldn't load the pose model. Please check the browser console.",
  webModelNotReady: 'The pose model is not ready yet.',
}

export const STRINGS: Record<Locale, Strings> = { ko, en }

export function getStrings(locale: Locale): Strings {
  return STRINGS[locale]
}
