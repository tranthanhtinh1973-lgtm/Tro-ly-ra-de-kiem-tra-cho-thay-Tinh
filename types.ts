
export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  SHORT_ANSWER = 'SHORT_ANSWER',
}

export enum Difficulty {
  RECALL = 'RECALL',      // Nhận biết
  UNDERSTAND = 'UNDERSTAND', // Thông hiểu
  APPLY = 'APPLY',        // Vận dụng
  ADVANCED = 'ADVANCED',  // Vận dụng cao
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // For MC
  correctAnswer: string;
  difficulty: Difficulty;
  explanation?: string; // Lời giải chi tiết
}

export interface QuizConfig {
  subject: string;
  grade: string;
  lesson: string;
  examName: string; // Tên bài kiểm tra (VD: Kiểm tra cuối học kì I)
  duration: number; // Thời gian làm bài (phút)
  totalQuestions: {
    [QuestionType.MULTIPLE_CHOICE]: number;
    [QuestionType.TRUE_FALSE]: number;
    [QuestionType.SHORT_ANSWER]: number;
  };
  difficultyDistribution: {
    [Difficulty.RECALL]: number;
    [Difficulty.UNDERSTAND]: number;
    [Difficulty.APPLY]: number;
    [Difficulty.ADVANCED]: number;
  };
  partPoints: {
    [QuestionType.MULTIPLE_CHOICE]: number;
    [QuestionType.TRUE_FALSE]: number;
    [QuestionType.SHORT_ANSWER]: number;
  };
}

export interface Quiz {
  id: string;
  title: string;
  config: QuizConfig;
  questions: Question[];
  createdAt: number;
  isActive: boolean; // Controls if students can see the quiz
}

export interface StudentAttempt {
  id: string;
  quizId: string;
  studentName: string;
  studentClass: string;
  score: number;
  totalScore: number;
  answers: Record<string, string>; // questionId -> studentAnswer
  timestamp: number;
}

// Subjects specific to Vietnam High School Curriculum (2018)
export const SUBJECTS = [
  "Toán học",
  "Ngữ văn",
  "Vật lí",
  "Hóa học",
  "Sinh học",
  "Lịch sử",
  "Địa lí",
  "Giáo dục công dân",
  "Tin học",
  "Công nghệ",
  "Tiếng Anh",
  "Giáo dục kinh tế và pháp luật",
  "Hoạt động trải nghiệm",
  "Âm nhạc",
  "Mỹ thuật",
  "Giáo dục quốc phòng và an ninh"
];

export const GRADES = ["Lớp 10", "Lớp 11", "Lớp 12"];
