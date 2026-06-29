'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function TeacherLogin() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if already logged in and redirect to dashboard
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/teacher/dashboard');
      }
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      if (data.session) {
        router.push('/teacher/dashboard');
      }
    } catch (err) {
      setError('An unexpected network error occurred.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-ngb-yellow px-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 md:p-12 w-full max-w-md border-0">

        <div className="text-center mb-8">
          <h2 className="font-exo font-bold text-3xl mb-2 text-black">Teacher Portal</h2>
          <p className="text-gray-600 font-exo text-sm">Secure login for educators and administrators.</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 text-sm font-exo" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="block font-bold text-sm mb-2 font-exo text-black">Email Address</label>
            <input
              type="email"
              className="w-full bg-transparent border border-black rounded-full px-5 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-sm mb-2 font-exo text-black">Password</label>
            <input
              type="password"
              className="w-full bg-transparent border border-black rounded-full px-5 py-3 text-black focus:outline-none focus:ring-2 focus:ring-black"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full mt-6 bg-black text-ngb-yellow border-2 border-black rounded-full py-3 font-bold text-lg font-exo transition-colors hover:bg-ngb-dark disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !email || !password}
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}