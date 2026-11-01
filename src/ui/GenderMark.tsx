export interface GenderMarkProps {
  gender: '公' | '母' | '未知';
}

/**
 * 性别图标（2026-11-01 用户口径统一）：**12px 小圆片**（母粉 / 公蓝 / 未知灰），
 * 不再是单独一根 ♀ / ♂ 细线——细线和名字挤在一起时太瘦，也分不清归属。
 *
 * 全站统一用这一个组件，禁止各处再写一套符号 + 配色。
 */
export function GenderMark({ gender }: GenderMarkProps) {
  const tone =
    gender === '公'
      ? 'bg-sky-100 text-sky-700'
      : gender === '母'
        ? 'bg-pink-100 text-pink-600'
        : 'bg-slate-100 text-slate-500';
  const mark = gender === '公' ? '♂' : gender === '母' ? '♀' : '?';
  return (
    <span
      className={`inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full align-middle text-[9px] leading-none ${tone}`}
      title={gender === '未知' ? '性别未知' : gender}
    >
      {mark}
    </span>
  );
}
