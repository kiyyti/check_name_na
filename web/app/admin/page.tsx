import {redirect} from 'next/navigation';
import {adminUser} from '@/lib/admin-auth';
import Dashboard from './dashboard';
export const dynamic='force-dynamic';
export default async function AdminPage(){const user=await adminUser();if(!user)redirect('/admin/login');return <Dashboard username={user}/>;}
