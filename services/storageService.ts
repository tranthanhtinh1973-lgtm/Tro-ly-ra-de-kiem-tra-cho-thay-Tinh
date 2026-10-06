
import { Quiz, StudentAttempt } from '../types';

const QUIZ_KEY = 'ai_quiz_app_quizzes';
const RESULT_KEY = 'ai_quiz_app_results';

export const saveQuiz = (quiz: Quiz): void => {
  const quizzes = getQuizzes();
  quizzes.push(quiz);
  localStorage.setItem(QUIZ_KEY, JSON.stringify(quizzes));
};

export const getQuizzes = (): Quiz[] => {
  const data = localStorage.getItem(QUIZ_KEY);
  return data ? JSON.parse(data) : [];
};

export const getQuizById = (id: string): Quiz | undefined => {
  const quizzes = getQuizzes();
  return quizzes.find(q => q.id === id);
};

export const deleteQuiz = (id: string): void => {
  // Xóa đề thi
  let quizzes = getQuizzes();
  quizzes = quizzes.filter(q => q.id !== id);
  localStorage.setItem(QUIZ_KEY, JSON.stringify(quizzes));
  
  // Xóa các kết quả làm bài liên quan
  let attempts = getAttempts();
  attempts = attempts.filter(a => a.quizId !== id);
  localStorage.setItem(RESULT_KEY, JSON.stringify(attempts));
};

export const updateQuizStatus = (id: string, isActive: boolean): void => {
  const quizzes = getQuizzes();
  const quiz = quizzes.find(q => q.id === id);
  if (quiz) {
    quiz.isActive = isActive;
    localStorage.setItem(QUIZ_KEY, JSON.stringify(quizzes));
  }
};

export const saveAttempt = (attempt: StudentAttempt): void => {
  const results = getAttempts();
  results.push(attempt);
  localStorage.setItem(RESULT_KEY, JSON.stringify(results));
};

export const getAttempts = (): StudentAttempt[] => {
  const data = localStorage.getItem(RESULT_KEY);
  return data ? JSON.parse(data) : [];
};

export const getAttemptsByStudent = (quizId: string, name: string, className: string): StudentAttempt[] => {
  const all = getAttempts();
  return all.filter(
    a => a.quizId === quizId && 
    a.studentName.toLowerCase() === name.toLowerCase() && 
    a.studentClass.toLowerCase() === className.toLowerCase()
  );
};
