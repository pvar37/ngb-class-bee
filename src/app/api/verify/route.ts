import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessCode = body?.accessCode?.trim().toUpperCase();

    if (!accessCode) {
      return NextResponse.json({ error: 'Access code is required' }, { status: 400 });
    }

    const { data: school, error } = await supabase
      .from('schools')
      .select('id, standard_code, extended_code')
      .or(`standard_code.eq.${accessCode},extended_code.eq.${accessCode}`)
      .single();

    if (error || !school) {
      return NextResponse.json({ error: 'Invalid school access code. Please check with your teacher.' }, { status: 404 });
    }

    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (err) {
    console.error('Verify error:', err);
    return NextResponse.json({ error: 'Failed to verify access code.' }, { status: 500 });
  }
}
