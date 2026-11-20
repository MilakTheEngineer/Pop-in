import {ManageBooking} from '../book/[slug]/ui';
export const metadata={title:'Manage your booking',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function ManagePage(){return <ManageBooking/>}
