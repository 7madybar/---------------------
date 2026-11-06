import type { Member } from './constants';
export function managesTeam(role: Member['role']) { return role === 'owner' || role === 'admin'; }
export function managesMember(actor: Member, target: Member) {
  return managesTeam(actor.role) && (target.role !== 'owner' || actor.role === 'owner');
}
