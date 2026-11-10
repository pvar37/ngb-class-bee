'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentCheckInScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState('');
  const [accessCode, setAccessCode] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If student already has an active exam session, redirect to the exam
    const existingSession = localStorage.getItem('ngb_student_id');
    if (existingSession) {
      router.push('/exam');
      return;
    }

    // Pre-fill if student returned from the instructions screen to edit details
    const savedCheckin = localStorage.getItem('ngb_checkin_data');
    if (savedCheckin) {
      try {
        const parsed = JSON.parse(savedCheckin);
        if (parsed.firstName) setFirstName(parsed.firstName);
        if (parsed.middleInitial) setMiddleInitial(parsed.middleInitial);
        if (parsed.lastName) setLastName(parsed.lastName);
        if (parsed.grade) setGrade(parsed.grade);
        if (parsed.accessCode) setAccessCode(parsed.accessCode);
      } catch (e) {
        // Ignore parse error
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const formattedCode = accessCode.trim().toUpperCase();

    try {
      // Validate access code before progressing to instructions
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: formattedCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid access code. Please check with your teacher.');
        setIsLoading(false);
        return;
      }

      // Save verified check-in data locally so the instructions screen can access it
      localStorage.setItem('ngb_checkin_data', JSON.stringify({
        firstName: firstName.trim(),
        middleInitial: middleInitial.trim().toUpperCase().slice(0, 1),
        lastName: lastName.trim(),
        grade,
        accessCode: formattedCode,
      }));

      router.push('/instructions');

    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-ngb-yellow px-4 py-8">
      <img
        src="/ngb-logo-text.png"
        alt="National Geography Bee"
        className="h-16 md:h-24 w-auto object-contain mb-6"
      />

      <div className="bg-white shadow-xl rounded-2xl p-8 md:p-10 w-full max-w-md sm:max-w-[480px] border-0">
        <div className="text-center mb-6">
          <h2 className="font-exo font-bold text-3xl mb-1.5 text-black">Welcome to the Class Bee!</h2>
          <p className="text-gray-600 font-exo text-sm">
            Enter your details below as instructed by your teacher.
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm font-exo" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Row 1: First Name & M.I. */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block font-bold text-sm mb-1.5 font-exo">First Name</label>
              <input
                type="text"
                className="w-full bg-transparent border border-black rounded-full px-5 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-black font-exo"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
                required
              />
            </div>
            <div className="w-20 sm:w-24 shrink-0">
              <label className="block font-bold text-sm mb-1.5 font-exo text-center" title="Middle Initial (Optional)">
                M.I. <span className="text-xs font-normal text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                className="w-full bg-transparent border border-black rounded-full px-2 py-2.5 text-black uppercase text-center focus:outline-none focus:ring-2 focus:ring-black font-exo placeholder:text-gray-400"
                value={middleInitial}
                onChange={(e) => setMiddleInitial(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1))}
                placeholder="—"
                maxLength={1}
              />
            </div>
          </div>

          {/* Row 2: Last Name */}
          <div>
            <label className="block font-bold text-sm mb-1.5 font-exo">Last Name</label>
            <input
              type="text"
              className="w-full bg-transparent border border-black rounded-full px-5 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-black font-exo"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              required
            />
          </div>

          {/* Row 3: Grade Level */}
          <div>
            <label className="block font-bold text-sm mb-1.5 font-exo">Grade Level</label>
            <select
              className="w-full bg-transparent border border-black rounded-full px-5 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-black appearance-none font-exo cursor-pointer"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              required
            >
              <option value="" disabled>Select Grade</option>
              <option value="6">6th Grade</option>
              <option value="7">7th Grade</option>
              <option value="8">8th Grade</option>
              <option value="9">9th Grade</option>
              <option value="10">10th Grade</option>
              <option value="11">11th Grade</option>
              <option value="12">12th Grade</option>
            </select>
          </div>

          {/* Row 4: School Access Code */}
          <div>
            <label className="block font-bold text-sm mb-1.5 font-exo">School Access Code</label>
            <input
              type="text"
              className="w-full bg-transparent border border-black rounded-full px-5 py-2.5 text-black uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-black font-exo"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="e.g. AB1234-CD"
              maxLength={12}
              required
            />
          </div>

          {/* Row 5: Submit Action */}
          <button
            type="submit"
            className="w-full mt-2 bg-black text-ngb-yellow border-2 border-black rounded-full py-3 font-bold text-lg font-exo transition-colors hover:bg-ngb-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
            disabled={isLoading || !firstName || !lastName || !grade || !accessCode}
          >
            {isLoading ? 'Verifying code...' : 'Continue to instructions →'}
          </button>
        </form>
      </div>
    </div>
  );
}
