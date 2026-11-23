import { useEffect, useMemo, useRef, useState } from 'react';
import { eggGroupNames, species } from '../data/catalog';
import { petBodyMedalIcon, petVoiceMedalIcon, voiceMedalName } from '../domain/petIcons';
import { heightMetersOf, weightKgOf } from '../domain/petFilters';
import { speciesDisplayName } from '../domain/speciesName';
import type { OwnedPet, SpeciesEntry } from '../domain/types';
import { useAccountFilter } from './accountFilterStore';
import { GenderMark } from './GenderMark';
import { PetAvatar } from './PetAvatar';
import { compactPetName } from './petNameLabel';
import { formatPercent } from './formatPercent';
import { getMyPetsSizeUnit } from './myPetsFilterStore';
import { buildSimBackpack, type SimBackpackPage } from './simBackpackLayout';
import { useOwnedPets } from './useOwnedPets';

/** 底部页号最多显示 10 个（2026-11-23 用户口径）。 */
const PAGE_CHIP_LIMIT = 10;

/** 收集页右栏入口：从本机快照取数；传入 pets 时用右侧筛选后的结果画格子。 */
export function SimulatedBackpack({
  pets,
  standardCards = false,
}: {
  pets?: readonly OwnedPet[];
  standardCards?: boolean;
} = {}) {
  const { all, accounts } = useOwnedPets();
  const { excluded } = useAccountFilter();
  return (
    <SimulatedBackpackView
      pets={pets ?? all}
      accounts={accounts}
      excludedAccounts={excluded}
      hasAnyPets={all.length > 0}
      standardCards={standardCards}
    />
  );
}

export interface SimulatedBackpackViewProps {
  pets: readonly OwnedPet[];
  accounts: readonly string[];
  /** 和右栏账号筛选共用：被排除的账号不进入仿真背包。 */
  excludedAccounts: ReadonlySet<string>;
  /** 本机是否有任何精灵（区分「真没数据」与「筛选后为空」） */
  hasAnyPets?: boolean;
  /** 展开筛选时：卡片换成精灵背包同款标准卡，仍是一行六个、五行 30 格 */
  standardCards?: boolean;
}

/**
 * 仿真背包页（2026-11-23 用户口径）：
 * - 是收集页里的整页视图，不是悬浮窗；
 * - 6 列 × 5 行 = 30 格，一页一个盒子，按真实 `slotOrder` 落位；
 * - 卡片从上到下：头像 → 名字 → 性别 + 性格 → 奖牌 → 声音 dB；
 * - 顶部切账号，底部翻盒子；盒外精灵排在每个账号最后一页。
 */
