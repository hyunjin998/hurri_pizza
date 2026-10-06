import type { Locale } from './locale'

/*
 * 바른 자세를 오래 유지했을 때 보내는 "응원 알림" 문구 모음.
 * ----------------------------------------------------------------
 * - 문구만 고치고 싶으면 이 파일만 수정하면 된다 (로직은 notifyTracker.ts).
 * - 한 항목에 ko/en을 같이 적어서, 번역이 빠지면 타입 에러로 바로 알려준다.
 * - {minutes}는 "연속으로 바른 자세를 유지한 분"으로 치환된다.
 * - 항목은 몇 개든 늘려도 된다 (직전에 보낸 문구는 피해서 랜덤으로 고른다).
 *
 * 티어(연속 유지 시간):
 *   early  15분 이상 ~ 30분 미만
 *   mid    30분 이상 ~ 60분 미만
 *   long   60분 이상
 */
export type CheerTier = 'early' | 'mid' | 'long'

export interface CheerMessage {
  ko: string
  en: string
}

/*
 * 알림 제목에는 "얼마나 유지했는지"를 항상 같이 보여준다.
 * 예) 잘하고 있어요! 🐢🍕 · 15분 연속 바른 자세
 */
const CHEER_TITLE_BASE: Record<Locale, string> = {
  ko: '잘하고 있어요! 🐢🍕',
  en: "You're doing great! 🐢🍕",
}

export function formatDuration(minutes: number, locale: Locale): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (locale === 'ko') {
    if (hours === 0) {
      return `${minutes}분`
    }

    return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`
  }

  if (hours === 0) {
    return `${minutes} min`
  }

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function cheerTitle(locale: Locale, minutes: number): string {
  const duration = formatDuration(minutes, locale)

  return locale === 'ko'
    ? `${CHEER_TITLE_BASE.ko} · ${duration} 연속 바른 자세`
    : `${CHEER_TITLE_BASE.en} · ${duration} of good posture`
}

export const CHEER_MESSAGES: Record<CheerTier, CheerMessage[]> = {
  early: [
    {
      ko: '거북이도 목을 쭉 펴고 있어요 🐢 벌써 {minutes}분째 바른 자세! 조금만 더 힘내요!',
      en: "Even the turtle's neck is stretched out 🐢 {minutes} min of perfect posture — keep it up!",
    },
    {
      ko: '{minutes}분 동안 허리가 꼿꼿해요 🍕 치즈보다 쫀득한 집중력, 조금만 더 가봐요!',
      en: '{minutes} minutes with a spine straighter than pizza dough 🍕 Almost there, hang in!',
    },
    {
      ko: '목이 거북이 모드에서 탈출했어요 🐢➡️🦒 {minutes}분 연속 성공, 좀만 더요!',
      en: 'Your neck escaped turtle mode 🐢➡️🦒 {minutes} min streak — just a bit more!',
    },
    {
      ko: '오늘의 자세 MVP 🏆 {minutes}분째 바른 자세 유지 중! 한 판만 더 버텨봐요.',
      en: 'Posture MVP of the day 🏆 {minutes} minutes strong. One more round!',
    },
    {
      ko: '척추가 기립 박수 치는 중 👏 {minutes}분 연속 바른 자세예요. 조금만 더 힘내요!',
      en: 'Your spine is giving you a standing ovation 👏 {minutes} min and counting!',
    },
    {
      ko: '{minutes}분째 자세 만점! 페퍼로니도 감동했어요 🍕 이대로만 가요.',
      en: '{minutes} min of top-tier posture — even the pepperoni is moved 🍕 Keep going!',
    },
    {
      ko: '어깨는 활짝~ 목은 쭉~ 🌟 {minutes}분 동안 아주 잘하고 있어요. 한 조각만 더!',
      en: 'Shoulders wide, neck long 🌟 {minutes} minutes of nailing it. One more slice!',
    },
    {
      ko: '{minutes}분째 전설처럼 앉아 있네요 😎 지금 멈추기엔 너무 멋져요!',
      en: "Look at you, {minutes} min of sitting like a legend 😎 Don't stop now!",
    },
  ],

  mid: [
    {
      ko: '{minutes}분 연속 바른 자세라니... 혹시 사이보그? 🤖 아니면 피자 장인? 대단해요!',
      en: '{minutes} minutes straight... are you a cyborg? 🤖 Or a pizza master? Either way, impressive!',
    },
    {
      ko: '{minutes}분째 꼿꼿! 거북이 가족이 당신을 롤모델로 삼았어요 🐢',
      en: 'The turtle family wants you as their role model 🐢 {minutes} min and still upright!',
    },
    {
      ko: '허리가 {minutes}분 동안 한 번도 안 울었어요 🥹 이대로 쭉쭉 가봐요!',
      en: "Your back hasn't complained once in {minutes} min 🥹 Let's keep it that way!",
    },
    {
      ko: '{minutes}분 동안 자세 완벽 🍕 이쯤 되면 허리가 피자 쏘고 싶을 지경이에요.',
      en: '{minutes} minutes of flawless posture 🍕 Your back wants to buy you a pizza.',
    },
    {
      ko: '목 건강 레벨 업! ⬆️ {minutes}분 연속 유지 중이에요. 스트레칭 한 번 곁들이면 금상첨화!',
      en: 'Neck health level up ⬆️ {minutes} min! Add a quick stretch for bonus points.',
    },
    {
      ko: '와, {minutes}분째 자세가 흐트러지질 않네요 👀 자세 장인 인정!',
      en: '{minutes} min and not a single slouch 👀 Posture craftsman status confirmed!',
    },
  ],

  long: [
    {
      ko: '{minutes}분 연속 바른 자세 🎉 이건 거의 전설이에요. 물 한 잔 마시고 스트레칭 어때요? 💧',
      en: '{minutes} minutes of perfect posture 🎉 That is basically legendary. Water and a stretch? 💧',
    },
    {
      ko: '1시간 넘게 꼿꼿하다니, 허리가 감동의 눈물을 흘려요 😭🍕 중간에 잠깐 일어나 쉬는 것도 잊지 마요!',
      en: "Over an hour upright — your back is crying happy tears 😭🍕 Don't forget a short break!",
    },
    {
      ko: '{minutes}분째 완벽! 🏅 보상으로 진짜 피자는 못 드리지만, 기지개 한 번 어때요? 🙆',
      en: '{minutes} min flawless! 🏅 No real pizza as a reward (sorry) — but how about a big stretch? 🙆',
    },
    {
      ko: '자세 마스터 인증 ✅ {minutes}분 연속이에요! 눈도 좀 쉬어주고 목도 한 번 돌려봐요.',
      en: 'Posture Master certified ✅ {minutes} minutes! Rest your eyes and roll your neck a bit.',
    },
    {
      ko: '거북이도 놀라 자빠졌어요 🐢💥 {minutes}분 연속 바른 자세라니!',
      en: 'The turtle fell over in shock 🐢💥 {minutes} minutes of perfect posture!',
    },
    {
      ko: '{minutes}분째 허리 만점 🌈 오늘 정말 멋져요. 중간중간 쉬는 것도 바른 자세의 일부예요!',
      en: "{minutes} min and counting 🌈 You're crushing it today. Breaks are part of good posture too!",
    },
  ],
}

export function cheerTierFor(minutes: number): CheerTier {
  if (minutes >= 60) {
    return 'long'
  }

  if (minutes >= 30) {
    return 'mid'
  }

  return 'early'
}

export function formatCheer(
  message: CheerMessage,
  locale: Locale,
  minutes: number,
): string {
  return message[locale].replaceAll('{minutes}', String(minutes))
}
