import type {PoolClient} from 'pg';
import {BookingError} from './booking';
import {PLANS,type PlanCode} from './plans';

type Queryable=Pick<PoolClient,'query'>;
export async function planSnapshot(q:Queryable,shopId:string,lock=false){
 const group=await q.query(`SELECT g.id,g.plan_code FROM location_groups g JOIN shops s ON s.location_group_id=g.id WHERE s.id=$1${lock?' FOR UPDATE OF g':''}`,[shopId]);if(!group.rowCount)throw new BookingError('Shop not found.');const {id,plan_code}=group.rows[0] as {id:string;plan_code:PlanCode};
 const members=await q.query('SELECT DISTINCT m.staff_id FROM memberships m JOIN shops s ON s.id=m.shop_id WHERE s.location_group_id=$1',[id]);
 const profiles=await q.query('SELECT DISTINCT b.person_id FROM barbers b JOIN shops s ON s.id=b.shop_id WHERE s.location_group_id=$1',[id]);
 const links=await q.query('SELECT l.staff_id,b.person_id FROM staff_barber_links l JOIN barbers b ON b.id=l.barber_id AND b.shop_id=l.shop_id JOIN shops s ON s.id=l.shop_id WHERE s.location_group_id=$1',[id]);
 const locations=await q.query('SELECT count(*)::int AS n FROM shops WHERE location_group_id=$1',[id]);
 const parents=new Map<string,string>();function find(x:string):string{if(!parents.has(x))parents.set(x,x);const p=parents.get(x)!;if(p===x)return x;const root=find(p);parents.set(x,root);return root}for(const r of members.rows)find('s:'+r.staff_id);for(const r of profiles.rows)find('p:'+r.person_id);for(const r of links.rows){const a=find('s:'+r.staff_id),b=find('p:'+r.person_id);if(a!==b)parents.set(a,b)}const people=new Set([...parents.keys()].map(find)).size;
 return {groupId:id,code:plan_code,plan:PLANS[plan_code],people,locations:locations.rows[0].n as number};
}
export async function enforcePlanGrowth(q:Queryable,shopId:string,before:Awaited<ReturnType<typeof planSnapshot>>){const after=await planSnapshot(q,shopId);if(after.plan.people!==null&&after.people>after.plan.people&&after.people>before.people)throw new BookingError(`${after.plan.name} includes ${after.plan.people} ${after.plan.people===1?'person':'people'}. Choose a plan with more team members.`);if(after.locations>after.plan.locations&&after.locations>before.locations)throw new BookingError(`${after.plan.name} includes ${after.plan.locations} ${after.plan.locations===1?'location':'locations'}. Additional locations are not available yet.`);return after}
