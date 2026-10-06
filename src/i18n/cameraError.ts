import type { Strings } from './strings'

/*
 * getUserMedia 에러(DOMException)를 원인별 안내 문구로 바꿔준다.
 * 확장(popup/permission/preview)과 웹앱이 같이 쓴다.
 */
export function describeCameraError(err: unknown, strings: Strings): string {
  const name = err instanceof DOMException ? err.name : ''

  switch (name) {
    case 'NotAllowedError':
      return strings.cameraNotAllowed
    case 'NotFoundError':
    case 'OverconstrainedError':
      return strings.cameraNotFound
    case 'NotReadableError':
      return strings.cameraNotReadable
    case 'SecurityError':
      return strings.cameraSecurity
    default:
      return strings.cameraUnknown(name)
  }
}
