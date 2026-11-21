import { useEffect, useMemo, useState } from 'react';
import { allNatureNames, targetNaturePool } from '../../data/catalog';
import { GREEN_NEST_ICON, bodyMedalIconByLabel, voiceMedalIconByLabel } from '../../domain/petIcons';
import type { DemandBody, DemandVoice } from '../../shared/collectionGroups';
import { PetAvatar } from '../PetAvatar';
import { ModalSurface } from '../primitives/ModalSurface';

export interface GroupEggRequestGroup {
  id: string;
  name: string;
}

export interface GroupEggRequestCriteria {
  body: DemandBody;
  voice: DemandVoice;
  requireGreenNest: boolean;
  groupId: string;
}

export interface GroupEggRequestSheetProps {
  open: boolean;
  eggGameId: number;
  name: string;
  number: string;
  eggGroups: readonly string[];
  initialNatures: readonly string[];
  publishedNatures?: readonly string[];
  targetBody: '大块头' | '小不点';
  targetVoice: '+100' | '-100' | '婉转声' | '粗嗓门';
  groups: readonly GroupEggRequestGroup[];
  groupId: string;
  busy?: boolean;
  error?: string;
  whoCanHelp?: string;
  supplierNote?: string;
  onClose: () => void;
  onGroupChange: (groupId: string) => void;
  onPublish: (natures: string[], criteria: GroupEggRequestCriteria) => void;
}

const PRIMARY_NATURES = targetNaturePool.map((nature) => nature.name);
const EXTRA_NATURES = allNatureNames.filter((nature) => !PRIMARY_NATURES.includes(nature));
const VOICES: readonly GroupEggRequestSheetProps['targetVoice'][] = [
  '+100',
  '-100',
  '婉转声',
  '粗嗓门',
];

