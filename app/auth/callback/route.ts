import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('suite') || '/tableau-de-bord';
  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/tableau-de-bord';
  return NextResponse.redirect(new URL(safe, url.origin));
}
