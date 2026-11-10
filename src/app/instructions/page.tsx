'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface CheckinData {
  firstName: string;
  middleInitial?: string;
  lastName: string;
  grade: string;
  accessCode: string;
}

export default function InstructionsScreen() {
  const router = useRouter();

  const [checkin, setCheckin] = useState<CheckinData | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If student already has an active exam, skip to exam
    const existingSession = localStorage.getItem('ngb_student_id');
    if (existingSession) {
      router.push('/exam');
      return;
    }

    // Load check-in data; if not checked in, redirect back to entry
    const savedCheckin = localStorage.getItem('ngb_checkin_data');
    if (!savedCheckin) {
      router.push('/');
      return;
    }

    try {
      const parsed = JSON.parse(savedCheckin);
      if (!parsed.firstName || !parsed.lastName || !parsed.grade || !parsed.accessCode) {
        router.push('/');
        return;
      }
      setCheckin(parsed);
    } catch {
      router.push('/');
    }
  }, [router]);

  const handleBeginExam = async () => {
    if (!checkin || !acknowledged) return;
    setError('');
    setIsLoading(true);

    const studentId = crypto.randomUUID();

    try {
      // Calling /api/start officially initializes the student row in PostgreSQL with start_time = NOW()
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          firstName: checkin.firstName,
          middleInitial: checkin.middleInitial || null,
          lastName: checkin.lastName,
          grade: checkin.grade,
          accessCode: checkin.accessCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to initialize Class Bee session.');
        setIsLoading(false);
        return;
      }

      // Persist active student session and route into the exam
      localStorage.setItem('ngb_student_id', studentId);
      localStorage.removeItem('ngb_checkin_data');
      router.push('/exam');

    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  if (!checkin) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-ngb-yellow">
        <h3 className="font-exo font-bold text-2xl">Loading instructions...</h3>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-ngb-yellow px-4 py-4 md:py-6">
      <div className="bg-white shadow-xl rounded-2xl p-6 md:p-8 lg:p-9 w-full max-w-5xl border-0">

        {/* Student Verification Strip */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 mb-4 font-exo">
          <div>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mr-2">Checked In As</span>
            <span className="text-base font-bold text-black">
              {checkin.firstName} {checkin.middleInitial ? `${checkin.middleInitial}. ` : ''}{checkin.lastName}
            </span>
            <span className="text-gray-500 text-sm ml-2">
              · {checkin.grade}th Grade · Code: <span className="font-mono">{checkin.accessCode}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-xs md:text-sm font-bold text-gray-600 hover:text-black underline cursor-pointer"
          >
            Edit Details
          </button>
        </div>

        {/* Header */}
        <h1 className="font-exo font-bold text-2xl lg:text-3xl text-black mb-3">
          Welcome to the 2027 National Geography Bee!
        </h1>

        {/* Detailed Briefing */}
        <div className="flex flex-col gap-3 font-exo text-black leading-relaxed text-sm md:text-base mb-4">
          <p>
            We&apos;re so excited to have you participate in the first round of our competition! This round consists of <strong>50 multiple-choice questions,</strong> and each question will come with five answer choices. Each correct answer will be worth one point, and there is no penalty for incorrect answers. You&apos;ll have <strong>30 minutes</strong> to answer the questions, but don&apos;t worry about the timer—you should have more than enough time to answer everything!
          </p>

          <p>
            Please make sure you do not leave this tab until you have submitted. Your teacher will be notified if you navigate to a different tab or window.
          </p>

          <p>
            The top scorers on this phase at your school will move on to the School Bee. A maximum of 10 students will qualify for the School Bee. The winner will have a chance to qualify for the National Finals in Cambridge, Massachusetts, in April 2027!
          </p>

          <p>
            Your journey to the National Finals starts right here. <strong>When instructed by your teacher,</strong> check the box below and click <strong>Begin Class Bee</strong>. Good luck!
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2.5 rounded-xl mb-4 text-sm font-exo" role="alert">
            {error}
          </div>
        )}

        {/* Readiness Checkbox */}
        <div className="mb-4">
          <label className="flex items-start gap-3 p-3 px-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-black cursor-pointer rounded"
            />
            <span className="font-exo text-sm text-gray-800 select-none">
              I have read these instructions and understand the rules.
            </span>
          </label>
        </div>

        {/* Begin Class Bee Button */}
        <div>
          <button
            type="button"
            onClick={handleBeginExam}
            disabled={!acknowledged || isLoading}
            className="w-full bg-black text-ngb-yellow border-2 border-black rounded-full py-3 font-bold text-lg font-exo transition-colors hover:bg-ngb-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
          >
            {isLoading ? 'Starting Class Bee...' : 'Begin Class Bee →'}
          </button>
          <p className="text-center text-xs text-gray-500 font-exo mt-3">
            Do not click until your teacher instructs the room to begin.
          </p>
        </div>

      </div>
    </div>
  );
}
