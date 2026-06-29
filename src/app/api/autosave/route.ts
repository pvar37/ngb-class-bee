import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with the Service Role key to securely bypass RLS on the backend
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { student_id, question_id, selected_option } = body;

    // Validate payload
    if (!student_id || !question_id || !selected_option) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert the response: if (student_id, question_id) exists, it updates; otherwise, it inserts
    const { error } = await supabase
      .from('responses')
      .upsert(
        {
          student_id,
          question_id,
          selected_option
        },
        { onConflict: 'student_id, question_id' }
      );

    if (error) {
      console.error('Supabase UPSERT Error:', error);
      return NextResponse.json({ error: 'Database write failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 500 });
  }
}