import type { MotherGroupResourcesProps } from '../MotherGroupResources';
import { EggMatchingHub } from './EggMatchingHub';
export interface GroupPlanHubProps extends MotherGroupResourcesProps {
  className?:string;
  onGoPlan?: () => void;
}
export function GroupPlanHub({className,...resources}:GroupPlanHubProps){
 return <div className={className}><EggMatchingHub groupId={resources.group.group.id} viewerAccountId={resources.viewerAccountId} species={resources.species} members={resources.group.members} snapshots={resources.snapshots} onGoPlan={resources.onGoPlan}/></div>;
}
