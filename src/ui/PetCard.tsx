import type { OwnedPet, SpeciesEntry } from '../domain/types';
import { petBodyMedalIcon, petVoiceMedalIcon, rarityIcon, voiceMedalName } from '../domain/petIcons';
import { speciesDisplayName } from '../domain/speciesName';
import { GenderMark } from './GenderMark';
import { PetAvatar } from './PetAvatar';
import { PetCardLayout } from './PetCardLayout';

/** 稀有度名字：图标的 title / alt 用。 */
const RARITY_TEXT: Record<string, string> = {
  shiny: '异色',
  colorful: '炫彩',
  'shiny-colorful': '异色炫彩',
};

export interface PetCardProps {
  pet: OwnedPet;
  species?: SpeciesEntry;
  eggGroupNames: Record<number, string>;
}

/** 精灵背包中的标准卡片。 */
export function PetCard({ pet, species, eggGroupNames }: PetCardProps) {
  const displayName = speciesDisplayName(species, pet.name);
  const avatarGameId = species?.gameId ?? pet.gameId;
  const rarityKind = pet.isShiny && pet.isColorful
    ? 'shiny-colorful'
    : pet.isColorful
      ? 'colorful'
      : pet.isShiny
        ? 'shiny'
        : null;
  const raritySrc = rarityIcon(rarityKind);
  const rarityName = rarityKind ? RARITY_TEXT[rarityKind] : null;
  const eggGroups = (species?.eggGroups ?? [])
    .filter((group) => group >= 2 && group <= 15)
    .map((group) => eggGroupNames[group] ?? `蛋组${group}`);
  const position = pet.account
    ? pet.boxGroup
      ? `${pet.account}·${pet.boxGroup}${pet.slotOrder != null ? `·${pet.slotOrder}` : ''}`
      : pet.account
    : '—';
  const bodyIcon = petBodyMedalIcon(pet.medalBody, pet.weightPercent);
  const voiceIcon = petVoiceMedalIcon(pet.voiceDb);
  const voiceName = voiceMedalName(pet.voiceDb);

  return (
    <PetCardLayout
      name={displayName}
      number={species?.number}
      eggGroups={eggGroups}
      natures={pet.nature ? [pet.nature] : []}
      avatar={
        <span className="relative inline-flex h-11 w-11 items-center justify-center">
          <PetAvatar
            gameId={avatarGameId}
            name={displayName}
            shiny={Boolean(pet.isShiny)}
            size={44}
          />
          {raritySrc ? (
            <img
              src={raritySrc}
              alt={rarityName ?? ''}
              title={rarityName ?? ''}
              className="absolute -right-1 -top-1 h-3 w-3 drop-shadow-sm"
            />
          ) : null}
        </span>
      }
      details={
        <div className="flex min-w-0 items-center justify-center gap-px whitespace-nowrap text-[6px] leading-[8px] text-slate-600">
          <span className="flex shrink-0 items-center gap-px">
            <GenderMark gender={pet.gender} />
            {bodyIcon ? (
              <img src={bodyIcon} alt={pet.medalBody} title={pet.medalBody} className="h-2.5 w-2.5" />
            ) : null}
            {voiceIcon ? (
              <img src={voiceIcon} alt={voiceName ?? ''} title={voiceName ?? ''} className="h-2.5 w-2.5" />
            ) : null}
          </span>
          <span className="min-w-0 truncate">
            {pet.weightPercent != null ? `${pet.weightPercent.toFixed(2)}%` : '—'} · {pet.voiceDb}dB
          </span>
        </div>
      }
      footer={
        <span className="w-full truncate text-center text-[6px] leading-[8px] text-slate-400" title={position}>
          {position}
        </span>
      }
    />
  );
}
