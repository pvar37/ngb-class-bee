import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { student_id } = await request.json();

    if (!student_id) {
      return NextResponse.json({ error: 'Missing student ID' }, { status: 400 });
    }

    const { data: student, error } = await supabase
      .from('students')
      .select('start_time, has_extended_time')
      .eq('id', student_id)
      .single();

    if (error || !student) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      start_time: student.start_time,
      has_extended_time: student.has_extended_time
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}