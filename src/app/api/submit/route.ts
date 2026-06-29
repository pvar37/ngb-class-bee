import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with the Service Role key to bypass RLS securely
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { student_id, answers } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'Missing student ID' }, { status: 400 });
    }

    // 1. Fetch student data to validate the session and check for double-submissions
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('start_time, end_time, has_extended_time')
      .eq('id', student_id)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (student.end_time) {
      return NextResponse.json({ error: 'Exam already submitted' }, { status: 403 });
    }

    // 2. Authoritative Time Validation
    const startTime = new Date(student.start_time).getTime();
    const currentTime = new Date().getTime();
    const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

    const allowedSeconds = student.has_extended_time ? 2700 : 1800;
    const gracePeriod = 120; // 2 minutes to account for offline resilience bulk uploads

    if (elapsedSeconds > allowedSeconds + gracePeriod) {
      console.warn(`Time violation for student ${student_id}. Elapsed: ${elapsedSeconds}s`);
      // You can either reject this entirely, or flag it. We will proceed but you can 
      // add a 'time_violation' boolean column to the database if you prefer to audit them.
    }

    // 3. Fetch the Answer Key
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, correct_answer')
      .order('id', { ascending: false }); // Fetch descending (50 to 1) for the tiebreaker

    if (qError || !questions) {
      return NextResponse.json({ error: 'Failed to fetch answer key' }, { status: 500 });
    }

    // 4. Calculate Score and Generate Reverse-Order Tiebreaker String
    let score = 0;
    let tiebreakerString = '';

    // Since we ordered descending, the loop processes Q50, then Q49, etc.
    for (const q of questions) {
      const studentAnswer = answers[q.id];
      if (studentAnswer && studentAnswer === q.correct_answer) {
        score += 1;
        tiebreakerString += '1';
      } else {
        tiebreakerString += '0';
      }
    }

    // 5. Final Database Update
    const { error: updateError } = await supabase
      .from('students')
      .update({
        score: score,
        tiebreaker_string: tiebreakerString,
        end_time: new Date().toISOString() // Server-generated end time
      })
      .eq('id', student_id);

    if (updateError) {
      console.error('Failed to update student record:', updateError);
      return NextResponse.json({ error: 'Failed to save final score' }, { status: 500 });
    }

    // 6. Sync final offline answers just to ensure the responses table is perfectly accurate
    const upsertPayload = Object.keys(answers).map((qId) => ({
      student_id,
      question_id: parseInt(qId),
      selected_option: answers[qId as keyof typeof answers]
    }));

    if (upsertPayload.length > 0) {
      await supabase
        .from('responses')
        .upsert(upsertPayload, { onConflict: 'student_id, question_id' });
    }

    return NextResponse.json({ success: true, score }, { status: 200 });

  } catch (error) {
    console.error('Server error during submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}