import type { OwnedPet, SpeciesEntry } from '../domain/types';
import { PetCard } from './PetCard';

export interface PetListProps {
  pets: OwnedPet[];
  speciesByGameId: Map<number, SpeciesEntry>;
  eggGroupNames: Record<number, string>;
  showCount?: boolean;
}

export function PetList({ pets, speciesByGameId, eggGroupNames, showCount = true }: PetListProps) {
  return (
    <div className="space-y-2">
      {showCount ? (
        <p className="text-xs text-slate-500" data-testid="pet-count">
          共 {pets.length} 只
        </p>
      ) : null}

      {/* 一行四张：移动端保持紧凑卡片网格 */}
      <ul className="grid grid-cols-4 gap-1.5" data-testid="pet-list-items">
        {pets.map((pet, index) => (
          <li key={`${pet.account}-${pet.gameId}-${index}`}>
            <PetCard
              pet={pet}
              species={speciesByGameId.get(pet.gameId)}
              eggGroupNames={eggGroupNames}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
