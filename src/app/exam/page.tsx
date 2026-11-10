'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState(false);
  const activePillRef = useRef<HTMLButtonElement | null>(null);
  const lastInfractionTimeRef = useRef<number>(0);
  const sessionTimingRef = useRef<{ startTimeMs: number; totalAllowedSeconds: number } | null>(null);

  useEffect(() => {
    if (activePillRef.current) {
      activePillRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIdx]);

  useEffect(() => {
    const blockClipboard = (e: ClipboardEvent) => e.preventDefault();
    document.addEventListener('copy', blockClipboard);
    document.addEventListener('cut', blockClipboard);
    document.addEventListener('paste', blockClipboard);

    return () => {
      document.removeEventListener('copy', blockClipboard);
      document.removeEventListener('cut', blockClipboard);
      document.removeEventListener('paste', blockClipboard);
    };
  }, []);

  const submitExam = useCallback(async (force: boolean = false) => {
    const studentId = localStorage.getItem('ngb_student_id');
    if (!studentId) return;

    const finalAnswers = JSON.parse(localStorage.getItem(`ngb_classbee_responses_${studentId}`) || '{}');

    // If manual submit (not forced by timer expiration), require all questions to be answered
    if (!force) {
      const hasUnanswered = questions.some(q => !finalAnswers[q.id]);
      if (hasUnanswered) {
        setShowIncompleteModal(true);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, answers: finalAnswers, infractions: infractions }),
      });

      if (res.ok) {
        localStorage.removeItem('ngb_student_id');
        localStorage.removeItem(`ngb_classbee_responses_${studentId}`);
        localStorage.removeItem(`ngb_infractions_${studentId}`);
        router.push('/success');
      } else {
        setIsSubmitting(false);
        const data = await res.json().catch(() => ({}));
        console.error("Submission rejected by server:", data.error);
        if (res.status === 403) {
          localStorage.removeItem('ngb_student_id');
          localStorage.removeItem(`ngb_classbee_responses_${studentId}`);
          localStorage.removeItem(`ngb_infractions_${studentId}`);
          router.push('/success');
        }
      }
    } catch (error) {
      setIsSubmitting(false);
      console.warn("Network offline. Retrying submission...");
      setTimeout(() => submitExam(force), 5000);
    }
  }, [router, infractions, questions]);

  useEffect(() => {
    async function initializeExam() {
      const studentId = localStorage.getItem('ngb_student_id');
      if (!studentId) {
        router.push('/');
        return;
      }

      const { data: qData, error } = await supabase
        .from('questions')
        .select('id, question_text, image_url, option_a, option_b, option_c, option_d, option_e')
        .order('id', { ascending: true });

      if (!error && qData) setQuestions(qData);

      const localAnswers = JSON.parse(localStorage.getItem(`ngb_classbee_responses_${studentId}`) || '{}');
      setAnswers(localAnswers);

      const savedInfractions = parseInt(localStorage.getItem(`ngb_infractions_${studentId}`) || '0', 10);
      if (!isNaN(savedInfractions) && savedInfractions > 0) {
        setInfractions(savedInfractions);
      }

      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId }),
        });

        if (res.ok) {
          const studentData = await res.json();

          if (studentData.start_time) {
            const startTimeMs = new Date(studentData.start_time).getTime();
            const totalAllowedSeconds = studentData.has_extended_time ? 2700 : 1800;
            sessionTimingRef.current = { startTimeMs, totalAllowedSeconds };

            const elapsedSeconds = Math.floor((Date.now() - startTimeMs) / 1000);
            const remaining = totalAllowedSeconds - elapsedSeconds;

            if (remaining <= 0) {
              setTimeLeft(0);
              submitExam(true);
            } else {
              setTimeLeft(remaining);
            }
          }
        } else {
          // Break any redirect loops by clearing orphaned or completed session keys
          const errData = await res.json().catch(() => ({}));
          localStorage.removeItem('ngb_student_id');
          localStorage.removeItem(`ngb_classbee_responses_${studentId}`);
          localStorage.removeItem(`ngb_infractions_${studentId}`);

          if (res.status === 409 || errData.completed) {
            router.push('/success');
          } else {
            router.push('/');
          }
        }
      } catch (err) {
        console.error("Failed to load session timer", err);
      }
    }

    initializeExam();
  }, [router, submitExam]);

  // 2. Add the Visibility & Focus Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        registerInfraction("You navigated away from the testing tab.");
      }
    };

    const handleBlur = () => {
      registerInfraction("You switched away from the testing window.");
    };

    // Listen for both tab changes and window/app focus loss
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Infraction Handler with 1.5s cooldown to deduplicate concurrent events
  const registerInfraction = (message: string) => {
    const now = Date.now();
    // Cooldown prevents double-counting when blur and visibilitychange fire on the same action
    if (now - lastInfractionTimeRef.current < 1500) {
      return;
    }
    lastInfractionTimeRef.current = now;

    const studentId = localStorage.getItem('ngb_student_id');
    setInfractions((prev) => {
      const next = prev + 1;
      if (studentId) {
        localStorage.setItem(`ngb_infractions_${studentId}`, String(next));
      }
      return next;
    });
    setWarningMessage(message);
    setShowWarning(true);
  };

  const syncTimerWithWallClock = useCallback(() => {
    if (!sessionTimingRef.current) return null;
    const elapsedSeconds = Math.floor((Date.now() - sessionTimingRef.current.startTimeMs) / 1000);
    const remaining = sessionTimingRef.current.totalAllowedSeconds - elapsedSeconds;

    if (remaining <= 0) {
      setTimeLeft(0);
      submitExam(true);
      return 0;
    }
    setTimeLeft(remaining);
    return remaining;
  }, [submitExam]);

  const isTimeInitialized = timeLeft !== null;

  useEffect(() => {
    if (!isTimeInitialized) return;

    // 1. Ticks every second based on authoritative wall-clock difference
    const timer = setInterval(() => {
      syncTimerWithWallClock();
    }, 1000);

    // 2. Immediately recalculate on window focus or device wake to eliminate sleep/background drift
    const handleSync = () => {
      syncTimerWithWallClock();
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('pageshow', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('pageshow', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [isTimeInitialized, syncTimerWithWallClock]);

  const handleSelect = (questionId: number, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
    const studentId = localStorage.getItem('ngb_student_id')!;
    triggerAutosave(studentId, questionId, option);
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-ngb-yellow">
        <h3 className="font-exo font-bold text-2xl">Loading Class Bee...</h3>
      </div>
    );
  }

  const currentQ = questions[currentIdx];

  const unansweredQuestionIndices = questions
    .map((q, idx) => (!answers[q.id] ? idx : -1))
    .filter(idx => idx !== -1);
  const unansweredCount = unansweredQuestionIndices.length;
  const isAllAnswered = questions.length > 0 && unansweredCount === 0;
  const firstUnansweredIdx = unansweredQuestionIndices.length > 0 ? unansweredQuestionIndices[0] : null;
  const nextUnansweredIdx = unansweredQuestionIndices.find(idx => idx > currentIdx) ?? (unansweredQuestionIndices.length > 0 ? unansweredQuestionIndices[0] : undefined);

  const handleManualSubmit = () => {
    if (!isAllAnswered) {
      setShowIncompleteModal(true);
    } else {
      setShowConfirmSubmitModal(true);
    }
  };

  return (
    <div
      className="min-h-screen relative"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
    >

      <div className="w-[95%] max-w-5xl mx-auto px-4 mt-4 select-none pb-16">

        {/* Header & Timer */}
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-black">
          <img
            src="/ngb-logo-text.png"
            alt="National Geography Bee"
            className="h-14 md:h-16 lg:h-18 w-auto object-contain"
          />
          <div className={`font-exo font-bold text-lg md:text-xl ${timeLeft !== null && timeLeft < 300 ? 'text-red-600' : 'text-black'}`}>
            Time Remaining: {Math.floor((timeLeft || 0) / 60)}:{(timeLeft || 0) % 60 < 10 ? '0' : ''}{(timeLeft || 0) % 60}
          </div>
        </div>

        {/* Question Navigator Scroll Bar */}
        <div className="mb-3 overflow-x-auto py-1 px-1 flex gap-2.5 items-center scroll-smooth">
          {questions.map((q, idx) => {
            const isAnswered = Boolean(answers[q.id]);
            const isCurrent = idx === currentIdx;

            return (
              <button
                key={q.id || idx}
                ref={isCurrent ? activePillRef : null}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`flex-shrink-0 min-w-[42px] h-10 px-3 rounded-xl font-exo font-bold text-sm transition-all flex items-center justify-center cursor-pointer ${
                  isCurrent ? 'ring-2 ring-black ring-offset-2' : ''
                } ${
                  isAnswered
                    ? 'bg-black text-white hover:bg-gray-800'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-black hover:bg-gray-50'
                }`}
                aria-label={`Question ${idx + 1} (${isAnswered ? 'Answered' : 'Unanswered'})${isCurrent ? ', Current' : ''}`}
                title={`Question ${idx + 1}: ${isAnswered ? 'Answered' : 'Unanswered'}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Question Content */}
        <div className="bg-white shadow-lg rounded-2xl p-6 md:p-8 mb-6 border-none">
          {/* Header inside question pane */}
          <div className="mb-4 pb-3 border-b border-gray-100">
            <div className="font-exo font-bold text-base md:text-lg text-gray-500">
              Question {currentIdx + 1} of {questions.length}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: Question Text & Reference Image */}
            <div>
              <h4 className="mb-6 text-xl leading-relaxed font-libre">
                {currentQ.question_text}
              </h4>

              {currentQ.image_url && (
                <div className="text-center mt-4">
                  <img
                    src={currentQ.image_url}
                    alt="Reference for question"
                    className="max-w-full rounded border border-gray-200 mx-auto"
                    style={{ maxHeight: '400px', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>

            {/* Right: Answer Options */}
            <div className="flex flex-col gap-4">
              {['A', 'B', 'C', 'D', 'E'].map((opt) => {
                const optionText = currentQ[`option_${opt.toLowerCase()}`];
                if (!optionText) return null;
                const isSelected = answers[currentQ.id] === opt;

                return (
                  <label
                    key={opt}
                    className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                      isSelected ? 'bg-gray-50 border-black border-2' : 'bg-white border-gray-300 border hover:border-gray-400'
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
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-12 mb-12">
          <button
            className="border border-black bg-transparent text-black px-6 py-3 rounded-lg font-bold font-exo hover:bg-black hover:text-ngb-yellow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(prev => prev - 1)}
          >
            &larr; Previous
          </button>

          {currentIdx === questions.length - 1 ? (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold font-exo shadow-md hover:bg-red-700 transition-colors disabled:opacity-60"
                onClick={handleManualSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Finish & Submit'}
              </button>
              {!isAllAnswered && (
                <span className="font-exo text-xs text-red-700 font-bold">
                  {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''} remaining
                </span>
              )}
            </div>
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

        {/* Incomplete Exam Modal */}
        {showIncompleteModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex justify-center items-center px-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h2 className="font-exo font-bold text-2xl mb-2 text-black">Incomplete Exam</h2>
              <p className="font-libre text-gray-700 mb-3 text-sm">
                All questions must be answered before you can submit (unless time expires).
              </p>
              <p className="font-exo text-sm text-amber-700 font-bold mb-3">
                You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}:
              </p>
              <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-xl p-3 mb-6 flex flex-wrap gap-1.5 justify-center">
                {unansweredQuestionIndices.map(idx => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCurrentIdx(idx);
                      setShowIncompleteModal(false);
                    }}
                    className="px-2.5 py-1 text-xs font-bold font-exo bg-white border border-gray-300 rounded hover:border-black"
                  >
                    Q{idx + 1}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {firstUnansweredIdx !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentIdx(firstUnansweredIdx);
                      setShowIncompleteModal(false);
                    }}
                    className="w-full bg-black text-ngb-yellow py-3 rounded-full font-bold font-exo hover:bg-ngb-dark transition-colors"
                  >
                    Go to Question {firstUnansweredIdx + 1}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowIncompleteModal(false)}
                  className="w-full bg-transparent border border-black text-black py-3 rounded-full font-bold font-exo hover:bg-gray-100 transition-colors"
                >
                  Return to Class Bee
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmSubmitModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex justify-center items-center px-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
              <h2 className="font-exo font-bold text-2xl mb-3 text-black">Submit Class Bee?</h2>
              <p className="font-libre text-gray-700 mb-6">
                You have answered all {questions.length} questions. Once submitted, your answers are final and cannot be modified.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmSubmitModal(false);
                    submitExam(false);
                  }}
                  className="w-full bg-red-600 text-white py-3 rounded-full font-bold font-exo hover:bg-red-700 transition-colors"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Yes, Submit Class Bee'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmSubmitModal(false)}
                  className="w-full bg-transparent border border-black text-black py-3 rounded-full font-bold font-exo hover:bg-gray-100 transition-colors"
                  disabled={isSubmitting}
                >
                  Return to Review
                </button>
              </div>
            </div>
          </div>
        )}

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
                I understand, return to Class Bee
              </button>
            </div>
          </div>
        )}
    </div>
  );
}