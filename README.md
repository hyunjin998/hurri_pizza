# Huri Pizza

카메라로 거북목/구부정한 자세를 감지해서 알려주는 프로그램입니다.
브라우저에서 도는 웹앱과, 백그라운드에서 계속 감시하는 크롬 확장
두 가지 형태로 쓸 수 있습니다.

## 설치해서 쓰기 (사용자용)

일반 사용자는 **GitHub 계정이나 토큰이 필요 없습니다.** 아래 중 편한 방법으로 바로 쓰세요.

| 방법 | 설치 | 특징 |
| --- | --- | --- |
| 크롬 확장 (추천) | Chrome 웹 스토어에서 **Huri Pizza**를 검색해 "Chrome에 추가" | 크롬이 켜져 있는 동안 백그라운드에서 계속 감시 |
| 데스크탑 앱 | 이 저장소의 [Releases](https://github.com/hyunjin998/hurri_pizza/releases) 페이지에서 운영체제에 맞는 파일 다운로드 (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`) | 로그인 없이 누구나 다운로드 가능. 크롬 없이 독립 실행 |
| 웹앱 | 배포된 웹 주소 접속 | 탭이 열려 있는 동안만 동작 |

- 처음 켜면 카메라 권한을 **허용**하고, 바른 자세로 앉아 **"바른 자세로 기준 설정"** 을 누르세요.
- 알림을 받으려면 크롬(브라우저)과 운영체제의 알림 설정이 허용되어 있어야 합니다. 자세한 방법은 앱 안의 **사용 방법** 페이지를 보세요.
- 데스크탑 앱은 코드 서명이 되어 있지 않아 처음 실행할 때 경고가 나올 수 있어요.
  - Windows: "추가 정보 → 실행"을 누르세요.
  - macOS: 앱을 우클릭(Control+클릭) → "열기"를 누르세요.

## 동작 방식

- [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)로 카메라 영상에서 귀·어깨 위치를 추출합니다.
- 귀-어깨 수직 간격을 어깨너비로 정규화한 값을 "자세 지표"로 씁니다 (카메라와의 거리 영향을 줄이기 위함).
- 처음 사용할 때 **바른 자세로 기준(baseline) 설정**을 눌러 개인 기준값을 만듭니다. 이후에는 이 기준 대비 얼마나 벗어났는지로 양호/주의/자세 점검을 판단합니다.
- 프레임 노이즈로 값이 튀는 걸 막기 위해 지수이동평균(EMA)으로 스무딩하고, 상태 전환에는 최소 유지 시간(hysteresis)을 둬서 깜빡임을 방지합니다.
- '자세 점검' 상태가 일정 시간 이상 지속되면 브라우저 알림을 보냅니다 (쿨다운 있음).

핵심 로직은 `src/posture/postureEngine.ts`에 있고, 웹앱(`App.tsx`)과
크롬 확장(`extension/offscreen.ts`)이 이 모듈을 공유합니다.

## 웹앱으로 실행하기

```bash
pnpm install
pnpm dev
```

카메라 시작 → 바른 자세로 앉아 "바른 자세로 기준 설정" 클릭 → 이후 자동으로 감지됩니다.
기준값은 브라우저 `localStorage`에 저장되어 다음에 켤 때도 유지됩니다.

## 크롬 확장으로 실행하기

확장은 background service worker + [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
구조로 되어 있어서, 다른 탭/사이트를 보고 있어도 계속 카메라를 감시하고
위험 자세가 감지되면 OS 알림을 띄웁니다.

```bash
pnpm build:extension
```

`dist-extension/` 폴더가 생성됩니다. 크롬에서:

1. `chrome://extensions` 접속
2. 우측 상단 "개발자 모드" 켜기
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `dist-extension` 폴더 선택

설치 후 툴바의 확장 아이콘을 눌러 "백그라운드 감시 켜기" → 카메라 권한
허용 → "바른 자세로 기준 설정" 순서로 사용하면 됩니다.

감시가 켜진 동안 실제 카메라 화면은 안 보이는 offscreen 문서에서 처리되기
때문에, 감시를 켤 때 자동으로 "내 모습 보기" 미리보기 창이 함께 떠서 자리를
잡고 보정하는 데 쓸 수 있습니다. 나중에 다시 보고 싶으면 팝업의 "내 모습
보기" 버튼을 누르면 됩니다 (이 창은 화면 표시 전용이라 감지에는 관여하지
않습니다).

### 알아두면 좋은 점

- MediaPipe의 wasm 파일은 CDN이 아니라 확장 안에 번들되어 있습니다
  (`extension/public/wasm/`, `node_modules/@mediapipe/tasks-vision/wasm/`에서
  복사). Manifest V3는 원격에서 받아온 코드를 실행하는 걸 금지하기 때문입니다.
- pose landmarker **모델 파일**(`.task`)은 아직 Google 서버에서 받아옵니다.
  데이터 파일이라 정책상 문제는 없지만, 오프라인 사용이나 스토어 심사를
  더 깐깐하게 통과하고 싶다면 모델 파일도 로컬에 내려받아
  `extension/public/model/`에 넣고 `offscreen.ts`의 `modelAssetPath`를
  `chrome.runtime.getURL('model/pose_landmarker_lite.task')`로 바꾸는 걸
  권장합니다.
- 기준값(baseline)은 `chrome.storage.local`에 저장되어 웹앱의
  `localStorage`와는 별도로 관리됩니다. 확장을 껐다 켜도 유지됩니다.
- 아이콘(`extension/public/icons/`)은 임시 placeholder입니다. 스토어에
  낼 때는 실제 아이콘으로 교체하세요.

## 배포

- 이 앱은 서버가 필요 없는 순수 프론트엔드(카메라/모델 처리가 전부
  브라우저 안에서 일어남)입니다. 크롬 확장으로 낸다면 별도 배포 인프라
  없이 Chrome Web Store에 `dist-extension`을 업로드하면 됩니다.
- 웹 버전도 함께 호스팅하고 싶다면 정적 호스팅(GCP Firebase Hosting,
  Cloud Storage + CDN, Vercel, Netlify 등)이면 충분하고, 별도 서버(Cloud
  Run 등)는 필요하지 않습니다.

### 데스크탑 앱 릴리스 방법 (개발자용)

GitHub Actions(`.github/workflows/build-electron.yml`)가 Windows/macOS/Linux 설치 파일을 빌드하고 Releases에 올려줍니다. 평소 `main`에 push해서는 빌드가 돌지 않고, 아래 두 경우에만 실행됩니다.

1. **릴리스 만들기**: 버전 태그를 push하면 빌드 후 Releases에 파일이 자동으로 첨부됩니다.
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
2. **테스트 빌드**: GitHub의 Actions 탭 → Build Electron App → "Run workflow". 결과물은 실행 화면의 Artifacts에서 받습니다(GitHub 로그인 필요).

- 별도의 GitHub 토큰(`GH_TOKEN`) 설정은 필요 없습니다. Releases 업로드는 Actions가 기본으로 제공하는 `GITHUB_TOKEN`을 쓰고, `electron:build`는 `--publish never`로 electron-builder 자체 업로드를 꺼두었습니다.
- 태그 버전(`v0.2.0`)과 `package.json`의 `version`을 맞춰두면 파일 이름에 같은 버전이 붙습니다.

## 알려진 제약

- 웹앱의 브라우저 알림(`Notification` API)은 같은 브라우저의 다른
  탭/창에 있어도 뜨지만, 이 페이지 탭 자체를 닫으면 동작하지 않습니다.
  탭과 무관하게 계속 감시하려면 크롬 확장을 쓰세요.
- 이 결과는 참고용이며 의료적 진단이 아닙니다.

## 배터리 / 응원 알림 / 언어

- **배터리 절약**: 감지 주기를 상태에 맞춰 조절합니다 (`src/posture/detectionSchedule.ts`). 양호 1초, 주의 0.5초, 자리 비움 2~10초, 카메라는 저해상도·저프레임으로 엽니다.
- **응원 알림**: 바른 자세를 15분 연속 유지할 때마다 알림이 가고, 제목에 유지 시간이 표시됩니다. 문구는 `src/i18n/cheerMessages.ts`에서만 수정하면 되고, 알림 시점 규칙은 `src/posture/notifyTracker.ts`에 있습니다.
- **한/영 전환**: 화면 우상단 🌐 버튼으로 전환합니다. 문구는 `src/i18n/strings.ts`, 확장 스토어 이름/설명은 `extension/public/_locales/*/messages.json`에 있습니다.
- **사용 설명서**: 웹앱 우상단 📖 '사용 방법' 버튼, 확장 팝업의 '사용 방법 · 알림 설정' 링크로 열 수 있어요. 내용은 `src/i18n/manual.ts`에서 수정합니다. **크롬(브라우저) 알림 설정이 허용되어 있어야 알림을 받을 수 있어요.**
