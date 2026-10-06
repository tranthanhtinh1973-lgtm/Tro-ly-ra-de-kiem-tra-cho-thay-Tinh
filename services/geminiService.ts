
import { GoogleGenAI, Type } from "@google/genai";
import { QuizConfig, QuestionType, Difficulty, Question } from '../types';

/**
 * Khởi tạo client AI với API Key từ biến môi trường.
 */
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export type MatrixInput = 
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'text'; content: string };

export interface AnalyzedMatrix {
  counts: {
    [QuestionType.MULTIPLE_CHOICE]: number;
    [QuestionType.TRUE_FALSE]: number;
    [QuestionType.SHORT_ANSWER]: number;
  };
  difficulty: {
    [Difficulty.RECALL]: number;
    [Difficulty.UNDERSTAND]: number;
    [Difficulty.APPLY]: number;
    [Difficulty.ADVANCED]: number;
  };
}

// Helper để làm sạch chuỗi JSON trả về từ AI (loại bỏ markdown block)
const cleanJsonResponse = (text: string): string => {
  if (!text) return "{}";
  let clean = text.trim();
  if (clean.startsWith("```json")) {
    clean = clean.replace(/^```json/, "").replace(/```$/, "");
  } else if (clean.startsWith("```")) {
    clean = clean.replace(/^```/, "").replace(/```$/, "");
  }
  return clean.trim();
};

/**
 * Phân tích Ma trận đề thi từ file tải lên (Ảnh hoặc Văn bản).
 */
export const analyzeMatrixFromInput = async (matrixInput: MatrixInput): Promise<AnalyzedMatrix> => {
  const ai = getClient();
  const parts: any[] = [];

  const systemInstruction = `
    Bạn là một trợ lý AI chuyên gia về giáo dục tại Việt Nam.
    Nhiệm vụ: Trích xuất số lượng câu hỏi và phân bổ mức độ từ Ma trận/Đặc tả đề thi.
    Quy đổi tỉ lệ % sang số câu (Tổng 10 điểm, TN thường 0.25đ/câu).
    Trả về kết quả dưới định dạng JSON chính xác theo Schema.
  `;

  if (matrixInput.type === 'text') {
    parts.push({ text: `Hãy phân tích nội dung sau:\n${matrixInput.content}` });
  } else {
    parts.push({ text: "Hãy phân tích hình ảnh ma trận này." });
    parts.push({ inlineData: { mimeType: matrixInput.mimeType, data: matrixInput.data } });
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      counts: {
        type: Type.OBJECT,
        properties: {
          [QuestionType.MULTIPLE_CHOICE]: { type: Type.INTEGER },
          [QuestionType.TRUE_FALSE]: { type: Type.INTEGER },
          [QuestionType.SHORT_ANSWER]: { type: Type.INTEGER },
        },
        required: [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.SHORT_ANSWER]
      },
      difficulty: {
        type: Type.OBJECT,
        properties: {
          [Difficulty.RECALL]: { type: Type.INTEGER },
          [Difficulty.UNDERSTAND]: { type: Type.INTEGER },
          [Difficulty.APPLY]: { type: Type.INTEGER },
          [Difficulty.ADVANCED]: { type: Type.INTEGER },
        },
        required: [Difficulty.RECALL, Difficulty.UNDERSTAND, Difficulty.APPLY, Difficulty.ADVANCED]
      }
    },
    required: ["counts", "difficulty"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1
      }
    });

    const text = cleanJsonResponse(response.text || "");
    return JSON.parse(text) as AnalyzedMatrix;
  } catch (error) {
    console.error("Error analyzing matrix:", error);
    return {
      counts: { MULTIPLE_CHOICE: 0, TRUE_FALSE: 0, SHORT_ANSWER: 0 },
      difficulty: { RECALL: 0, UNDERSTAND: 0, APPLY: 0, ADVANCED: 0 }
    };
  }
};

/**
 * Tạo danh sách câu hỏi đề thi bằng AI dựa trên cấu hình và ma trận.
 */
export const generateQuizQuestions = async (
  config: QuizConfig, 
  matrixInput?: MatrixInput
): Promise<Question[]> => {
  const ai = getClient();
  const parts: any[] = [];

  const systemInstruction = `
    Bạn là chuyên gia soạn đề thi theo chương trình GDPT 2018 Việt Nam.
    Nhiệm vụ: Tạo đề thi "${config.examName}" môn "${config.subject}", "${config.grade}".
    
    Yêu cầu cấu trúc:
    - Phần I (TN 4 lựa chọn): ${config.totalQuestions[QuestionType.MULTIPLE_CHOICE]} câu.
    - Phần II (Đúng/Sai): ${config.totalQuestions[QuestionType.TRUE_FALSE]} câu (4 ý/câu).
    - Phần III (Trả lời ngắn): ${config.totalQuestions[QuestionType.SHORT_ANSWER]} câu.
    
    Yêu cầu mức độ:
    - Nhận biết: ${config.difficultyDistribution[Difficulty.RECALL]}, Thông hiểu: ${config.difficultyDistribution[Difficulty.UNDERSTAND]}, Vận dụng: ${config.difficultyDistribution[Difficulty.APPLY]}, Vận dụng cao: ${config.difficultyDistribution[Difficulty.ADVANCED]}.

    - Với câu hỏi trắc nghiệm nhiều lựa chọn, vị trí đáp án đúng (A, B, C, D) phải được phân bổ ngẫu nhiên đều nhau, không được tập trung vào một phương án.
    Định dạng correctAnswer cho Đúng/Sai: "Đúng, Sai, Đúng, Sai".
    Trả về mảng "questions" trong JSON.
  `;

  let userPrompt = `Hãy tạo đề thi cho bài học: "${config.lesson}".`;
  if (matrixInput) {
    userPrompt += ` Căn cứ vào dữ liệu ma trận đính kèm.`;
    if (matrixInput.type === 'text') {
      userPrompt += `\nNội dung ma trận: ${matrixInput.content}`;
    }
  }
  parts.push({ text: userPrompt });

  if (matrixInput && matrixInput.type === 'image') {
    parts.push({ inlineData: { mimeType: matrixInput.mimeType, data: matrixInput.data } });
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            type: { type: Type.STRING, enum: [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.SHORT_ANSWER] },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: [Difficulty.RECALL, Difficulty.UNDERSTAND, Difficulty.APPLY, Difficulty.ADVANCED] }
          },
          required: ["text", "type", "correctAnswer", "difficulty", "explanation"],
        }
      }
    },
    required: ["questions"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7
      }
    });

    const text = cleanJsonResponse(response.text || "");
    if (!text) throw new Error("AI không trả về nội dung đề thi.");
    
    const parsedData = JSON.parse(text);
    const questionsArray = Array.isArray(parsedData.questions) ? parsedData.questions : [];

    if (questionsArray.length === 0) {
      console.warn("AI returned an empty questions array.");
    }

    return questionsArray.map((q: any, index: number) => ({
      id: `q_${Date.now()}_${index}`,
      text: q.text || "Câu hỏi không có nội dung",
      type: q.type as QuestionType,
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer || "",
      difficulty: q.difficulty as Difficulty,
      explanation: q.explanation || "Chưa có lời giải chi tiết."
    }));
  } catch (error) {
    console.error("Gemini API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Không xác định";
    throw new Error(`Lỗi AI: ${errorMessage}. Vui lòng thử lại.`);
  }
};
