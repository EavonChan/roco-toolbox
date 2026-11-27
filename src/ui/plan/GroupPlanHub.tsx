import type { MotherGroupResourcesProps } from '../MotherGroupResources';
import { EggMatchingHub } from './EggMatchingHub';
export interface GroupPlanHubProps extends MotherGroupResourcesProps {
  className?:string;
  onGoPlan?: () => void;
  /** 「我的」页的蛋仓入口直达：透传给换蛋页的蛋仓屏（2026-11-25 U2） */
  openStock?: boolean;
  onStockOpened?: () => void;
  /** 蛋仓屏「返回」的去向（2026-11-25 U3）：透传给蛋仓屏，不传 = 回换蛋页 */
  onStockBack?: () => void;
  stockBackLabel?: string;
}
export function GroupPlanHub({className,openStock,onStockOpened,onStockBack,stockBackLabel,...resources}:GroupPlanHubProps){
 return <div className={className}><EggMatchingHub groupId={resources.group.group.id} viewerAccountId={resources.viewerAccountId} species={resources.species} members={resources.group.members} snapshots={resources.snapshots} onGoPlan={resources.onGoPlan} openStock={openStock} onStockOpened={onStockOpened} onStockBack={onStockBack} stockBackLabel={stockBackLabel}/></div>;
}
