const { app, BrowserWindow, session, systemPreferences } = require('electron')
const path = require('node:path')

/*
 * 데스크탑(Electron) 앱의 메인 프로세스.
 * 렌더러는 기존 웹앱(src/App.tsx, vite build 결과물인 dist/index.html)을
 * 그대로 재사용한다 -- getUserMedia, MediaPipe, Notification 모두
 * Electron의 크로미움 렌더러에서 동일하게 동작한다.
 *
 * 개발 중에는 ELECTRON_START_URL=http://localhost:5173 로 vite dev 서버를
 * 가리키게 하고, 배포용 빌드에서는 dist/index.html을 파일로 직접 연다.
 */

const START_URL = process.env.ELECTRON_START_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    title: 'Huri Pizza',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      /*
       * 창이 최소화/가려져도 감지 타이머가 안 늦춰지게 한다
       * (그래야 백그라운드에서도 자세 알림이 제때 온다). 대신 웹앱이 창이
       * 가려진 동안은 그리기/리렌더를 건너뛰고 감지 주기도 1초 이상으로
       * 늘려서 전력 사용을 줄인다 (src/posture/detectionSchedule.ts).
       */
      backgroundThrottling: false,
    },
  })

  if (START_URL) {
    win.loadURL(START_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(async () => {
  /*
   * Electron은 기본적으로 getUserMedia(카메라/마이크) 요청을 거부한다.
   * 이 앱은 우리가 직접 배포하는 신뢰된 렌더러만 로드하므로 media 요청은
   * 자동으로 허용한다.
   */
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    // 카메라(media)와 데스크탑 알림(notifications)만 허용한다
    callback(permission === 'media' || permission === 'notifications')
  })

  // macOS: 앱 시작 시 시스템 카메라 권한 프롬프트를 한 번 띄워준다.
  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) {
    try {
      await systemPreferences.askForMediaAccess('camera')
    } catch {
      // 사용자가 거부해도 앱은 계속 뜨고, 웹앱 쪽 에러 메시지로 안내된다.
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
