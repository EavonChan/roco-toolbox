import { useTargetMode } from './targetModeStore';
import { gradeLabel, type PetGrade } from '../domain/petFilters';
import type { AccountImportResult } from '../domain/importDiff';

/**
 * 「本次新增」卡片（看板 ImportAdditionCard / 云同步 recordSyncedPets）共用的展示件。
 *
 * 2026-11-28 CLEAN2：导入历史卡片已删除（数据入口收敛后不再有人看历史）；
 * 这里只留仍被看板与同步使用的账号块与计数。
 */

/** 一次导入新增里「够格进看板分类」的精灵数（种公 + 母本）。 */
export const countOf = (account: AccountImportResult): number =>
  account.studs.reduce((sum, group) => sum + group.pets.length, 0) +
  account.mothers.reduce((sum, group) => sum + group.pets.length, 0);

export function AccountBlock({ account }: { account: AccountImportResult }) {
  const mode = useTargetMode();
  const total = countOf(account);

  return (
    <div data-testid="import-result-account">
      <h3 className="text-sm font-medium text-slate-900">
        {account.accountName}
        {account.isFirstImport ? (
          <span className="ml-1 text-xs font-normal text-slate-400">首次导入</span>
        ) : null}
      </h3>

      {total === 0 ? (
        <p className="mt-1 text-xs text-slate-400">没有新增符合要求的精灵。</p>
      ) : null}

      {account.studs.map((group) => (
        <div key={group.studClass} className="mt-1.5">
          <p className="text-xs text-slate-400">
            新增{gradeLabel(group.studClass, mode)}种公 {group.pets.length}
          </p>
          <ul className="mt-1 space-y-1">
            {group.pets.map((pet, index) => (
              <li
                key={`stud-${group.studClass}-${pet.label}-${pet.box}-${index}`}
                data-testid="import-result-stud"
                className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"
              >
                {pet.label} · {pet.nature}
                {pet.groupLabels && pet.groupLabels.length > 0 ? ` · ${pet.groupLabels.join('/')}` : ''} ·{' '}
                {pet.voiceDb}dB · {pet.box}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {account.mothers.map((group) => (
        <div key={group.motherClass} className="mt-1.5">
          <p className="text-xs text-slate-400">
            新增{gradeLabel(group.motherClass as PetGrade, mode)}母本 {group.pets.length}
          </p>
          <ul className="mt-1 space-y-1">
            {group.pets.map((pet, index) => (
              <li
                key={`mother-${group.motherClass}-${pet.label}-${pet.box}-${index}`}
                data-testid="import-result-mother"
                className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"
              >
                {pet.label} · {pet.nature}
                {pet.groupLabels && pet.groupLabels.length > 0 ? ` · ${pet.groupLabels.join('/')}` : ''} ·{' '}
                {pet.voiceDb}dB · {pet.box}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
