import {shopAccess} from '@/lib/auth';
import {WaitlistWorkspace} from './workspace';
import {db} from '@/lib/db';
export default async function WaitlistPage(){const {shop}=await shopAccess();const result=await db.query('SELECT public_slug FROM shops WHERE id=$1',[shop.id]);return <WaitlistWorkspace shopId={shop.id} slug={result.rows[0]?.public_slug||null}/>}
