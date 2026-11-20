import {directoryCatalog} from '@/lib/directory';
import {Directory} from './ui';
import './directory.css';
export const dynamic='force-dynamic';
export default async function DirectoryPage(){return <Directory services={await directoryCatalog()}/>}
