import type {PoolClient} from 'pg';
import {db} from './db';

// All hold transitions lock the hold before its schedule entry. Expiration is
// opportunistic so availability never depends on a background worker.
export async function expireDepositHolds(shopId:string,q:Pick<PoolClient,'query'>=db){
 await q.query(`WITH expired AS (
   UPDATE deposit_holds SET state='expired',updated_at=now()
   WHERE shop_id=$1 AND state IN ('creating','pending') AND expires_at<=clock_timestamp()
   RETURNING hold_entry_id
 ) UPDATE schedule_entries e SET status='cancelled' FROM expired x
 WHERE e.id=x.hold_entry_id AND e.shop_id=$1 AND e.kind='block' AND e.status='blocked'`,[shopId]);
}
