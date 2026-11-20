import {notFound,redirect} from 'next/navigation';
import {operatorAccess,operatorView} from '@/lib/operator';
import {db} from '@/lib/db';
import {OperatorWorkspace} from './workspace';
export const dynamic='force-dynamic';
export default async function OperatorPage(){const access=await operatorAccess();if(access.status==='unauthenticated')redirect('/login?next=operator');if(access.status!=='allowed')notFound();const [data,membership]=await Promise.all([operatorView(''),db.query('SELECT 1 FROM memberships WHERE staff_id=$1 LIMIT 1',[access.user.id])]);return <OperatorWorkspace initial={JSON.parse(JSON.stringify(data))} canOpenStaff={!!membership.rowCount}/>}
