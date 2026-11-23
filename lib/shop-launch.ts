import {db} from './db';
import {BookingError} from './booking';

export async function launchApprovalView(){
 return (await db.query(`SELECT s.id,s.name,s.location,s.booking_published,a.approved_at,a.source,
 EXISTS(SELECT 1 FROM shop_owners o JOIN staff u ON u.id=o.staff_id JOIN memberships m ON m.shop_id=o.shop_id AND m.staff_id=o.staff_id WHERE o.shop_id=s.id AND u.email_verified_at IS NOT NULL AND u.verified_email=u.email) AS owner_verified
 FROM shops s LEFT JOIN shop_launch_approvals a ON a.shop_id=s.id ORDER BY s.name,s.id`)).rows;
}
// Called only after operator authentication and same-origin checks. Approval does
// not publish a shop, grant a plan, or enable any delivery/restore feature flag.
export async function approveShopLaunch(shopId:string,operatorId:string){
 const result=await db.query(`INSERT INTO shop_launch_approvals(shop_id,approved_by,source)
 SELECT s.id,$2,'operator' FROM shops s WHERE s.id=$1 AND EXISTS(
 SELECT 1 FROM shop_owners o JOIN staff u ON u.id=o.staff_id JOIN memberships m ON m.shop_id=o.shop_id AND m.staff_id=o.staff_id
 WHERE o.shop_id=s.id AND u.email_verified_at IS NOT NULL AND u.verified_email=u.email)
 ON CONFLICT(shop_id) DO NOTHING RETURNING shop_id`,[shopId,operatorId]);
 if(!result.rowCount&&!(await db.query('SELECT 1 FROM shop_launch_approvals WHERE shop_id=$1',[shopId])).rowCount)throw new BookingError('A verified owner is required before approving this shop to go live.');
 return {ok:true};
}
