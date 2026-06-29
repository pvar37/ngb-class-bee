'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentEntryScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState('');
  const [accessCode, setAccessCode] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const existingSession = localStorage.getItem('ngb_student_id');
    if (existingSession) {
      router.push('/classbee/exam');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const studentId = crypto.randomUUID();

    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          grade,
          accessCode: accessCode.trim().toUpperCase()
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start exam.');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('ngb_student_id', studentId);
      router.push('/classbee/exam');

    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-ngb-yellow px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 md:p-12 w-full max-w-lg border-0">

        <div className="text-center mb-8">
          <h2 className="font-exo font-bold text-3xl mb-2">Class Bee Entry</h2>
          <p className="text-gray-600 font-exo text-sm">Enter your details to begin the exam. Do not click start until your teacher instructs you to do so.</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block font-bold text-sm mb-2 font-exo">First Name</label>
              <input
                type="text"
                className="w-full bg-transparent border border-black rounded-full px-5 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-bold text-sm mb-2 font-exo">Last Name</label>
              <input
                type="text"
                className="w-full bg-transparent border border-black rounded-full px-5 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-sm mb-2 font-exo">Grade Level</label>
            <select
              className="w-full bg-transparent border border-black rounded-full px-5 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black appearance-none"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              required
            >
              <option value="" disabled>Select Grade</option>
              <option value="9">9th Grade</option>
              <option value="10">10th Grade</option>
              <option value="11">11th Grade</option>
              <option value="12">12th Grade</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-sm mb-2 font-exo">School Access Code</label>
            <input
              type="text"
              className="w-full bg-transparent border border-black rounded-full px-5 py-3 text-black uppercase focus:outline-none focus:ring-2 focus:ring-black"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="e.g., AB12CD"
              maxLength={10}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full mt-4 bg-black text-ngb-yellow border-2 border-black rounded-full py-3 font-bold text-lg transition-colors hover:bg-ngb-dark disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !firstName || !lastName || !grade || !accessCode}
          >
            {isLoading ? 'Connecting...' : 'Begin Exam'}
          </button>
        </form>
      </div>
    </div>
  );
}