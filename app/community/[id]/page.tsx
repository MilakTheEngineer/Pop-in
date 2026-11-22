import {CommunityGuest} from './ui';
import '../community.css';
export const metadata={title:'Community cut day · Varello',robots:{index:false,follow:false}};
export default async function CommunityPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <CommunityGuest eventId={id}/>}
