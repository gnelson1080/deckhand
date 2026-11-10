// Lesson progress helpers (pure; storage is passed in).
export const emptyProgress = () => ({ completed: [], quiz: {} });

export function completeLesson(progress, id, score) {
  const p = { completed: [...(progress?.completed || [])], quiz: { ...(progress?.quiz || {}) } };
  if (!p.completed.includes(id)) p.completed.push(id);
  p.completed.sort((a, b) => a - b);
  p.quiz[id] = Math.max(p.quiz[id] || 0, score);
  return p;
}

// The lesson to do next: the first one not completed (or the last lesson if all are done).
export function currentLesson(progress, total) {
  for (let i = 1; i <= total; i++) if (!progress?.completed?.includes(i)) return i;
  return total;
}
