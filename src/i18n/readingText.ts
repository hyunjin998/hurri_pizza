import type { PostureReading } from '../posture/postureEngine'
import type { Strings } from './strings'

/*
 * PostureReading(상태 값)을 화면에 보여줄 문구로 바꿔준다.
 * 사람이 인식되지 않을 때(보정 중/기준 미설정 제외)는 "자리 비움"으로 보여준다.
 */
export function readingLabel(reading: PostureReading, strings: Strings): string {
  if (!reading.present && reading.status !== 'calibrating' && reading.status !== 'uncalibrated') {
    return strings.absentLabel
  }

  return strings.statusLabel[reading.status]
}

export function readingDescription(reading: PostureReading, strings: Strings): string {
  if (!reading.present && reading.status !== 'calibrating' && reading.status !== 'uncalibrated') {
    return strings.absentDescription
  }

  return strings.statusDescription[reading.status]
}
