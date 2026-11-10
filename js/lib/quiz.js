export function gradeQuiz(questions, picks) {
  const score = questions.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);
  return { score, total: questions.length, passed: score >= Math.ceil(questions.length * 2 / 3) };
}
