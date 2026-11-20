import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/request-origin';
import {BookingError,todayNZ} from '@/lib/booking';
import {directoryCatalog,searchDirectory,mintDirectorySelection,getDirectorySelection} from '@/lib/directory';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
function failure(e:unknown){if(e instanceof BookingError)return NextResponse.json({error:e.message},{status:400,headers});console.error('Directory request failed');return NextResponse.json({error:'The directory is temporarily unavailable. Please try again.'},{status:500,headers})}
export async function GET(request:Request){try{const p=new URL(request.url).searchParams;if(p.get('view')==='catalog')return NextResponse.json({services:await directoryCatalog()},{headers});return NextResponse.json(await searchDirectory({date:p.get('date')||todayNZ(),service:p.get('service')||'',period:p.get('period')||'any'}),{headers})}catch(e){return failure(e)}}
export async function POST(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403,headers});try{const d=await request.json();if(!d||typeof d!=='object'||Array.isArray(d))throw new BookingError('Invalid request.');const result=d.action==='select'?await mintDirectorySelection(d):d.action==='lookup'?await getDirectorySelection(d.token,d.slug):null;if(!result)throw new BookingError('Invalid request.');return NextResponse.json(result,{headers})}catch(e){return failure(e)}}