export function SimulatedBackpackView({
  pets,
  accounts,
  excludedAccounts,
  hasAnyPets = true,
  standardCards = false,
}: SimulatedBackpackViewProps) {
  const chipsRef = useRef<HTMLDivElement | null>(null);

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => !excludedAccounts.has(account)),
    [accounts, excludedAccounts],
  );
  const bags = useMemo(
    () => buildSimBackpack(pets, selectedAccounts),
    [pets, selectedAccounts],
  );

  const [activeAccount, setActiveAccount] = useState(selectedAccounts[0] ?? '');
  const [pageIndex, setPageIndex] = useState(0);

  // 账号筛选变化 / 首次数据到位：自动落到第一个仍被选中的账号
  useEffect(() => {
    if (selectedAccounts.length === 0) {
      if (activeAccount !== '') setActiveAccount('');
      return;
    }
    if (!selectedAccounts.includes(activeAccount)) {
      setActiveAccount(selectedAccounts[0]);
      setPageIndex(0);
    }
  }, [selectedAccounts, activeAccount]);

  const activeBag = bags.find((bag) => bag.account === activeAccount);
  const pages = activeBag?.pages ?? [];
  // 切账号时页数会变；用安全的页号渲染，不让越界页把画面清空
  const safePageIndex = pages.length === 0 ? 0 : Math.min(pageIndex, pages.length - 1);
  const activePage = pages[safePageIndex];
  // 底部最多只显示 10 个页号：以当前页为中心滑窗，避免 52 个盒子排成一条
  const chipStart = pages.length <= PAGE_CHIP_LIMIT
    ? 0
    : Math.min(Math.max(safePageIndex - 4, 0), pages.length - PAGE_CHIP_LIMIT);
  const visiblePageEntries = pages
    .slice(chipStart, chipStart + PAGE_CHIP_LIMIT)
    .map((page, offset) => ({ page, index: chipStart + offset }));

  const speciesByGameId = useMemo(
    () => new Map(species.map((entry) => [entry.gameId, entry])),
    [],
  );

  // 页签很多时（一个账号可能 50 盒）把当前页滚进可视区
  useEffect(() => {
    const node = chipsRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    node?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [safePageIndex, activeAccount]);

  const goToPage = (next: number) => {
    if (pages.length === 0) return;
    setPageIndex(Math.max(0, Math.min(next, pages.length - 1)));
  };

  const emptyText =
    selectedAccounts.length === 0
      ? '没有选中的账号'
      : !hasAnyPets
        ? '还没有导入精灵数据'
        : '没有符合筛选条件的精灵';

  return (
    <main
      className="mx-auto max-w-md collection-sim-page"
      data-testid="sim-backpack"
      aria-label="仿真背包"
    >
      <header className="sim-page-header">
        {selectedAccounts.length > 1 ? (
          <div className="sim-page-accounts" role="group" aria-label="切换账号">
            {selectedAccounts.map((account) => (
              <button
                key={account}
                type="button"
                aria-pressed={account === activeAccount}
                onClick={() => {
                  setActiveAccount(account);
                  setPageIndex(0);
                }}
                className="sim-page-account"
                data-testid={`sim-backpack-account-${account}`}
                title={account}
              >
                {account}
              </button>
            ))}
          </div>
        ) : (
          <p className="sim-page-account-single" data-testid="sim-backpack-account">
            {activeAccount}
          </p>
        )}
        {activePage ? (
          <span className="sim-page-box" data-testid="sim-backpack-box">
            {activePage.label} · {activePage.filled}/30
          </span>
        ) : null}
      </header>

      <div className={`sim-page-scroll${standardCards ? ' sim-page-scroll-standard' : ''}`}>
        {!activePage ? (
          <div className="sim-page-empty">
            <p className="sim-page-empty-text">{emptyText}</p>
          </div>
        ) : standardCards ? (
          <ul
            className="sim-standard-grid"
            data-testid="sim-standard-cards"
            data-page={activePage.key}
            aria-label={`${activeAccount} ${activePage.label} 精灵卡片`}
          >
            {activePage.slots.map((slot) => (
              <li
                key={slot.slot}
                className={`sim-standard-card${slot.pet ? '' : ' sim-standard-empty'}`}
                data-testid={slot.pet ? 'sim-standard-card' : 'sim-standard-empty'}
                data-slot={slot.slot}
                aria-hidden={slot.pet ? undefined : 'true'}
              >
                {slot.pet ? (
                  <SimStandardCard
                    pet={slot.pet}
                    speciesEntry={speciesByGameId.get(slot.pet.gameId)}
                  />
                ) : (
                  <span className="sim-standard-empty-no">
                    {activePage.kind === 'box' ? slot.slot : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div
            className="sim-page-grid"
            data-testid="sim-backpack-grid"
            data-page={activePage.key}
            aria-label={`${activeAccount} ${activePage.label} 背包格子`}
          >
            {activePage.slots.map((slot) =>
              slot.pet ? (
                <SimBackpackCard
                  key={slot.slot}
                  pet={slot.pet}
                  slot={slot.slot}
                  speciesEntry={speciesByGameId.get(slot.pet.gameId)}
                />
              ) : (
                <div
                  key={slot.slot}
                  className="sim-card sim-card-empty"
                  data-testid="sim-backpack-empty-slot"
                  data-slot={slot.slot}
                  aria-hidden="true"
                >
                  {activePage.kind === 'box' ? slot.slot : ''}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {activePage ? (
        <footer className="sim-page-footer">
          <div className="sim-page-pager">
            <button
              type="button"
              className="sim-page-nav"
              onClick={() => goToPage(safePageIndex - 1)}
              disabled={safePageIndex <= 0}
              aria-label="上一页"
              data-testid="sim-backpack-prev"
            >
              ‹
            </button>
            <div className="sim-page-chips" ref={chipsRef} data-testid="sim-backpack-pages">
              {visiblePageEntries.map(({ page, index }) => (
                <button
                  key={page.key}
                  type="button"
                  className="sim-page-chip"
                  aria-current={index === safePageIndex ? 'page' : undefined}
                  aria-label={`第 ${index + 1} 页 ${page.label}`}
                  title={page.label}
                  onClick={() => goToPage(index)}
                  data-testid={`sim-backpack-page-${index}`}
                >
                  {pageChipLabel(page, index)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="sim-page-nav"
              onClick={() => goToPage(safePageIndex + 1)}
              disabled={safePageIndex >= pages.length - 1}
              aria-label="下一页"
              data-testid="sim-backpack-next"
            >
              ›
            </button>
          </div>
          <span
            className="sim-page-count"
            data-testid="sim-backpack-page-count"
            title={`第 ${safePageIndex + 1} 页 / 共 ${pages.length} 页`}
          >
            {safePageIndex + 1}/{pages.length}
          </span>
        </footer>
      ) : null}
    </main>
  );
}

/** 账号页签只显示基础名（如「洛筱」），全名放在 title 里，免得 2/3 宽度下挤成一团。 */

function pageChipLabel(page: SimBackpackPage, index: number): string {
  if (page.kind === 'offbox') return '外';
  const number = page.boxNumber;
  if (number != null && Number.isFinite(number) && number !== Number.MAX_SAFE_INTEGER) {
    return String(number).padStart(2, '0');
  }
  return String(index + 1).padStart(2, '0');
}

function SimStandardCard({
  pet,
  speciesEntry,
}: {
  pet: OwnedPet;
  speciesEntry: SpeciesEntry | undefined;
}) {
  const fullName = speciesDisplayName(speciesEntry, pet.name) || '未知精灵';
  const nature = pet.nature || '未知';
  const groups = (speciesEntry?.eggGroups ?? [])
    .filter((group) => group >= 2 && group <= 15)
    .map((group) => eggGroupNames[group] ?? `蛋组${group}`);
  const bodyIcon = petBodyMedalIcon(pet.medalBody, pet.weightPercent);
  const voiceIcon = petVoiceMedalIcon(pet.voiceDb);
  const voiceName = voiceMedalName(pet.voiceDb);
  const dbText =
    typeof pet.voiceDb === 'number' && Number.isFinite(pet.voiceDb) ? `${pet.voiceDb}dB` : '—dB';
  const sizeValue = getMyPetsSizeUnit() === 'value';
  const meters = heightMetersOf(speciesEntry?.heightSize, pet.heightPercent);
  const kilograms = weightKgOf(speciesEntry?.bodySize, pet.weightPercent);
  const heightText =
    sizeValue && meters !== null ? `${meters.toFixed(2)}m` : formatPercent(pet.heightPercent);
  const weightText =
    sizeValue && kilograms !== null ? `${kilograms.toFixed(1)}kg` : formatPercent(pet.weightPercent);
  const boxLabel = pet.boxGroup || '盒外精灵';
  const position =
    boxLabel === '盒外精灵'
      ? '盒外精灵'
      : pet.slotOrder != null
        ? `第 ${pet.slotOrder} 位`
        : '';
  const genderTone =
    pet.gender === '母'
      ? 'sim-card-female'
      : pet.gender === '公'
        ? 'sim-card-male'
        : 'sim-card-unknown';

  return (
    <article
      className={`sim-std-card ${genderTone}`}
      title={`${fullName} · ${pet.account} · ${boxLabel}${position ? ` ${position}` : ''}`}
      aria-label={`${fullName}，${pet.gender}，性格${nature}，声音${dbText}，高${heightText}，重${weightText}`}
    >
      <span className="sim-std-top">
        <span className="sim-std-avatar">
          <PetAvatar
            gameId={speciesEntry?.gameId ?? pet.gameId}
            name={fullName}
            shiny={Boolean(pet.isShiny)}
            size={48}
          />
        </span>
        <span className="sim-std-right">
          {speciesEntry?.number ? (
            <span className="sim-std-no">No.{speciesEntry.number}</span>
          ) : null}
          <span className="sim-std-eggs">
            {groups.slice(0, 2).map((group) => (
              <span key={group} title={group}>
                {group}
              </span>
            ))}
          </span>
          <span className="sim-std-nature">
            <GenderMark gender={pet.gender} />
            <span className="sim-std-nature-text" title={nature}>
              {nature}
            </span>
          </span>
          <span className="sim-std-medals">
            {bodyIcon ? <img src={bodyIcon} alt={pet.medalBody} title={pet.medalBody} /> : null}
            {voiceIcon ? <img src={voiceIcon} alt={voiceName ?? ''} title={voiceName ?? ''} /> : null}
          </span>
          <span className="sim-std-db">{dbText}</span>
        </span>
      </span>
      <span
        className="sim-std-name"
        title={fullName}
        data-name-length={fullName.length > 10 ? 'long' : fullName.length > 7 ? 'mid' : 'short'}
      >
        {fullName}
      </span>
      <span className="sim-std-details">
        高{heightText} · 重{weightText}
      </span>
    </article>
  );
}

function SimBackpackCard({
  pet,
  slot,
  speciesEntry,
}: {
  pet: OwnedPet;
  slot: number;
  speciesEntry: SpeciesEntry | undefined;
}) {
  const fullName = speciesDisplayName(speciesEntry, pet.name) || '未知精灵';
  const displayName = compactPetName(fullName) || fullName;
  const nature = pet.nature || '未知';
  const bodyIcon = petBodyMedalIcon(pet.medalBody, pet.weightPercent);
  const voiceIcon = petVoiceMedalIcon(pet.voiceDb);
  const voiceName = voiceMedalName(pet.voiceDb);
  const dbText =
    typeof pet.voiceDb === 'number' && Number.isFinite(pet.voiceDb) ? `${pet.voiceDb}dB` : '—dB';
  const boxLabel = pet.boxGroup || '盒外精灵';
  const position =
    boxLabel === '盒外精灵'
      ? '盒外精灵'
      : pet.slotOrder != null
        ? `第 ${pet.slotOrder} 位`
        : `第 ${slot} 格`;
  const positionText = boxLabel === '盒外精灵' ? '盒外精灵' : `${boxLabel} ${position}`;

  const genderTone =
    pet.gender === '母'
      ? 'sim-card-female'
      : pet.gender === '公'
        ? 'sim-card-male'
        : 'sim-card-unknown';

  return (
    <article
      className={`sim-card ${genderTone}`}
      data-testid="sim-backpack-pet"
      data-slot={slot}
      data-account={pet.account}
      data-box={boxLabel}
      title={`${fullName} · ${pet.account} · ${positionText}`}
      aria-label={`${fullName}，${pet.gender}，性格${nature}，声音${dbText}，${pet.account} ${positionText}`}
    >
      <span className="sim-card-body">
        <span className="sim-card-avatar">
          <PetAvatar
            gameId={speciesEntry?.gameId ?? pet.gameId}
            name={fullName}
            shiny={Boolean(pet.isShiny)}
            size={48}
          />
        </span>
        <span className="sim-card-stats">
          <span className="sim-card-nature">
            <GenderMark gender={pet.gender} />
            <span className="sim-card-nature-text" title={`性格：${nature}`}>
              {nature}
            </span>
          </span>
          <span className="sim-card-medals">
            {bodyIcon ? <img src={bodyIcon} alt={pet.medalBody} title={pet.medalBody} /> : null}
            {voiceIcon ? <img src={voiceIcon} alt={voiceName ?? ''} title={voiceName ?? ''} /> : null}
          </span>
          <span className="sim-card-db">{dbText}</span>
        </span>
      </span>
      <span className="sim-card-name" title={fullName}>
        {displayName}
      </span>
    </article>
  );
}
