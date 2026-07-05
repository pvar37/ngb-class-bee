'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAutosave } from '@/hooks/useAutosave';
import { supabase } from '@/lib/supabase';

export default function ExamEnvironment() {
  const router = useRouter();
  const { triggerAutosave } = useAutosave();

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [infractions, setInfractions] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  useEffect(() => {
    const blockClipboard = (e: ClipboardEvent) => e.preventDefault();
    document.addEventListener('copy', blockClipboard);
    document.addEventListener('cut', blockClipboard);
    document.addEventListener('paste', blockClipboard);

    const handleVisibilityChange = () => {
      if (document.hidden) console.warn("Student switched tabs");
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 || e.clientX <= 0 || (e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)) {
        console.warn("Cursor left the window");
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('copy', blockClipboard);
      document.removeEventListener('cut', blockClipboard);
      document.removeEventListener('paste', blockClipboard);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const submitExam = useCallback(async () => {
    const studentId = localStorage.getItem('ngb_student_id');
    if (!studentId) return;

    const finalAnswers = JSON.parse(localStorage.getItem(`ngb_classbee_responses_${studentId}`) || '{}');

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, answers: finalAnswers }),
      });

      if (res.ok) {
        localStorage.removeItem('ngb_student_id');
        localStorage.removeItem(`ngb_classbee_responses_${studentId}`);
        router.push('/success');
      } else {
        console.error("Submission rejected by server.");
      }
    } catch (error) {
      console.warn("Network offline. Retrying submission...");
      setTimeout(submitExam, 5000);
    }
  }, [router]);

  useEffect(() => {
    async function initializeExam() {
      const studentId = localStorage.getItem('ngb_student_id');
      if (!studentId) {
        router.push('/');
        return;
      }

      const { data: qData, error } = await supabase
        .from('questions')
        .select('*')
        .order('id', { ascending: true });

      if (!error && qData) setQuestions(qData);

      const localAnswers = JSON.parse(localStorage.getItem(`ngb_classbee_responses_${studentId}`) || '{}');
      setAnswers(localAnswers);

      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId }),
        });

        if (res.ok) {
          const studentData = await res.json();

          if (studentData.start_time) {
            const startTime = new Date(studentData.start_time).getTime();
            const currentTime = new Date().getTime();
            const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

            const totalAllowedSeconds = studentData.has_extended_time ? 2700 : 1800;
            const remaining = totalAllowedSeconds - elapsedSeconds;

            if (remaining <= 0) {
              submitExam();
            } else {
              setTimeLeft(remaining);
            }
          }
        } else {
          router.push('/');
        }
      } catch (err) {
        console.error("Failed to load session timer", err);
      }
    }

    initializeExam();
  }, [router, submitExam]);

  // Visibility Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        registerInfraction("You navigated away from the exam tab.");
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Infraction Handler
  const registerInfraction = (message: string) => {
    setInfractions(prev => prev + 1);
    setWarningMessage(message);
    setShowWarning(true);

    // Optional: If you have an autosave API, fire a quick patch to the DB here
    // supabase.from('students').update({ infractions: infractions + 1 }).eq('id', studentId);
  };

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev !== null && prev <= 1) {
          clearInterval(timer);
          submitExam();
          return 0;
        }
        return prev ? prev - 1 : 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitExam]);

  const handleSelect = (questionId: number, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
    const studentId = localStorage.getItem('ngb_student_id')!;
    triggerAutosave(studentId, questionId, option);
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-ngb-yellow">
        <h3 className="font-exo font-bold text-2xl">Loading Exam...</h3>
      </div>
    );
  }

  const currentQ = questions[currentIdx];

  return (
    <div
      className="min-h-screen relative"
      onContextMenu={(e) => { e.preventDefault(); registerInfraction("Right-click is disabled."); }}
      onCopy={(e) => { e.preventDefault(); registerInfraction("Copying is disabled."); }}
      onPaste={(e) => { e.preventDefault(); registerInfraction("Pasting is disabled."); }}
    >

      <div className="w-[95%] max-w-4xl mx-auto px-4 mt-10 select-none pb-20">

        {/* Header & Timer */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-black">
          <h4 className="font-exo font-bold text-xl m-0">
            Question {currentIdx + 1} of {questions.length}
          </h4>
          <div className={`font-exo font-bold text-xl ${timeLeft !== null && timeLeft < 300 ? 'text-red-600' : 'text-black'}`}>
            Time Remaining: {Math.floor((timeLeft || 0) / 60)}:{(timeLeft || 0) % 60 < 10 ? '0' : ''}{(timeLeft || 0) % 60}
          </div>
        </div>

        {/* Question Content */}
        <div className="bg-white shadow-lg rounded-2xl p-6 md:p-12 my-8 border-none">
          {currentQ.image_url && (
            <div className="text-center mb-8">
              <img
                src={currentQ.image_url}
                alt="Reference for question"
                className="max-w-full rounded border border-gray-200 mx-auto"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
            </div>
          )}

          <h4 className="mb-8 text-xl leading-relaxed font-libre">
            {currentQ.question_text}
          </h4>

          {/* Answer Options */}
          <div className="flex flex-col gap-4">
            {['A', 'B', 'C', 'D'].map((opt) => {
              const optionText = currentQ[`option_${opt.toLowerCase()}`];
              const isSelected = answers[currentQ.id] === opt;

              return (
                <label
                  key={opt}
                  className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-gray-50 border-black border-2' : 'bg-white border-gray-300 border'
                    }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQ.id}`}
                    value={opt}
                    checked={isSelected}
                    onChange={() => handleSelect(currentQ.id, opt)}
                    className="mr-4 w-5 h-5 accent-black"
                  />
                  <span className="font-exo text-lg">
                    <strong>{opt}.</strong> {optionText}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between mt-12 mb-12">
          <button
            className="border border-black bg-transparent text-black px-6 py-3 rounded-lg font-bold font-exo hover:bg-black hover:text-ngb-yellow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(prev => prev - 1)}
          >
            &larr; Previous
          </button>

          {currentIdx === questions.length - 1 ? (
            <button
              className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold font-exo shadow-md hover:bg-red-700 transition-colors"
              onClick={submitExam}
            >
              Finish & Submit
            </button>
          ) : (
            <button
              className="bg-black text-ngb-yellow border-2 border-black px-8 py-3 rounded-lg font-bold font-exo shadow-md hover:bg-ngb-dark transition-colors"
              onClick={() => setCurrentIdx(prev => prev + 1)}
            >
              Next &rarr;
            </button>
          )}
        </div>
      </div>

        {/* The Full-Screen Warning Modal */}
        {showWarning && (
          <div className="fixed inset-0 z-50 bg-black/90 flex justify-center items-center px-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full border-4 border-red-600 text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h2 className="font-exo font-bold text-2xl mb-2 text-black">Security Alert</h2>
              <p className="font-libre text-gray-700 mb-6">{warningMessage}</p>
              <p className="font-exo text-sm text-red-600 font-bold mb-6">
                This action has been logged and reported to your teacher.
              </p>
              <button
                onClick={() => setShowWarning(false)}
                className="w-full bg-black text-white py-3 rounded-full font-bold font-exo hover:bg-gray-800"
              >
                I Understand, Return to Exam
              </button>
            </div>
          </div>
        )}
    </div>
  );
}