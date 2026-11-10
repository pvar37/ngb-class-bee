import { useCallback } from 'react';

export function useAutosave() {
  const triggerAutosave = useCallback(async (studentId: string, questionId: number, selectedOption: string) => {
    // 1. Synchronous Local Storage Write (Offline Fallback)
    const storageKey = `ngb_classbee_responses_${studentId}`;
    try {
      const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
      existing[questionId] = selectedOption;
      localStorage.setItem(storageKey, JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to write to localStorage");
    }

    // 2. Dispatch to autosave endpoint immediately so rapid answers are not dropped
    try {
      const res = await fetch('/api/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          question_id: questionId,
          selected_option: selectedOption
        }),
      });

      if (!res.ok) {
        throw new Error('Autosave network request failed');
      }
    } catch (error) {
      // Offline fallback: data is safely in localStorage for final bulk submission
      console.warn(`Network offline. Question ${questionId} saved locally.`);
    }
  }, []);

  return { triggerAutosave };
}
