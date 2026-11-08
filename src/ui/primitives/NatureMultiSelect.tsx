import { useMemo, useRef, useState } from 'react';
import { allNatureNames, targetNaturePool } from '../../data/catalog';
import { ModalSurface } from './ModalSurface';

export interface NatureMultiSelectProps {
  label: string;
  /** 已选性格（多选）；空数组 = 不限 */
  values: readonly string[];
  onValuesChange: (values: string[]) => void;
  /** 一个都没选时按钮上的文案（默认「不限」） */
  allLabel?: string;
  testId?: string;
  menuTestId?: string;
  optionTestId?: (value: string) => string;
  className?: string;
}

/** 八大目标性格：默认展开这一组，避免一上来滑 30 个。 */
const PRIMARY_NATURES = targetNaturePool.map((nature) => nature.name);
const EXTRA_NATURES = allNatureNames.filter((nature) => !PRIMARY_NATURES.includes(nature));

/**
 * 性格多选（2026-11-08 战斗强提醒目标用）。
 *
 * 与 NatureSelect 同一套弹层（搜索 + 常用 + 更多），但点选项是**切换勾选**、
 * 不自动关闭，方便一次挑好几个；「不限」= 清空，「完成」收起来。
 * 维度内的多个已选值是「或」的关系（命中任意一个即算该维度命中）。
 */
export function NatureMultiSelect({
  label,
  values,
  onValuesChange,
  allLabel = '不限',
  testId,
  menuTestId,
  optionTestId,
  className = '',
}: NatureMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = useMemo(() => new Set(values), [values]);
  const summary = values.length === 0
    ? allLabel
    : values.length <= 2
      ? values.join('、')
      : `${values.length} 项`;

  const keywordText = keyword.trim();
  const matches = useMemo(() => {
    if (!keywordText) return [];
    return allNatureNames.filter((nature) => nature.includes(keywordText));
  }, [keywordText]);
  const extras = useMemo(() => {
    if (!keywordText) return EXTRA_NATURES;
    return matches.filter((nature) => !PRIMARY_NATURES.includes(nature));
  }, [keywordText, matches]);
  const primaries = useMemo(() => {
    if (!keywordText) return PRIMARY_NATURES;
    return matches.filter((nature) => PRIMARY_NATURES.includes(nature));
  }, [keywordText, matches]);

  const close = () => {
    setOpen(false);
    setKeyword('');
    triggerRef.current?.focus();
  };

  const toggle = (nature: string) => {
    const next = new Set(selected);
    if (next.has(nature)) next.delete(nature);
    else next.add(nature);
    // 按图鉴顺序输出，避免选择顺序影响记忆结果与展示
    onValuesChange(allNatureNames.filter((name) => next.has(name)));
  };

  const option = (nature: string) => {
    const on = selected.has(nature);
    return (
      <button
        key={nature}
        type="button"
        aria-pressed={on}
        onClick={() => toggle(nature)}
        data-testid={optionTestId?.(nature)}
        className={`min-h-[34px] rounded-lg border px-2.5 text-xs ${
          on
            ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700'
            : 'border-slate-200 bg-white text-slate-600'
        }`}
      >
        {nature}
      </button>
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-label={`${label}：${summary}`}
        onClick={() => setOpen(true)}
        data-testid={testId}
        className={`flex min-h-[32px] max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-600 ${className}`}
      >
        <span className="truncate">{summary}</span>
        <span aria-hidden="true" className="text-[10px] text-slate-400">
          ▼
        </span>
      </button>

      <ModalSurface
        open={open}
        title={label}
        placement="sheet"
        onClose={close}
        testId={menuTestId}
        closeTestId="nature-multi-select-close"
        backdropTestId="nature-multi-select-backdrop"
      >
        <div className="space-y-2 p-3">
          <button
            type="button"
            aria-pressed={values.length === 0}
            onClick={() => onValuesChange([])}
            data-testid={optionTestId?.('')}
            className={`min-h-[36px] w-full rounded-lg border px-3 text-left text-sm ${
              values.length === 0
                ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {allLabel}（清空已选{values.length > 0 ? ` ${values.length} 项` : ''}）
          </button>

          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜性格（如：胆、固、踏）"
            aria-label="搜索性格"
            data-testid="nature-multi-select-search"
            className="min-h-[36px] w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
          />

          {primaries.length > 0 ? (
            <section className="space-y-1" data-testid="nature-multi-select-primary">
              <h3 className="text-[11px] font-medium text-slate-400">
                {keywordText ? '匹配的常用性格' : '常用性格'}
              </h3>
              <div className="flex flex-wrap gap-1.5">{primaries.map(option)}</div>
            </section>
          ) : null}

          {extras.length > 0 ? (
            <section className="space-y-1" data-testid="nature-multi-select-extra">
              <h3 className="text-[11px] font-medium text-slate-400">
                {keywordText ? '其他匹配' : `更多性格 ${extras.length}`}
              </h3>
              <div className="flex flex-wrap gap-1.5">{extras.map(option)}</div>
            </section>
          ) : null}

          {keywordText && matches.length === 0 ? (
            <p className="py-3 text-center text-xs text-slate-400">没有匹配的性格</p>
          ) : null}

          <button
            type="button"
            onClick={close}
            data-testid="nature-multi-select-done"
            className="min-h-[38px] w-full rounded-lg bg-emerald-600 text-sm font-medium text-white"
          >
            完成{values.length > 0 ? `（已选 ${values.length} 项）` : ''}
          </button>
        </div>
      </ModalSurface>
    </>
  );
}
