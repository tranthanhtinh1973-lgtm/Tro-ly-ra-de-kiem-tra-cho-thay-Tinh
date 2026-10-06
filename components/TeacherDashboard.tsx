
import React, { useState, useEffect, useRef } from 'react';
import { SUBJECTS, GRADES, QuizConfig, QuestionType, Difficulty, Question, Quiz, StudentAttempt } from '../types';
import { generateQuizQuestions, MatrixInput, analyzeMatrixFromInput } from '../services/geminiService';
import { saveQuiz, getQuizzes, getAttempts, deleteQuiz, updateQuizStatus } from '../services/storageService';

// Declare types for global libraries
declare const mammoth: any;
declare const pdfjsLib: any;
declare const htmlDocx: any;

const TeacherDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'results'>('create');
  
  // Form State
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [grade, setGrade] = useState(GRADES[0]);
  const [lesson, setLesson] = useState('');
  const [examName, setExamName] = useState('KIỂM TRA CUỐI HỌC KÌ I');
  const [duration, setDuration] = useState(45);
  
  const [mcCount, setMcCount] = useState(5);
  const [tfCount, setTfCount] = useState(0);
  const [saCount, setSaCount] = useState(0);
  
  const [mcPoints, setMcPoints] = useState(4.0);
  const [tfPoints, setTfPoints] = useState(2.0);
  const [saPoints, setSaPoints] = useState(1.0);
  
  const [recallCount, setRecallCount] = useState(3);
  const [understandCount, setUnderstandCount] = useState(2);
  const [applyCount, setApplyCount] = useState(0);
  const [advancedCount, setAdvancedCount] = useState(0);

  // File state
  const [matrixFile, setMatrixFile] = useState<{
    name: string;
    type: 'image' | 'text';
    data: string;
    mimeType?: string;
  } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [quizSaved, setQuizSaved] = useState(false);
  const [publishImmediately, setPublishImmediately] = useState(true);

  // Results & Viewing State
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    setAttempts(getAttempts());
    setQuizzes(getQuizzes());
  };

  useEffect(() => {
    if (activeTab === 'results') {
      loadData();
      setViewingQuiz(null);
    }
  }, [activeTab]);

  const processMatrixData = async (data: MatrixInput, fileName: string) => {
    if (data.type === 'image') {
      setMatrixFile({ name: fileName, type: 'image', data: data.data, mimeType: data.mimeType });
    } else {
      setMatrixFile({ name: fileName, type: 'text', data: data.content });
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeMatrixFromInput(data);
      setMcCount(result.counts[QuestionType.MULTIPLE_CHOICE]);
      setTfCount(result.counts[QuestionType.TRUE_FALSE]);
      setSaCount(result.counts[QuestionType.SHORT_ANSWER]);
      setRecallCount(result.difficulty[Difficulty.RECALL]);
      setUnderstandCount(result.difficulty[Difficulty.UNDERSTAND]);
      setApplyCount(result.difficulty[Difficulty.APPLY]);
      setAdvancedCount(result.difficulty[Difficulty.ADVANCED]);
    } catch (e) {
      console.error("Auto-fill failed", e);
    } finally {
      setIsAnalyzing(false);
      setIsProcessingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingFile(true);
    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const matches = base64String.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            processMatrixData({ type: 'image', mimeType: matches[1], data: matches[2] }, file.name);
          } else {
            setIsProcessingFile(false);
          }
        };
        reader.readAsDataURL(file);
      } else if (file.name.endsWith('.docx')) {
        const reader = new FileReader();
        reader.onloadend = (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          mammoth.extractRawText({ arrayBuffer: arrayBuffer })
            .then((result: any) => {
              processMatrixData({ type: 'text', content: result.value }, file.name);
            })
            .catch((err: any) => {
              console.error(err);
              alert("Lỗi đọc file Word.");
              setIsProcessingFile(false);
            });
        };
        reader.readAsArrayBuffer(file);
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onloadend = async (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          try {
            const loadingTask = pdfjsLib.getDocument(arrayBuffer);
            const pdf = await loadingTask.promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += `--- Trang ${i} ---\n${pageText}\n`;
            }
            processMatrixData({ type: 'text', content: fullText }, file.name);
          } catch (err) {
            console.error(err);
            alert("Lỗi đọc file PDF.");
            setIsProcessingFile(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        alert("Định dạng file không hỗ trợ.");
        setIsProcessingFile(false);
      }
    } catch (e) {
      console.error(e);
      alert("Có lỗi xảy ra khi xử lý file.");
      setIsProcessingFile(false);
    }
  };

  const clearFile = () => {
    setMatrixFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!lesson) {
      alert("Vui lòng nhập tên bài học");
      return;
    }
    const totalQ = mcCount + tfCount + saCount;
    if (totalQ === 0) {
      alert("Vui lòng nhập số lượng câu hỏi.");
      return;
    }
    setIsGenerating(true);
    setQuizSaved(false);
    setGeneratedQuestions([]);
    const config: QuizConfig = {
      subject, grade, lesson, examName, duration,
      totalQuestions: {
        [QuestionType.MULTIPLE_CHOICE]: mcCount,
        [QuestionType.TRUE_FALSE]: tfCount,
        [QuestionType.SHORT_ANSWER]: saCount,
      },
      difficultyDistribution: {
        [Difficulty.RECALL]: recallCount,
        [Difficulty.UNDERSTAND]: understandCount,
        [Difficulty.APPLY]: applyCount,
        [Difficulty.ADVANCED]: advancedCount,
      },
      partPoints: {
        [QuestionType.MULTIPLE_CHOICE]: mcPoints,
        [QuestionType.TRUE_FALSE]: tfPoints,
        [QuestionType.SHORT_ANSWER]: saPoints,
      }
    };
    try {
      let matrixInput: MatrixInput | undefined = undefined;
      if (matrixFile) {
        if (matrixFile.type === 'image' && matrixFile.mimeType) {
          matrixInput = { type: 'image', data: matrixFile.data, mimeType: matrixFile.mimeType };
        } else if (matrixFile.type === 'text') {
          matrixInput = { type: 'text', content: matrixFile.data };
        }
      }
      const questions = await generateQuizQuestions(config, matrixInput);
      if (questions && questions.length > 0) {
          setGeneratedQuestions(questions);
          setTimeout(() => {
            previewRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
      } else {
          alert("AI không trả về câu hỏi nào.");
      }
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = () => {
    if (generatedQuestions.length === 0) return;
    const newQuiz: Quiz = {
      id: `quiz_${Date.now()}`,
      title: `${examName} - ${subject} - ${grade}`,
      config: {
        subject, grade, lesson, examName, duration,
        totalQuestions: {
            [QuestionType.MULTIPLE_CHOICE]: mcCount,
            [QuestionType.TRUE_FALSE]: tfCount,
            [QuestionType.SHORT_ANSWER]: saCount,
        },
        difficultyDistribution: {
            [Difficulty.RECALL]: recallCount,
            [Difficulty.UNDERSTAND]: understandCount,
            [Difficulty.APPLY]: applyCount,
            [Difficulty.ADVANCED]: advancedCount,
        },
        partPoints: {
            [QuestionType.MULTIPLE_CHOICE]: mcPoints,
            [QuestionType.TRUE_FALSE]: tfPoints,
            [QuestionType.SHORT_ANSWER]: saPoints,
        }
      },
      questions: generatedQuestions,
      createdAt: Date.now(),
      isActive: publishImmediately,
    };
    saveQuiz(newQuiz);
    setQuizSaved(true);
    alert("Đề thi đã được lưu thành công.");
  };

  const handleDeleteQuiz = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Bạn có chắc chắn muốn xóa đề thi này và toàn bộ kết quả liên quan?")) {
        deleteQuiz(id);
        setQuizzes(prev => prev.filter(q => q.id !== id));
        setAttempts(prev => prev.filter(a => a.quizId !== id));
        if (viewingQuiz?.id === id) setViewingQuiz(null);
    }
  };

  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    updateQuizStatus(id, !currentStatus);
    loadData();
    if (viewingQuiz && viewingQuiz.id === id) {
        setViewingQuiz({...viewingQuiz, isActive: !currentStatus});
    }
  };

  const cleanOption = (str: string) => str.replace(/^[A-D]\.\s*/i, '').replace(/^[a-d]\)\s*/i, '').replace(/<[^>]*>?/gm, '');
  const clean = (str: string) => str.replace(/<[^>]*>?/gm, '');

  const seededRandom = (seed: number) => {
    let state = seed % 2147483647;
    if (state <= 0) state += 2147483646;
    return () => {
      state = (state * 48271) % 2147483647;
      return (state - 1) / 2147483646;
    };
  };

  const shuffleArrayWithSeed = <T,>(array: T[], seed: number): T[] => {
    const rng = seededRandom(seed);
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const getNumericSeed = (id: string, version: number) => {
    let hash = 0;
    const str = id + version;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; 
    }
    return Math.abs(hash);
  };

  const mixQuiz = (quiz: Quiz, version: number) => {
    const seed = getNumericSeed(quiz.id, version);
    const mcqs = quiz.questions.filter(q => q.type === QuestionType.MULTIPLE_CHOICE);
    const tfs = quiz.questions.filter(q => q.type === QuestionType.TRUE_FALSE);
    const sas = quiz.questions.filter(q => q.type === QuestionType.SHORT_ANSWER);

    const shuffledMcqs = shuffleArrayWithSeed(mcqs, seed + 1).map((q, idx) => {
        if (!q.options) return q;
        const questionSeed = getNumericSeed(q.id, version) + idx;
        const shuffledOptions = shuffleArrayWithSeed([...q.options], questionSeed);
        return { ...q, options: shuffledOptions };
    });
    
    const shuffledTfs = shuffleArrayWithSeed(tfs, seed + 3);
    const shuffledSas = shuffleArrayWithSeed(sas, seed + 4);

    return [...shuffledMcqs, ...shuffledTfs, ...shuffledSas];
  };

  const generateExamDocHtml = (quiz: Quiz, questionsData: Question[], quizCode: string, isPreview: boolean = false) => {
    const p1 = quiz.config.partPoints[QuestionType.MULTIPLE_CHOICE].toFixed(1).replace('.', ',');
    const p2 = quiz.config.partPoints[QuestionType.TRUE_FALSE].toFixed(1).replace('.', ',');
    const p3 = quiz.config.partPoints[QuestionType.SHORT_ANSWER].toFixed(1).replace('.', ',');

    const headerContent = `
      <div style="font-family: 'Times New Roman', serif;">
        <table style="width: 100%; border: none; margin-bottom: 20px;">
          <tr>
            <td style="text-align: center; vertical-align: top; width: 45%;">
              <p style="margin: 0; font-size: 11pt; font-weight: bold;">TRƯỜNG THPT LỘC BÌNH</p>
              <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 11pt;">${isPreview ? 'BẢN XEM TRƯỚC' : 'ĐỀ CHÍNH THỨC'}</p>
              <p style="margin: 10px 0 0 0; font-size: 10pt; font-weight: bold;">Mã đề: ${quizCode}</p>
            </td>
            <td style="text-align: center; vertical-align: top;">
              <p style="margin: 0; font-weight: bold; font-size: 11pt; text-transform: uppercase;">${quiz.config.examName || 'KIỂM TRA HỌC KÌ'}</p>
              <p style="margin: 0; font-weight: bold; font-size: 12pt;">MÔN: ${quiz.config.subject.toUpperCase()}</p>
              <p style="margin: 0; font-size: 11pt; font-style: italic;">Thời gian làm bài: ${quiz.config.duration || 45} phút</p>
              <p style="margin: 0; font-size: 10pt;">Đề kiểm tra gồm có 02 trang, (${questionsData.length} câu hỏi)</p>
            </td>
          </tr>
        </table>
        <p style="margin-bottom: 20px; font-size: 11pt;">Họ, tên học sinh: ............................................................................ Lớp: .............................</p>
      </div>
    `;

    let examContent = `<div style="font-family: 'Times New Roman', serif; font-size: 12pt;">`;
    
    const mcqs = questionsData.filter(q => q.type === QuestionType.MULTIPLE_CHOICE);
    const tfs = questionsData.filter(q => q.type === QuestionType.TRUE_FALSE);
    const sas = questionsData.filter(q => q.type === QuestionType.SHORT_ANSWER);

    if (mcqs.length > 0) {
        examContent += `<p style="font-weight: bold; margin-top: 10px; font-family: 'Times New Roman', serif;">PHẦN I (${p1} điểm). Thí sinh trả lời từ câu 1 đến câu ${mcqs.length}. Mỗi câu hỏi thí sinh chỉ chọn 1 phương án.</p>`;
        mcqs.forEach((q, idx) => {
            examContent += `<div style="margin-bottom: 10px; font-family: 'Times New Roman', serif;">`;
            examContent += `<p style="margin: 0; font-family: 'Times New Roman', serif;"><strong>Câu ${idx + 1}:</strong> ${clean(q.text)}</p>`;
            if (q.options) {
                q.options.forEach((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    examContent += `<p style="margin: 2px 0 2px 20px; font-family: 'Times New Roman', serif;"><strong>${letter}.</strong> ${cleanOption(opt)}</p>`;
                });
            }
            examContent += `</div>`;
        });
    }

    if (tfs.length > 0) {
        examContent += `<p style="font-weight: bold; margin-top: 15px; font-family: 'Times New Roman', serif;">PHẦN II (${p2} điểm). Thí sinh trả lời từ câu 1 đến câu ${tfs.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</p>`;
        tfs.forEach((q, idx) => {
            examContent += `<div style="margin-bottom: 15px; font-family: 'Times New Roman', serif;">`;
            examContent += `<p style="margin: 0; font-family: 'Times New Roman', serif;"><strong>Câu ${idx + 1}:</strong> ${clean(q.text)}</p>`;
            if (q.options) {
                q.options.forEach((opt, i) => {
                    const letter = String.fromCharCode(97 + i);
                    examContent += `<p style="margin: 2px 0 2px 20px; font-family: 'Times New Roman', serif;"><strong>${letter})</strong> ${cleanOption(opt)}</p>`;
                });
            }
            examContent += `</div>`;
        });
    }

    if (sas.length > 0) {
        examContent += `<p style="font-weight: bold; margin-top: 15px; font-family: 'Times New Roman', serif;">PHẦN III (${p3} điểm). Thí sinh trả lời các câu hỏi sau.</p>`;
        sas.forEach((q, idx) => {
            examContent += `<div style="margin-bottom: 10px; font-family: 'Times New Roman', serif;">`;
            examContent += `<p style="margin: 0; font-family: 'Times New Roman', serif;"><strong>Câu ${idx + 1}:</strong> ${clean(q.text)}</p>`;
            examContent += `<p style="margin-top: 5px; border-bottom: 1px dotted #000; height: 40px;"></p>`;
            examContent += `</div>`;
        });
    }

    examContent += `</div><p style="text-align: center; font-weight: bold; margin-top: 30px;">..............Hết.............</p>`;
    return `${headerContent}${examContent}`;
  };

  const handleExportWord = (quiz: Quiz, questionsData: Question[], quizCode: string = "101") => {
    const html = generateExamDocHtml(quiz, questionsData, quizCode);
    const fullContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          @page {
            size: 210mm 297mm;
            margin: 20mm;
          }
          @page WordSection1 {
            size: 595.3pt 841.9pt;
            margin: 56.7pt 56.7pt 56.7pt 56.7pt;
          }
          div.WordSection1 {
            page: WordSection1;
          }
          body, p, div, span, td, th, h1, h2, h3, h4, h5, h6 {
            font-family: 'Times New Roman', serif !important;
          }
        </style>
      </head>
      <body><div class="WordSection1">${html}</div></body>
      </html>
    `;
    downloadDoc(fullContent, `De_Thi_${quizCode}_${Date.now()}.docx`);
  };

  const handleExport4Versions = (quiz: Quiz) => {
    for (let v = 0; v < 4; v++) {
      const quizCode = (101 + v).toString();
      const mixedQuestions = mixQuiz(quiz, 101 + v);
      handleExportWord(quiz, mixedQuestions, quizCode);
    }
    alert("Đã xuất 4 mã đề (101-104) thành công.");
  };

  const handleExportAnswerKey4Versions = (quiz: Quiz) => {
    let fullHtml = `<div style="font-family: 'Times New Roman', serif; font-size: 12pt;">
        <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 30px;">BẢNG ĐÁP ÁN TỔNG HỢP (4 MÃ ĐỀ)</h2>
    `;
    for (let v = 0; v < 4; v++) {
        const quizCode = (101 + v).toString();
        const mixedQuestions = mixQuiz(quiz, 101 + v);
        const mcqs = mixedQuestions.filter(q => q.type === QuestionType.MULTIPLE_CHOICE);
        const tfs = mixedQuestions.filter(q => q.type === QuestionType.TRUE_FALSE);
        const sas = mixedQuestions.filter(q => q.type === QuestionType.SHORT_ANSWER);
        fullHtml += `<div style="margin-top: 40px; border-top: 2px solid #000; padding-top: 20px; page-break-before: ${v > 0 ? 'always' : 'auto'};">`;
        fullHtml += `<h3 style="text-align: center; background-color: #f3f4f6; padding: 10px; font-family: 'Times New Roman', serif;">ĐÁP ÁN MÃ ĐỀ: ${quizCode}</h3>`;
        if (mcqs.length > 0) {
            fullHtml += `<p style="font-weight: bold; margin-top: 10px; font-family: 'Times New Roman', serif;">PHẦN I. TRẮC NGHIỆM</p><table border="1" style="border-collapse: collapse; width: 100%; text-align: center; margin-bottom: 20px; font-family: 'Times New Roman', serif;"><tr>`;
            mcqs.forEach((q, idx) => {
                 let letter = "N/A";
                 if (q.options) {
                     const matchIdx = q.options.findIndex((o, i) => {
                         const letter = String.fromCharCode(65 + i);
                         const cleanO = cleanOption(o).trim().toLowerCase();
                         const cleanC = cleanOption(q.correctAnswer).trim().toLowerCase();
                         return cleanO === cleanC || 
                                q.correctAnswer.trim().toUpperCase() === letter ||
                                o.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
                     });
                     if (matchIdx !== -1) letter = String.fromCharCode(65 + matchIdx);
                 }
                 fullHtml += `<td style="padding: 5px; width: 10%; font-family: 'Times New Roman', serif;"><b>${idx + 1}</b>.${letter}</td>`;
                 if ((idx + 1) % 10 === 0 && idx < mcqs.length - 1) fullHtml += `</tr><tr>`;
            });
            const remaining = (10 - (mcqs.length % 10)) % 10;
            if (remaining > 0) for(let r=0; r<remaining; r++) fullHtml += `<td style="font-family: 'Times New Roman', serif;"></td>`;
            fullHtml += `</tr></table>`;
        }
        if (tfs.length > 0) {
            fullHtml += `<p style="font-weight: bold; margin-top: 10px; font-family: 'Times New Roman', serif;">PHẦN II. TRẮC NGHIỆM ĐÚNG/SAI</p><table border="1" style="border-collapse: collapse; width: 100%; margin-bottom: 20px; font-family: 'Times New Roman', serif;"><tr style="background-color: #f9fafb;"><th style="font-family: 'Times New Roman', serif;">Câu</th><th style="font-family: 'Times New Roman', serif;">Ý a</th><th style="font-family: 'Times New Roman', serif;">Ý b</th><th style="font-family: 'Times New Roman', serif;">Ý c</th><th style="font-family: 'Times New Roman', serif;">Ý d</th></tr>`;
            tfs.forEach((q, idx) => {
                const ansParts = q.correctAnswer.split(/[,|]/).map(s => s.trim());
                fullHtml += `<tr><td style="text-align: center; font-weight: bold; font-family: 'Times New Roman', serif;">${idx + 1}</td><td style="text-align: center; font-family: 'Times New Roman', serif;">${ansParts[0] || '-'}</td><td style="text-align: center; font-family: 'Times New Roman', serif;">${ansParts[1] || '-'}</td><td style="text-align: center; font-family: 'Times New Roman', serif;">${ansParts[2] || '-'}</td><td style="text-align: center; font-family: 'Times New Roman', serif;">${ansParts[3] || '-'}</td></tr>`;
            });
            fullHtml += `</table>`;
        }
        if (sas.length > 0) {
            fullHtml += `<p style="font-weight: bold; margin-top: 10px; font-family: 'Times New Roman', serif;">PHẦN III. TỰ LUẬN / TRẢ LỜI NGẮN</p>`;
            sas.forEach((q, idx) => {
                fullHtml += `<div style="margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 5px; font-family: 'Times New Roman', serif;"><b>Câu ${idx + 1}:</b> <span style="color: #2563eb; font-family: 'Times New Roman', serif;">${q.correctAnswer}</span><br/><i style="font-size: 10pt; color: #666; font-family: 'Times New Roman', serif;">Giải thích: ${clean(q.explanation || 'Không có')}</i></div>`;
            });
        }
        fullHtml += `</div>`;
    }
    fullHtml += `</div>`;
    const fullContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>@page { size: 210mm 297mm; margin: 20mm; } @page WordSection1 { size: 595.3pt 841.9pt; margin: 56.7pt 56.7pt 56.7pt 56.7pt; } div.WordSection1 { page: WordSection1; } body, p, div, span, td, th, h1, h2, h3, h4, h5, h6 { font-family: 'Times New Roman', serif !important; }</style></head><body><div class="WordSection1">${fullHtml}</div></body></html>`;
    downloadDoc(fullContent, `Dap_An_Tong_Hop_4_Ma_De_${Date.now()}.docx`);
  };

  const downloadDoc = (content: string, filename: string) => {
    // Ưu tiên sử dụng thư viện html-docx-js nếu có để tạo file .docx chuẩn
    if (typeof htmlDocx !== 'undefined') {
        try {
            const blob = htmlDocx.asBlob(content);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        } catch (e) {
            console.error("Lỗi khi tạo file docx bằng thư viện, chuyển sang phương pháp thay thế.", e);
        }
    }
    
    // Fallback nếu thư viện lỗi hoặc không load được
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Nếu fallback, đổi đuôi về .doc để Word mở được HTML
    link.download = filename.replace('.docx', '.doc'); 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadExcel = () => {
    const dataToExport = viewingQuiz ? attempts.filter(a => a.quizId === viewingQuiz.id) : attempts;
    if (dataToExport.length === 0) { alert("Chưa có dữ liệu."); return; }
    const headers = ["Học sinh", "Lớp", "Điểm số"];
    const rows = dataToExport.map(a => [`"${a.studentName}"`, `"${a.studentClass}"`, `${a.score}/${a.totalScore}`].join(","));
    const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `ket_qua.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderQuestionList = (questions: Question[]) => (
    <div className="space-y-6">
      {questions.map((q, idx) => (
        <div key={q.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-blue-800">Câu {idx + 1} ({q.type === QuestionType.MULTIPLE_CHOICE ? 'TN' : q.type === QuestionType.TRUE_FALSE ? 'Đ/S' : 'TLN'})</span>
            <span className={`text-xs px-2 py-1 rounded ${q.difficulty === Difficulty.RECALL ? 'bg-green-100 text-green-800' : q.difficulty === Difficulty.UNDERSTAND ? 'bg-yellow-100 text-yellow-800' : q.difficulty === Difficulty.APPLY ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
              {q.difficulty === Difficulty.RECALL ? 'Nhận biết' : q.difficulty === Difficulty.UNDERSTAND ? 'Thông hiểu' : q.difficulty === Difficulty.APPLY ? 'Vận dụng' : 'Vận dụng cao'}
            </span>
          </div>
          <p className="mb-3 text-gray-800 font-medium">{q.text}</p>
          {q.type === QuestionType.MULTIPLE_CHOICE && q.options && (
            <div className="grid grid-cols-1 gap-2 ml-4">
              {q.options.map((opt, i) => (
                <div key={i} className={`p-2 rounded border bg-white border-gray-200`}><span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span> {cleanOption(opt)}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const inputClass = "w-full rounded-md shadow-sm p-1.5 text-sm border border-blue-400 bg-blue-50 text-blue-900 focus:ring-2 focus:ring-blue-500 font-medium";
  const numberInputClass = "w-full mt-0.5 p-1.5 rounded-md text-sm border border-blue-400 bg-blue-50 text-blue-900 font-bold text-center";

  return (
    <div className="max-w-7xl mx-auto p-4">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Chế độ Giáo viên</h1>
        <div className="space-x-3">
          <button onClick={() => setActiveTab('create')} className={`px-3 py-1.5 rounded-lg font-medium text-sm transition ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Soạn đề thi</button>
          <button onClick={() => setActiveTab('results')} className={`px-3 py-1.5 rounded-lg font-medium text-sm transition ${activeTab === 'results' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Quản lý đề & Kết quả</button>
        </div>
      </header>

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-fit sticky top-4 order-1">
            <h2 className="text-base font-bold mb-3 text-gray-700 border-b pb-2">Cấu hình Đề thi</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-bold text-gray-700 mb-0.5">Tên bài kiểm tra</label><input type="text" value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="VD: Kiểm tra cuối học kì I" className={inputClass} /></div>
              <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-bold text-gray-700 mb-0.5">Môn học</label><select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass}>{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-0.5">Khối lớp</label><select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClass}>{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-bold text-gray-700 mb-0.5">Tên bài học</label><input type="text" value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="Ví dụ: Hàm số..." className={inputClass} /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-0.5">Thời gian (phút)</label><input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} className={numberInputClass} /></div>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-lg border border-dashed border-blue-300 relative">
                <label className="block text-xs font-bold text-gray-700 mb-2">Tải lên Ma trận (Ảnh, Word, PDF)</label>
                {isProcessingFile && <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10 rounded-lg"><span className="text-xs text-blue-600 font-bold animate-pulse">Đang xử lý...</span></div>}
                {!matrixFile ? (
                  <div className="text-center">
                    <input type="file" accept="image/*,.docx,.pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" id="matrix-upload" />
                    <label htmlFor="matrix-upload" className="cursor-pointer flex flex-col items-center gap-1 text-blue-600 hover:text-blue-800"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><span className="text-xs font-medium">Chọn file</span></label>
                  </div>
                ) : (
                  <div className="relative p-2 bg-blue-50 rounded border border-blue-200"><p className="text-[10px] font-bold truncate">{matrixFile.name}</p><button onClick={clearFile} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
                )}
              </div>

              <div className="pt-2 border-t">
                <label className="block text-xs font-bold text-gray-600 mb-2">Số câu / Điểm từng phần</label>
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1"><label className="text-[10px] text-gray-500 block text-center">Phần I (TN)</label><input type="number" value={mcCount} onChange={e => setMcCount(parseInt(e.target.value) || 0)} className={numberInputClass} /></div>
                    <div className="flex-1"><label className="text-[10px] text-gray-500 block text-center">Số điểm</label><input type="number" step="0.5" value={mcPoints} onChange={e => setMcPoints(parseFloat(e.target.value) || 0)} className={numberInputClass} /></div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1"><label className="text-[10px] text-gray-500 block text-center">Phần II (Đ/S)</label><input type="number" value={tfCount} onChange={e => setTfCount(parseInt(e.target.value) || 0)} className={numberInputClass} /></div>
                    <div className="flex-1"><label className="text-[10px] text-gray-500 block text-center">Số điểm</label><input type="number" step="0.5" value={tfPoints} onChange={e => setTfPoints(parseFloat(e.target.value) || 0)} className={numberInputClass} /></div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1"><label className="text-[10px] text-gray-500 block text-center">Phần III (TL)</label><input type="number" value={saCount} onChange={e => setSaCount(parseInt(e.target.value) || 0)} className={numberInputClass} /></div>
                    <div className="flex-1"><label className="text-[10px] text-gray-500 block text-center">Số điểm</label><input type="number" step="0.5" value={saPoints} onChange={e => setSaPoints(parseFloat(e.target.value) || 0)} className={numberInputClass} /></div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <label className="block text-xs font-bold text-gray-600 mb-2">Mức độ nhận thức</label>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px] text-gray-500 block">Nhận biết</label><input type="number" value={recallCount} onChange={e => setRecallCount(parseInt(e.target.value) || 0)} className={numberInputClass} /></div>
                  <div><label className="text-[10px] text-gray-500 block">Thông hiểu</label><input type="number" value={understandCount} onChange={e => setUnderstandCount(parseInt(e.target.value) || 0)} className={numberInputClass} /></div>
                  <div><label className="text-[10px] text-gray-500 block">Vận dụng</label><input type="number" value={applyCount} onChange={e => setApplyCount(parseInt(e.target.value) || 0)} className={numberInputClass} /></div>
                  <div><label className="text-[10px] text-gray-500 block">Vận dụng cao</label><input type="number" value={advancedCount} onChange={e => setAdvancedCount(parseInt(e.target.value) || 0)} className={numberInputClass} /></div>
                </div>
              </div>

              <button onClick={handleGenerate} disabled={isGenerating || isProcessingFile} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-blue-300 text-sm mt-2">{isGenerating ? "Đang tạo..." : "Tạo Đề Thi (AI)"}</button>
            </div>
          </div>

          <div ref={previewRef} className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[500px] order-2">
            <div className="flex justify-between items-center mb-6 border-b pb-4 sticky top-0 bg-white z-10 pt-2">
              <h2 className="text-xl font-bold text-gray-800">Xem trước Đề thi</h2>
              {generatedQuestions.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => {
                    const tempQuiz: Quiz = {
                      id: 'temp', title: examName, questions: generatedQuestions, createdAt: Date.now(), isActive: true,
                      config: { subject, grade, lesson, examName, duration, totalQuestions: { [QuestionType.MULTIPLE_CHOICE]: mcCount, [QuestionType.TRUE_FALSE]: tfCount, [QuestionType.SHORT_ANSWER]: saCount }, difficultyDistribution: { [Difficulty.RECALL]: recallCount, [Difficulty.UNDERSTAND]: understandCount, [Difficulty.APPLY]: applyCount, [Difficulty.ADVANCED]: advancedCount }, partPoints: { [QuestionType.MULTIPLE_CHOICE]: mcPoints, [QuestionType.TRUE_FALSE]: tfPoints, [QuestionType.SHORT_ANSWER]: saPoints } }
                    };
                    handleExportWord(tempQuiz, generatedQuestions, "Preview");
                  }} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-bold text-sm">Xuất nháp</button>
                  <button onClick={handlePublish} className="bg-green-600 text-white px-5 py-2 rounded-lg font-bold">Lưu & Phát hành</button>
                </div>
              )}
            </div>
            {generatedQuestions.length === 0 ? <p className="text-gray-400 text-center py-20">Chưa có câu hỏi.</p> : renderQuestionList(generatedQuestions)}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[600px]">
           {viewingQuiz ? (
             <div>
               <div className="flex justify-between items-center mb-6 border-b pb-4">
                 <button onClick={() => setViewingQuiz(null)} className="p-2 bg-gray-100 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg></button>
                 <h2 className="text-xl font-bold">{viewingQuiz.title}</h2>
                 <div className="flex gap-2">
                   <button onClick={() => handleExport4Versions(viewingQuiz)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Xuất 4 mã đề (Mix)</button>
                   <button onClick={() => handleExportAnswerKey4Versions(viewingQuiz)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Xuất Đáp án (4 Mã đề)</button>
                   <button onClick={downloadExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Xuất Excel</button>
                 </div>
               </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div><h3 className="text-lg font-semibold mb-4 border-b pb-2">Đề thi</h3><div className="max-h-[500px] overflow-y-auto">{renderQuestionList(viewingQuiz.questions)}</div></div>
                 <div><h3 className="text-lg font-semibold mb-4 border-b pb-2">Kết quả</h3><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-gray-100 text-xs"><th>Học sinh</th><th>Lớp</th><th className="text-center">Điểm</th></tr></thead><tbody>{attempts.filter(a => a.quizId === viewingQuiz.id).map(a => (<tr key={a.id} className="border-b"><td className="p-2">{a.studentName}</td><td className="p-2">{a.studentClass}</td><td className="p-2 text-center font-bold">{a.score}</td></tr>))}</tbody></table></div></div>
               </div>
             </div>
           ) : (
             <div>
               <h2 className="text-xl font-bold mb-6">Quản lý Đề thi</h2>
               <table className="w-full text-left border-collapse">
                 <thead><tr className="bg-blue-50 text-blue-800 text-xs uppercase"><th>Ngày tạo</th><th>Tên đề thi</th><th className="text-center">Lượt làm</th><th className="text-center">Trạng thái</th><th className="text-right">Thao tác</th></tr></thead>
                 <tbody>{quizzes.slice().reverse().map((quiz) => (
                   <tr key={quiz.id} className="border-b hover:bg-gray-50">
                     <td className="p-3 text-sm">{new Date(quiz.createdAt).toLocaleDateString()}</td>
                     <td className="p-3 font-medium">{quiz.title}</td>
                     <td className="p-3 text-center"><span className="bg-blue-100 px-2 py-1 rounded text-xs font-bold">{attempts.filter(a => a.quizId === quiz.id).length}</span></td>
                     <td className="p-3 text-center"><button onClick={() => handleToggleStatus(quiz.id, quiz.isActive)} className={`w-10 h-5 rounded-full relative ${quiz.isActive ? 'bg-green-500' : 'bg-gray-300'}`}><span className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${quiz.isActive ? 'right-1' : 'left-1'}`}></span></button></td>
                     <td className="p-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => setViewingQuiz(quiz)} className="text-blue-600 p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></button><button onClick={(e) => handleDeleteQuiz(e, quiz.id)} className="text-red-500 p-1 hover:text-red-700 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button></div></td>
                   </tr>
                 ))}</tbody>
               </table>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
