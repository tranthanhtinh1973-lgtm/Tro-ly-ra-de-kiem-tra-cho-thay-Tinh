import React, { useState } from 'react';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';

type Mode = 'landing' | 'teacher' | 'student';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('landing');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setMode('landing')}>
              <div className="flex-shrink-0 flex items-center">
                 <span className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">AI Quiz</span>
              </div>
            </div>
            {mode !== 'landing' && (
              <div className="flex items-center">
                <button 
                  onClick={() => setMode('landing')}
                  className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Trang chủ
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="py-6">
        {mode === 'landing' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center min-h-[80vh]">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 text-center mb-6 leading-tight">
              Hệ thống Kiểm tra & Đánh giá <br/> <span className="text-blue-600">Thông Minh</span>
            </h1>
            <p className="text-xl text-gray-500 text-center max-w-2xl mb-12">
              Tạo đề thi tự động bằng AI trong tích tắc. Chấm điểm ngay lập tức. Giải pháp toàn diện cho giáo dục hiện đại.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
              <button 
                onClick={() => setMode('teacher')}
                className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-blue-100 hover:border-blue-500 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Dành cho Giáo viên</h3>
                <p className="text-center text-gray-500 mt-2 text-sm">Soạn đề, quản lý và xem báo cáo</p>
              </button>

              <button 
                onClick={() => setMode('student')}
                className="group relative flex flex-col items-center justify-center p-8 bg-white border-2 border-green-100 hover:border-green-500 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800">Dành cho Học sinh</h3>
                <p className="text-center text-gray-500 mt-2 text-sm">Làm bài kiểm tra và xem điểm</p>
              </button>
            </div>
          </div>
        )}

        {mode === 'teacher' && <TeacherDashboard />}
        {mode === 'student' && <StudentDashboard />}
      </main>
    </div>
  );
};

export default App;
