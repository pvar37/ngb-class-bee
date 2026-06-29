import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { student_id, firstName, lastName, grade, accessCode } = await request.json();

    // 1. Basic validation
    if (!student_id || !firstName || !lastName || !grade || !accessCode) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // 2. Query the schools table for the access code
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, standard_code, extended_code')
      .or(`standard_code.eq.${accessCode},extended_code.eq.${accessCode}`)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ error: 'Invalid access code.' }, { status: 404 });
    }

    // 3. Determine time accommodation based on which code was used
    const hasExtendedTime = accessCode === school.extended_code;

    // 4. Initialize the student record
    // We pass the frontend-generated UUID so localStorage stays perfectly in sync
    const { error: insertError } = await supabase
      .from('students')
      .insert({
        id: student_id,
        first_name: firstName,
        last_name: lastName,
        grade: parseInt(grade),
        school_id: school.id,
        has_extended_time: hasExtendedTime
        // start_time defaults to NOW() in PostgreSQL
      });

    if (insertError) {
      console.error('Failed to create student:', insertError);
      return NextResponse.json({ error: 'Failed to start exam. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}