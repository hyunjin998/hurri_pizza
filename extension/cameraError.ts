/*
 * getUserMedia 에러(DOMException)를 원인별 한글 안내 문구로 바꿔준다.
 * popup.tsx / permission.tsx가 공유한다.
 */
export function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''

  switch (name) {
    case 'NotAllowedError':
      return (
        '카메라 권한이 거부되어 있어요. 이 페이지에서 다시 시도하거나, ' +
        'chrome://settings/content/camera 에서 이 확장이 차단 목록에 ' +
        '있으면 삭제해주세요.'
      )
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '카메라 장치를 찾을 수 없어요. 웹캠이 연결되어 있는지 확인해주세요.'
    case 'NotReadableError':
      return (
        '카메라를 열 수 없어요. 다른 프로그램(Zoom, 다른 브라우저 탭 등)이 ' +
        '카메라를 사용 중이면 종료하고 다시 시도해주세요.'
      )
    case 'SecurityError':
      return '보안 설정 때문에 카메라 접근이 차단됐어요.'
    default:
      return `카메라 권한 요청에 실패했어요${name ? ` (${name})` : ''}. 다시 시도해주세요.`
  }
}
