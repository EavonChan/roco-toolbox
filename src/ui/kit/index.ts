/**
 * 原语层出口（DESIGN1，2026-11-28）。
 *
 * 只做「结构 + tokens」，不含业务。页面区块从这里取件，
 * 不要在区块里再写一套字号 / 间距 / 圆角。
 */
export { Card } from './Card';
export type { CardProps } from './Card';
export { Row } from './Row';
export type { RowProps } from './Row';
export { Chip } from './Chip';
export type { ChipProps, ChipTone } from './Chip';
export { Section } from './Section';
export type { SectionProps } from './Section';
export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
