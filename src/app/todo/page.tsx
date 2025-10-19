import { createClient } from '@/app/utils/supabase/server';
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const data = await supabase.from('Dashboard Rules').select('*');
  console.log('data:', data);
  return (
    <ul>
      <li>one</li>
    </ul>
  );
}
