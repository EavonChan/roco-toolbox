-- 2026-11-01：需求新增「是否要求绿窝（学院小窝）」。
--
-- 用法（线上 / 本地，按需选其一）：
--   npx wrangler d1 execute roco-toolbox-db --remote --file functions/migrations/2026-11-01-collection-demand-green-nest.sql
--   npx wrangler d1 execute roco-toolbox-db --local --persist-to <目录> --file functions/migrations/2026-11-01-collection-demand-green-nest.sql
--
-- 只加列、不动主键：同一组条件下重复发布仍按原规则「不覆盖已接单的行」。
-- 与 functions/schema.sql 的 `>>> collection-demands (2026-10-26)` /
-- `>>> collection-demand-completions (2026-10-29)` 区块保持一致。

ALTER TABLE collection_group_demands
  ADD COLUMN require_green_nest INTEGER NOT NULL DEFAULT 0;

ALTER TABLE collection_group_demand_completions
  ADD COLUMN require_green_nest INTEGER NOT NULL DEFAULT 0;
