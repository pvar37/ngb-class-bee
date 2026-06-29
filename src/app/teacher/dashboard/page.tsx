'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  grade: string;
  score: number;
  tiebreaker_string: string;
  start_time: string;
  end_time: string;
  school_id: string;
  rank: number;
}

const getTieBreakingQuestion = (str1: string, str2: string) => {
  if (!str1 || !str2) return null;
  for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
    if (str1[i] !== str2[i]) {
      return i + 1;
    }
  }
  return null;
};

export default function TeacherDashboard() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

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

  const exportCSV = async () => {
    if (students.length === 0) return;
    setIsExporting(true);

    try {
      // 1. Fetch questions to generate dynamic Q1, Q2, Q3 headers
      const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('id')
        .order('id', { ascending: true });

      if (qError || !questions) {
        console.error("Failed to load questions for export.");
        setIsExporting(false);
        return;
      }

      // 2. Fetch all responses for the students currently loaded in the dashboard
      const studentIds = students.map(s => s.id);
      const { data: responses, error: rError } = await supabase
        .from('responses')
        .select('student_id, question_id, selected_option') // <-- UPDATED HERE
        .in('student_id', studentIds);

      if (rError || !responses) {
        console.error("Failed to load responses for export. Database error:", rError);
        setIsExporting(false);
        return;
      }

      // 3. Map responses to a dictionary for O(1) lookups
      const responseMap: Record<string, Record<string, string>> = {};
      responses.forEach(r => {
        if (!responseMap[r.student_id]) responseMap[r.student_id] = {};
        responseMap[r.student_id][r.question_id] = r.selected_option; // <-- UPDATED HERE
      });

      // 4. Build CSV Headers
      const headers = ['Rank', 'First Name', 'Last Name', 'Grade', 'Score', 'Start Time', 'End Time'];
      questions.forEach((_, idx) => headers.push(`Q${idx + 1}`));

      // 5. Build CSV Rows
      const rows = students.map(s => {
        const row = [
          s.rank,
          s.first_name,
          s.last_name,
          s.grade,
          s.score,
          `"${new Date(s.start_time).toLocaleString()}"`, // <-- Wrapped in quotes
          `"${new Date(s.end_time).toLocaleString()}"`    // <-- Wrapped in quotes
        ];

        // Append the answer for each specific question, or 'N/A' if skipped
        questions.forEach(q => {
          row.push(responseMap[s.id]?.[q.id] || 'N/A');
        });

        return row;
      });

      // 6. Generate and Download
      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'class_bee_results.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-ngb-yellow">
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
        <div className="flex flex-col md:flex-row justify-between items-center bg-white shadow-xl rounded-2xl p-6 mb-8 border-2 border-black">
          <div>
            <h1 className="font-bold text-3xl">Class Bee Dashboard</h1>
            <p className="text-gray-600 font-libre mt-1">Live results and official rankings.</p>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0 w-full md:w-auto">
            <button
              onClick={exportCSV}
              className="flex-1 md:flex-none bg-black text-ngb-yellow px-6 py-3 rounded-full font-bold transition-colors hover:bg-ngb-dark disabled:opacity-50"
              disabled={students.length === 0 || isExporting}
            >
              {isExporting ? 'Generating...' : 'Download CSV'}
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 md:flex-none bg-white text-black border-2 border-black px-6 py-3 rounded-full font-bold transition-colors hover:bg-gray-50"
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
              No students have completed the exam yet.
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
                      <td className="p-4">{student.first_name} {student.last_name}</td>
                      <td className="p-4">Grade {student.grade}</td>
                      <td className="p-4 text-xl text-right">{student.score}</td>
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
                        ? `Secured Top 10 spot. Won tie against ${nextStudent.first_name} (Rank ${nextStudent.rank}) on Question ${brokenOn}.`
                        : `Eliminated. Won tie against ${nextStudent.first_name} (Rank ${nextStudent.rank}) on Question ${brokenOn}, but missed Top 10.`;
                    } else {
                      resolutionText = `Exact tie with ${nextStudent.first_name}. Admin review required.`;
                    }
                  }

                  return (
                    <div key={student.id} className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-3 last:border-0 last:pb-0">
                      <div className="font-bold text-lg mb-1 md:mb-0">
                        Rank {student.rank}: {student.first_name} {student.last_name}
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