'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Student {
  id: string;
  first_name: string;
  middle_initial?: string;
  last_name: string;
  grade: string;
  score: number;
  tiebreaker_string: string;
  start_time: string;
  end_time: string;
  school_id: string;
  rank: number;
  infractions: number;
}

const formatStudentName = (s: Student) => {
  if (s.middle_initial) {
    return `${s.first_name} ${s.middle_initial}. ${s.last_name}`;
  }
  return `${s.first_name} ${s.last_name}`;
};

const getTieBreakingQuestion = (str1: string, str2: string) => {
  if (!str1 || !str2) return null;
  for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
    if (str1[i] !== str2[i]) {
      // The tiebreaker string is indexed descending from Q50 (index 0) down to Q1 (index 49)
      return str1.length - i;
    }
  }
  return null;
};

const escapeCSV = (val: any) => {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const downloadCSV = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function TeacherDashboard() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exportingType, setExportingType] = useState<'summary' | 'item' | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError || !session) {
        router.push('/teacher');
        return;
      }

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .not('end_time', 'is', null)
        .order('score', { ascending: false })
        .order('tiebreaker_string', { ascending: false });

      if (!error && data) {
        const rankedData = data.map((s, index) => ({ ...s, rank: index + 1 }));
        setStudents(rankedData);
      }
      setIsLoading(false);
    }

    loadDashboard();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/teacher');
  };

  const exportSummaryCSV = async () => {
    if (students.length === 0) return;
    setExportingType('summary');

    try {
      const headers = [
        'Rank',
        'First Name',
        'M.I.',
        'Last Name',
        'Grade',
        'Score (out of 50)',
        'Infractions',
        'Start Time',
        'End Time'
      ];

      const rows = students.map(s => [
        s.rank,
        escapeCSV(s.first_name),
        escapeCSV(s.middle_initial || ''),
        escapeCSV(s.last_name),
        s.grade,
        s.score,
        s.infractions || 0,
        escapeCSV(new Date(s.start_time).toLocaleString()),
        escapeCSV(new Date(s.end_time).toLocaleString())
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      downloadCSV('class_bee_summary_roster.csv', csvContent);
    } catch (err) {
      console.error('Failed to export summary CSV:', err);
    } finally {
      setExportingType(null);
    }
  };

  const exportItemAnalysisCSV = async () => {
    if (students.length === 0) return;
    setExportingType('item');

    try {
      // 1. Fetch questions with prompts and correct answers
      const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('id, question_text, correct_answer')
        .order('id', { ascending: true });

      if (qError || !questions) {
        console.error('Failed to load questions for export:', qError);
        return;
      }

      // 2. Fetch all student responses
      const studentIds = students.map(s => s.id);
      const { data: responses, error: rError } = await supabase
        .from('responses')
        .select('student_id, question_id, selected_option')
        .in('student_id', studentIds);

      if (rError || !responses) {
        console.error('Failed to load responses for export:', rError);
        return;
      }

      // 3. Map responses to responseMap[student_id][question_id] = option
      const responseMap: Record<string, Record<number, string>> = {};
      responses.forEach(r => {
        if (!responseMap[r.student_id]) responseMap[r.student_id] = {};
        responseMap[r.student_id][r.question_id] = r.selected_option;
      });

      // 4. Calculate Question Accuracy counts
      const questionAccuracy: Record<number, number> = {};
      questions.forEach(q => {
        let correctCount = 0;
        students.forEach(s => {
          const selected = responseMap[s.id]?.[q.id];
          if (selected && selected.trim() === q.correct_answer?.trim()) {
            correctCount += 1;
          }
        });
        questionAccuracy[q.id] = Math.round((correctCount / students.length) * 100);
      });

      // 5. Build CSV structure
      // Row 1: Headers
      const headers = ['Rank', 'First Name', 'M.I.', 'Last Name', 'Grade', 'Score (out of 50)', 'Infractions', 'Start Time', 'End Time'];
      questions.forEach((_, idx) => headers.push(`Q${idx + 1}`));

      // Row 2: Answer Key Row
      const keyRow = ['KEY', 'Correct Answer', '-', '-', '-', '-', '-', '-', '-'];
      questions.forEach(q => keyRow.push(escapeCSV(q.correct_answer || '')));

      // Row 3: Question Text Prompt Row
      const promptRow = ['PROMPT', 'Question Text', '-', '-', '-', '-', '-', '-', '-'];
      questions.forEach(q => promptRow.push(escapeCSV(q.question_text || '')));

      // Row 4: Class Accuracy Percentage Row
      const accuracyRow = ['STATS', 'Class Accuracy %', '-', '-', '-', '-', '-', '-', '-'];
      questions.forEach(q => accuracyRow.push(escapeCSV(`${questionAccuracy[q.id]}%`)));

      // Rows 5+: Student Rows with Selected Option + Points (1 pt vs 0 pt)
      const studentRows = students.map(s => {
        const row = [
          s.rank,
          escapeCSV(s.first_name),
          escapeCSV(s.middle_initial || ''),
          escapeCSV(s.last_name),
          s.grade,
          s.score,
          s.infractions || 0,
          escapeCSV(new Date(s.start_time).toLocaleString()),
          escapeCSV(new Date(s.end_time).toLocaleString())
        ];

        questions.forEach(q => {
          const selected = responseMap[s.id]?.[q.id];
          if (!selected) {
            row.push(escapeCSV('Skipped (0)'));
          } else {
            const isCorrect = selected.trim() === q.correct_answer?.trim();
            row.push(escapeCSV(`${selected} (${isCorrect ? '1' : '0'})`));
          }
        });

        return row;
      });

      const csvContent = [
        headers.join(','),
        keyRow.join(','),
        promptRow.join(','),
        accuracyRow.join(','),
        ...studentRows.map(r => r.join(','))
      ].join('\n');

      downloadCSV('class_bee_item_analysis.csv', csvContent);
    } catch (err) {
      console.error('Failed to export item analysis CSV:', err);
    } finally {
      setExportingType(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-ngb-yellow p-4">
        <img
          src="/ngb-logo-text.png"
          alt="National Geography Bee"
          className="h-16 w-auto object-contain mb-4 animate-pulse"
        />
        <h3 className="font-exo font-bold text-2xl text-black">Loading Dashboard...</h3>
      </div>
    );
  }

  const top10 = students.slice(0, 10);

  // LOGIC: Only check for ties across the exact 10th/11th place cutoff boundary
  let cutoffTiedGroup: Student[] = [];
  if (students.length > 10 && students[9].score === students[10].score) {
    const cutoffScore = students[9].score;
    cutoffTiedGroup = students.filter(s => s.score === cutoffScore);
  }

  return (
    <div className="min-h-screen bg-ngb-yellow p-4 md:p-10 font-exo text-black pb-20">
      <div className="max-w-6xl mx-auto">

        {/* Header Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white shadow-xl rounded-2xl p-6 mb-8 border-2 border-black gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left w-full md:w-auto">
            <img
              src="/ngb-logo-text.png"
              alt="National Geography Bee"
              className="h-14 md:h-16 w-auto object-contain shrink-0"
            />
            <div className="sm:border-l-2 sm:border-gray-200 sm:pl-5">
              <h1 className="font-bold text-2xl md:text-3xl">Class Bee Dashboard</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto justify-center md:justify-end">
            <button
              onClick={exportSummaryCSV}
              className="flex-1 md:flex-none bg-black text-ngb-yellow px-5 py-3 rounded-full font-bold transition-colors hover:bg-ngb-dark disabled:opacity-50 text-sm md:text-base cursor-pointer shadow-sm"
              disabled={students.length === 0 || exportingType !== null}
              title="Download summary of student ranks, scores, and infractions"
            >
              {exportingType === 'summary' ? 'Exporting...' : 'Summary CSV'}
            </button>
            <button
              onClick={exportItemAnalysisCSV}
              className="flex-1 md:flex-none bg-black text-ngb-yellow px-5 py-3 rounded-full font-bold transition-colors hover:bg-ngb-dark disabled:opacity-50 text-sm md:text-base cursor-pointer shadow-sm"
              disabled={students.length === 0 || exportingType !== null}
              title="Download full question-by-question responses, answer key, and 0/1 points"
            >
              {exportingType === 'item' ? 'Exporting...' : 'Item Analysis CSV'}
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 md:flex-none bg-white text-black border-2 border-black px-5 py-3 rounded-full font-bold transition-colors hover:bg-gray-50 text-sm md:text-base cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Live Leaderboard UI */}
        <div className="bg-white shadow-xl rounded-2xl p-6 md:p-10 border-2 border-black mb-8">
          <h2 className="font-bold text-2xl mb-6 border-b-2 border-black pb-3">Official Top 10</h2>

          {students.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-libre text-lg">
              No students have completed the Class Bee yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-black text-sm uppercase tracking-wider">
                    <th className="p-4 font-bold rounded-tl-xl">Rank</th>
                    <th className="p-4 font-bold">Name</th>
                    <th className="p-4 font-bold">Grade</th>
                    <th className="p-4 font-bold rounded-tr-xl text-right">Score</th>
                      <th
                        className="p-4 font-bold text-center cursor-help"
                        title="The number of times this student navigated away from the testing window or attempted to copy/paste."
                      >
                        Infractions ⓘ
                      </th>
                  </tr>
                </thead>
                <tbody>
                  {top10.map((student) => (
                    <tr
                      key={student.id}
                      className={`border-b border-gray-200 transition-colors hover:bg-gray-50 ${student.rank <= 3 ? 'font-bold' : ''}`}
                    >
                      <td className="p-4">
                        <span className={`inline-block w-8 h-8 text-center leading-8 rounded-full ${student.rank === 1 ? 'bg-ngb-yellow border-2 border-black' : student.rank === 2 ? 'bg-gray-300 border-2 border-black' : student.rank === 3 ? 'bg-orange-300 border-2 border-black' : 'text-gray-600'}`}>
                          {student.rank}
                        </span>
                      </td>
                      <td className="p-4">{formatStudentName(student)}</td>
                      <td className="p-4">Grade {student.grade}</td>
                      <td className="p-4 text-xl text-right">{student.score}</td>
                      <td className="p-4 text-center">
                        {student.infractions > 0 ? (
                          <span className="inline-block bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full border border-red-300">
                            {student.infractions}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cutoff Resolution UI - ONLY renders if a tie spans the 10th/11th boundary */}
        {cutoffTiedGroup.length > 0 && (
          <div className="bg-white shadow-xl rounded-2xl p-6 md:p-10 border-2 border-black">
            <h2 className="font-bold text-2xl mb-6 border-b-2 border-black pb-3 text-red-700">Top 10 Cutoff Resolution</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-lg mb-4">Tie at {cutoffTiedGroup[0].score} Points</h3>
              <div className="flex flex-col gap-3">
                {cutoffTiedGroup.map((student, idx) => {
                  const nextStudent = cutoffTiedGroup[idx + 1];
                  const isTop10 = student.rank <= 10;

                  let resolutionText = isTop10
                    ? "Secured Top 10 spot. Bottom of the tie bracket."
                    : "Eliminated from Top 10.";

                  if (nextStudent) {
                    const brokenOn = getTieBreakingQuestion(student.tiebreaker_string, nextStudent.tiebreaker_string);
                    if (brokenOn) {
                      resolutionText = isTop10
                        ? `Secured Top 10 spot. Won tie against ${formatStudentName(nextStudent)} (Rank ${nextStudent.rank}) on Question ${brokenOn}.`
                        : `Eliminated. Won tie against ${formatStudentName(nextStudent)} (Rank ${nextStudent.rank}) on Question ${brokenOn}, but missed Top 10.`;
                    } else {
                      resolutionText = `Exact tie with ${formatStudentName(nextStudent)}. Admin review required.`;
                    }
                  }

                  return (
                    <div key={student.id} className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-3 last:border-0 last:pb-0">
                      <div className="font-bold text-lg mb-1 md:mb-0">
                        Rank {student.rank}: {formatStudentName(student)}
                      </div>
                      <div className={`text-sm font-libre ${isTop10 ? 'text-green-700' : 'text-red-600'}`}>
                        {resolutionText}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}