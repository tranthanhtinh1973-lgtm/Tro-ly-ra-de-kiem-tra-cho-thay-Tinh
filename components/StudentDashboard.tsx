
import React, { useState, useEffect } from 'react';
import { Quiz, StudentAttempt, QuestionType } from '../types';
import { getQuizzes, getAttemptsByStudent, saveAttempt } from '../services/storageService';

const StudentDashboard: React.FC = () => {
  const [step, setStep] = useState<'login' | 'select' | 'quiz' | 'result'>('login');
  
  // Student Info
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  
  // Data
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  
  // Quiz State
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);

  useEffect(() => {
    const allQuizzes = getQuizzes();
    setAvailableQuizzes(allQuizzes.filter(q => q.isActive).reverse());
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && className.trim()) setStep('select');
  };

  const handleSelectQuiz = (quiz: Quiz) => {
    const attempts = getAttemptsByStudent(quiz.id, name, className);
    if (attempts.length >= 2) {
      alert("Bạn đã làm quá giới hạn 2 lần cho đề này!");
      return;
    }
    setSelectedQuiz(quiz);
    setAnswers({});
    setStep('quiz');
  };

  const handleSubmit = () => {
    if (!selectedQuiz) return;
    if (!confirm("Bạn có chắc chắn muốn nộp bài không?")) return;

    let totalPoints = 0;
    selectedQuiz.questions.forEach(q => {
      const studentAns = (answers[q.id] || "").trim().toLowerCase();
      const correctAns = q.correctAnswer.trim().toLowerCase();

      if (q.type === QuestionType.MULTIPLE_CHOICE) {
        const cleanOption = (str: string) => str.replace(/^[A-D]\.\s*/i, '').replace(/^[a-d]\)\s*/i, '').replace(/<[^>]*>?/gm, '');
        const studentAnsClean = cleanOption(studentAns);
        const correctAnsClean = cleanOption(correctAns);
        
        let isCorrect = false;
        if (studentAns === correctAns) isCorrect = true;
        else if (studentAnsClean === correctAnsClean) isCorrect = true;
        else {
            const matchIdx = q.options?.findIndex(o => o.trim().toLowerCase() === studentAns);
            if (matchIdx !== undefined && matchIdx !== -1) {
                const letter = String.fromCharCode(97 + matchIdx);
                if (correctAns === letter) isCorrect = true;
            }
        }
        if (isCorrect) totalPoints += 1;
      } else if (q.type === QuestionType.TRUE_FALSE) {
        const subAnswersStudent = studentAns.split(',').map(s => s.trim());
        const subAnswersCorrect = correctAns.split(/[,|]/).map(s => s.trim().toLowerCase());
        let correctCount = 0;
        const max = Math.max(subAnswersStudent.length, subAnswersCorrect.length);
        for(let i=0; i<max; i++) {
            if (subAnswersStudent[i] && subAnswersCorrect[i] && subAnswersStudent[i] === subAnswersCorrect[i]) correctCount++;
        }
        if (correctCount === 1) totalPoints += 0.1;
        else if (correctCount === 2) totalPoints += 0.25;
        else if (correctCount === 3) totalPoints += 0.5;
        else if (correctCount === 4) totalPoints += 1.0;
      } else if (q.type === QuestionType.SHORT_ANSWER) {
        if (studentAns === correctAns) totalPoints += 1;
      }
    });

    setScore(Number(totalPoints.toFixed(2)));
    const attempt: StudentAttempt = {
      id: `att_${Date.now()}`,
      quizId: selectedQuiz.id,
      studentName: name,
      studentClass: className,
      score: Number(totalPoints.toFixed(2)),
      totalScore: selectedQuiz.questions.length,
      answers,
      timestamp: Date.now()
    };
    saveAttempt(attempt);
    setStep('result');
  };

  const handleTFChange = (qId: string, index: number, value: string) => {
    const currentStr = answers[qId] || ",,,"; 
    const parts = currentStr.split(',');
    while(parts.length < 4) parts.push('');
    parts[index] = value;
    setAnswers({ ...answers, [qId]: parts.join(',') });
  };

  const resetToSelect = () => {
    setSelectedQuiz(null);
    setStep('select');
  };

  if (step === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-gray-100">
          <h1 className="text-2xl font-bold text-center text-blue-600 mb-2">Cổng thi Trực tuyến</h1>
          <p className="text-center text-gray-500 mb-6">Vui lòng nhập thông tin để bắt đầu</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label><input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border p-3 rounded-lg outline-none bg-blue-50 border-blue-300 text-blue-900" placeholder="Nguyễn Văn A" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Lớp</label><input required type="text" value={className} onChange={e => setClassName(e.target.value)} className="w-full border p-3 rounded-lg outline-none bg-blue-50 border-blue-300 text-blue-900" placeholder="10A1" /></div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition mt-4">Vào hệ thống</button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'select') {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <header className="flex justify-between items-center mb-6">
          <div><h1 className="text-2xl font-bold text-gray-800">Danh sách Đề thi</h1><p className="text-gray-500">Xin chào, <span className="font-semibold text-blue-600">{name} - {className}</span></p></div>
          <button onClick={() => setStep('login')} className="text-gray-500 hover:text-red-500 text-sm">Đăng xuất</button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableQuizzes.length === 0 ? <p className="text-gray-500 col-span-2 text-center py-10">Hiện chưa có đề thi nào được phát hành.</p> : availableQuizzes.map(quiz => {
              const attempts = getAttemptsByStudent(quiz.id, name, className);
              const remaining = 2 - attempts.length;
              return (
                <div key={quiz.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">{quiz.title}</h3>
                  <div className="flex justify-between text-sm text-gray-500 mb-2"><span>{quiz.questions.length} câu hỏi</span><span>Thời gian: {quiz.config.duration || 45} phút</span></div>
                  <div className="text-xs text-gray-400 mb-4">Lượt đã làm: {attempts.length}/2</div>
                  <button onClick={() => handleSelectQuiz(quiz)} disabled={remaining <= 0} className={`w-full py-2 rounded-lg font-medium ${remaining > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>{remaining > 0 ? 'Làm bài' : 'Đã hết lượt'}</button>
                </div>
              );
            })
          }
        </div>
      </div>
    );
  }

  if (step === 'quiz' && selectedQuiz) {
    return (
      <div className="max-w-3xl mx-auto p-4 pb-20">
        <header className="sticky top-0 bg-gray-50/95 backdrop-blur z-10 py-4 border-b mb-6 flex justify-between items-center">
            <h2 className="text-lg font-bold truncate pr-4">{selectedQuiz.title}</h2>
            <div className="text-sm font-medium text-gray-500">Đã trả lời: <span className="text-blue-600">{Object.keys(answers).length}/{selectedQuiz.questions.length}</span></div>
        </header>
        <div className="space-y-8">
            {selectedQuiz.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="font-medium text-gray-800 mb-4 text-lg"><span className="font-bold text-blue-600 mr-2">Câu {idx + 1}:</span>{q.text}</p>
                    {q.type === QuestionType.MULTIPLE_CHOICE && q.options && (
                        <div className="space-y-2">{q.options.map(opt => {
                            const cleanOption = (str: string) => str.replace(/^[A-D]\.\s*/i, '').replace(/^[a-d]\)\s*/i, '').replace(/<[^>]*>?/gm, '');
                            return (<label key={opt} className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${answers[q.id] === opt ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200'}`}><input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswers({...answers, [q.id]: opt})} className="mt-1 mr-3" /><span className="text-gray-700">{cleanOption(opt)}</span></label>);
                        })}</div>
                    )}
                    {q.type === QuestionType.TRUE_FALSE && q.options && (
                        <div className="space-y-3">
                            <p className="text-sm italic text-gray-500 mb-2">Chọn Đúng hoặc Sai:</p>
                            {q.options.map((opt, i) => {
                                const currentComp = answers[q.id] || ",,,";
                                const currentVal = currentComp.split(',')[i] || "";
                                const cleanOption = (str: string) => str.replace(/^[A-D]\.\s*/i, '').replace(/^[a-d]\)\s*/i, '').replace(/<[^>]*>?/gm, '');
                                return (<div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border hover:bg-gray-50"><div className="mb-2 sm:mb-0 text-gray-700"><span className="font-bold mr-2">{String.fromCharCode(97+i)})</span>{cleanOption(opt)}</div><div className="flex gap-2 shrink-0"><label className={`cursor-pointer px-3 py-1 rounded border text-sm ${currentVal === 'Đúng' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}><input type="radio" className="hidden" checked={currentVal === 'Đúng'} onChange={() => handleTFChange(q.id, i, 'Đúng')} />Đúng</label><label className={`cursor-pointer px-3 py-1 rounded border text-sm ${currentVal === 'Sai' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}><input type="radio" className="hidden" checked={currentVal === 'Sai'} onChange={() => handleTFChange(q.id, i, 'Sai')} />Sai</label></div></div>);
                            })}
                        </div>
                    )}
                    {q.type === QuestionType.SHORT_ANSWER && (<input type="text" placeholder="Nhập câu trả lời..." value={answers[q.id] || ''} onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />)}
                </div>
            ))}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center"><button onClick={handleSubmit} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg">Nộp Bài</button></div>
      </div>
    );
  }

  if (step === 'result' && selectedQuiz) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></div>
                <h2 className="text-2xl font-bold mb-2">Hoàn thành bài thi!</h2><p className="text-gray-500 mb-6">Kết quả của bạn đã được ghi nhận.</p>
                <div className="bg-gray-50 p-6 rounded-xl mb-8"><p className="text-sm text-gray-500 uppercase font-semibold mb-2">Tổng điểm</p><p className="text-5xl font-black text-blue-600">{score}</p></div>
                <button onClick={resetToSelect} className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold hover:bg-gray-900 transition">Quay lại danh sách</button>
            </div>
        </div>
    );
  }
  return null;
};

export default StudentDashboard;
