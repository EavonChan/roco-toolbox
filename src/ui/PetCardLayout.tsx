import type { KeyboardEvent, ReactNode } from 'react';

export interface PetCardLayoutProps {
  name: string;
  number?: string;
  eggGroups?: readonly string[];
  natures?: readonly string[];
  avatar: ReactNode;
  details?: ReactNode;
  footer?: ReactNode;
  testId?: string;
  eggGroupsTestId?: string;
  naturesTestId?: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
  academy?: boolean;
  onClick?: () => void;
  ariaPressed?: boolean;
}

/** Shared card frame for pet displays across the app. */
export function PetCardLayout({
  name,
  number,
  eggGroups = [],
  natures = [],
  avatar,
  details,
  footer,
  testId,
  eggGroupsTestId = 'pet-card-egg-groups',
  naturesTestId = 'pet-card-natures',
  title,
  ariaLabel,
  className = '',
  academy,
  onClick,
  ariaPressed,
}: PetCardLayoutProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onClick();
  };
  const showDetails = details != null && details !== false;
  const showFooter = footer != null && footer !== false;

  return (
    <article
      className={`relative h-[98px] min-w-0 overflow-hidden rounded-xl border border-emerald-300 bg-emerald-50/60 p-1 shadow-sm ${onClick ? 'cursor-pointer hover:border-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500' : ''} ${className}`}
      data-testid={testId}
      data-academy={academy ? 'true' : undefined}
      title={title}
      aria-label={ariaLabel}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? ariaPressed : undefined}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
    >
      <header className="absolute inset-x-1 top-1 z-10 grid max-h-[48px] grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-start overflow-hidden text-[7px] leading-[8px]">
        <div className="flex min-w-0 flex-col items-start gap-px">
          {number ? (
            <span className="truncate font-semibold text-slate-500">No.{number}</span>
          ) : (
            <span className="h-2" aria-hidden />
          )}
          <span className="flex min-w-0 flex-col items-start gap-px" data-testid={eggGroupsTestId}>
            {eggGroups.map((group) => (
              <span
                key={group}
                className="max-w-full truncate rounded bg-sky-100 px-0.5 py-0 text-sky-800"
                title={group}
              >
                {group}
              </span>
            ))}
          </span>
        </div>
        <div className="col-start-2 row-start-1 mt-1 flex h-11 w-11 items-center justify-center">
          {avatar}
        </div>
        <span
          className="col-start-3 row-start-1 flex min-w-0 flex-col items-end gap-px"
          data-testid={naturesTestId}
        >
          {natures.map((nature) => (
            <span
              key={nature}
              className="max-w-full truncate rounded bg-amber-100 px-0.5 py-0 font-medium text-amber-900"
              title={nature}
            >
              {nature}
            </span>
          ))}
        </span>
      </header>

      <h3
        className="absolute inset-x-1 top-[52px] flex h-[18px] items-center justify-center overflow-hidden text-center text-[9px] font-bold leading-[10px] text-slate-900 line-clamp-2"
        title={title ?? name}
      >
        {name}
      </h3>

      {showDetails ? (
        <div className="absolute inset-x-1 top-[70px] flex h-3 items-center justify-center overflow-hidden text-center">
          {details}
        </div>
      ) : null}

      {showFooter ? (
        <div
          className="absolute inset-x-1 bottom-1 flex h-3 items-center justify-center"
        >
          {footer}
        </div>
      ) : null}
    </article>
  );
}