export function GroupEggRequestSheet({
  open,
  eggGameId,
  name,
  number,
  eggGroups,
  initialNatures,
  publishedNatures = [],
  targetBody,
  targetVoice,
  groups,
  groupId,
  busy = false,
  error = '',
  whoCanHelp = '组内暂无',
  supplierNote = '',
  onClose,
  onGroupChange,
  onPublish,
}: GroupEggRequestSheetProps) {
  const sent = useMemo(() => new Set(publishedNatures), [publishedNatures]);
  const [selected, setSelected] = useState<string[]>([]);
  const [body, setBody] = useState<DemandBody>(targetBody);
  const [voice, setVoice] = useState<DemandVoice>(targetVoice);
  const [greenNest, setGreenNest] = useState(false);
  const [more, setMore] = useState(false);
  const initialKey = initialNatures.join('|');
  const publishedKey = publishedNatures.join('|');

  useEffect(() => {
    if (!open) return;
    setSelected(initialNatures.filter((nature) => !sent.has(nature)));
    setBody(targetBody);
    setVoice(targetVoice);
    setGreenNest(false);
    setMore(false);
    // 只在打开目标或缺口集合真正变化时重置；轮询拿回同内容的数组不能清掉用户输入。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eggGameId, initialKey, publishedKey, targetBody, targetVoice]);

  const natureButtons = more
    ? [...PRIMARY_NATURES, ...EXTRA_NATURES]
    : PRIMARY_NATURES;
  const extremeLabel = targetBody === '大块头' ? '满体重' : '零体重';
  const extremePercent = targetBody === '大块头' ? '100%' : '0%';
  const normalBody = body === '满体重' || body === '零体重' ? targetBody : body;
  const count = Math.max(1, selected.length);
  const greenNeedsNature = greenNest && selected.length === 0;
  const canPublish = Boolean(groupId) && !busy && !greenNeedsNature;
  const bodyIcon = bodyMedalIconByLabel(normalBody);
  const voiceIcon = voiceMedalIconByLabel(voice);

  const toggleNature = (nature: string) => {
    if (sent.has(nature)) return;
    setSelected((current) =>
      current.includes(nature)
        ? current.filter((item) => item !== nature)
        : current.length >= 6
          ? current
          : [...current, nature],
    );
  };

  return (
    <ModalSurface
      open={open}
      title="小组求蛋"
      onClose={onClose}
      testId="group-egg-request"
      closeTestId="group-egg-request-close"
    >
      <div className="space-y-2 p-3" data-testid="group-egg-request-body">
        <section className="rounded-xl bg-slate-50 p-2" data-testid="group-egg-request-target">
          <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-2">
            <PetAvatar gameId={eggGameId} name={name} size={56} />
            <div className="min-w-0 pt-0.5">
              <div className="flex min-w-0 items-baseline gap-1">
                <strong className="truncate text-sm text-slate-800">{name}</strong>
                <span className="shrink-0 text-[9px] text-slate-400">No.{number}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {eggGroups.map((group) => (
                  <span
                    key={group}
                    className="rounded bg-sky-100 px-1 py-0.5 text-[9px] text-sky-800"
                  >
                    {group}
                  </span>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-1">
                {bodyIcon ? (
                  <img src={bodyIcon} alt={normalBody} className="size-[18px] object-contain" />
                ) : null}
                {voiceIcon ? (
                  <img src={voiceIcon} alt={voice} className="size-[18px] object-contain" />
                ) : null}
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-1.5">
              <div
                className="flex max-h-[60px] min-w-9 flex-col items-end gap-0.5 overflow-hidden"
                data-testid="group-request-target-natures"
              >
                {initialNatures.slice(0, 3).map((nature) => (
                  <span
                    key={nature}
                    className="max-w-full truncate rounded bg-rose-50 px-1 py-0.5 text-[9px] leading-tight text-rose-700"
                  >
                    {nature}
                  </span>
                ))}
              </div>
              <div className="w-[84px] shrink-0 rounded-lg bg-white px-1.5 py-1 shadow-sm">
                <p className="text-[9px] font-semibold text-slate-500">谁能补我</p>
                <p className="mt-0.5 truncate text-[9px] text-rose-600" title={whoCanHelp}>
                  {whoCanHelp}
                </p>
                {supplierNote ? (
                  <p className="mt-0.5 truncate text-[8px] text-slate-400" title={supplierNote}>
                    {supplierNote}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5">
          <span className="shrink-0 text-[10px] text-slate-400">发到</span>
          <div className="flex min-w-0 gap-1 overflow-x-auto scrollbar-none" role="group" aria-label="发布到小组">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={group.id === groupId}
                onClick={() => onGroupChange(group.id)}
                className={`min-h-[27px] shrink-0 rounded-md border px-2 text-[10px] ${
                  group.id === groupId
                    ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold text-slate-600">发需求</h3>
            <span className="text-[9px] text-slate-400">1 个性格 = 1 条</span>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {natureButtons.map((nature) => {
              const already = sent.has(nature);
              const on = selected.includes(nature);
              return (
                <button
                  key={nature}
                  type="button"
                  disabled={already || busy}
                  aria-pressed={on}
                  onClick={() => toggleNature(nature)}
                  className={`min-h-[29px] rounded-md border px-0.5 text-[10px] ${
                    already
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                      : on
                        ? 'border-emerald-500 bg-white font-medium text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {nature}
                  {already ? ' · 已发' : ''}
                </button>
              );
            })}
            {EXTRA_NATURES.length > 0 ? (
              <button
                type="button"
                aria-expanded={more}
                onClick={() => setMore((value) => !value)}
                className="min-h-[29px] rounded-md border border-dashed border-slate-300 bg-white px-0.5 text-[10px] text-slate-500"
              >
                {more ? '收起 ▴' : `更多 +${EXTRA_NATURES.length}`}
              </button>
            ) : null}
          </div>

          <div className="mt-1.5 flex items-center gap-1" role="group" aria-label="体型">
            <span className="w-7 shrink-0 text-[10px] text-slate-400">体型</span>
            <button
              type="button"
              aria-pressed={body === targetBody}
              onClick={() => setBody(targetBody)}
              className={`inline-flex min-h-[28px] items-center gap-1 rounded-md border px-1.5 text-[10px] ${
                body === targetBody
                  ? 'border-emerald-500 bg-white font-medium text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {bodyMedalIconByLabel(targetBody) ? (
                <img src={bodyMedalIconByLabel(targetBody)!} alt="" className="size-4 object-contain" />
              ) : null}
              {targetBody}
            </button>
            <button
              type="button"
              aria-pressed={body === extremeLabel}
              onClick={() => setBody(body === extremeLabel ? targetBody : extremeLabel)}
              className={`inline-flex min-h-[28px] items-center gap-1 rounded-md border px-1.5 text-[10px] ${
                body === extremeLabel
                  ? 'border-emerald-500 bg-white font-medium text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {bodyMedalIconByLabel(extremeLabel) ? (
                <img src={bodyMedalIconByLabel(extremeLabel)!} alt="" className="size-4 object-contain" />
              ) : null}
              {extremeLabel} {extremePercent}
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label="声音">
            <span className="w-7 shrink-0 text-[10px] text-slate-400">声音</span>
            {VOICES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={voice === option}
                onClick={() => setVoice(option)}
                className={`inline-flex min-h-[28px] items-center gap-1 rounded-md border px-1.5 text-[10px] ${
                  voice === option
                    ? 'border-emerald-500 bg-white font-medium text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {voiceMedalIconByLabel(option) ? (
                  <img src={voiceMedalIconByLabel(option)!} alt="" className="size-4 object-contain" />
                ) : null}
                {option}
              </button>
            ))}
          </div>

          <label className="mt-1.5 flex min-h-[26px] items-center gap-1 text-[10px] text-slate-500">
            <input
              type="checkbox"
              checked={greenNest}
              onChange={(event) => setGreenNest(event.target.checked)}
              className="size-3.5 accent-emerald-600"
            />
            绿窝
            <img src={GREEN_NEST_ICON} alt="" className="size-4 object-contain" />
          </label>
          {greenNeedsNature ? (
            <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
              绿窝需要先选一个性格。
            </p>
          ) : null}
        </section>

        {error ? <p role="alert" className="text-[11px] text-rose-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] flex-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-500"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canPublish}
            onClick={() =>
              onPublish(selected, {
                body,
                voice,
                requireGreenNest: greenNest,
                groupId,
              })
            }
            className="min-h-[38px] flex-[2] rounded-lg bg-emerald-600 text-xs font-semibold text-white disabled:bg-slate-300"
          >
            {busy ? '发布中…' : `发布 ${count} 条需求`}
          </button>
        </div>
      </div>
    </ModalSurface>
  );
}
