import { useRef, useCallback } from 'react';

export function useAutosave() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutosave = useCallback((studentId: string, questionId: number, selectedOption: string) => {

    // 1. Synchronous Local Storage Write (Offline Fallback)
    const storageKey = `ngb_classbee_responses_${studentId}`;
    try {
      const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
      existing[questionId] = selectedOption;
      localStorage.setItem(storageKey, JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to write to localStorage");
    }

    // 2. Clear existing timer if the user clicks another option quickly
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 3. Set new debounce timer (1.5 seconds)
    timeoutRef.current = setTimeout(async () => {
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
        // Fail silently on the frontend. 
        // The data is safely in localStorage for the final bulk submission.
        console.warn('Network offline. Answer saved locally.');
      }
    }, 1500);

  }, []);

  return { triggerAutosave };
}