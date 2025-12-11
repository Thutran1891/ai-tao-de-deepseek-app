import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { QuizConfig, Question } from "./types";

// const apiKey = import.meta.env.VITE_API_KEY as string;
// const genAI = new GoogleGenerativeAI(apiKey || "");

// --- SCHEMA CHUẨN ---

const variationTableSchema = {
    type: SchemaType.OBJECT,
    properties: {
        xNodes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Mốc x (LaTeX)" },
        yPrimeSigns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Dấu y'" },
        yPrimeVals: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Giá trị tại dòng y' (0, ||)" },
        yNodes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Giá trị y (LaTeX). Tại tiệm cận đứng BẮT BUỘC dùng định dạng 'LeftVal||RightVal' (VD: '$+\\infty$||$-\\infty$')" }
    }
};

const geometryGraphSchema = {
    type: SchemaType.OBJECT,
    properties: {
        nodes: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    id: { type: SchemaType.STRING },
                    x: { type: SchemaType.NUMBER },
                    y: { type: SchemaType.NUMBER },
                    z: { type: SchemaType.NUMBER },
                    labelPosition: { type: SchemaType.STRING, nullable: true }
                },
                required: ['id', 'x', 'y', 'z']
            }
        },
        edges: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    from: { type: SchemaType.STRING },
                    to: { type: SchemaType.STRING },
                    style: { type: SchemaType.STRING, enum: ['SOLID', 'DASHED'] }
                },
                required: ['from', 'to', 'style']
            }
        }
    }
};

// Schema rỗng giả để tránh lỗi 400
const plotlyDataSchema = {
    type: SchemaType.OBJECT,
    properties: {
        data: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { x: {type: SchemaType.NUMBER, nullable:true} } } },
        layout: { type: SchemaType.OBJECT, properties: { title: {type: SchemaType.STRING, nullable:true} } }
    }
};

const questionSchema: any = {
  type: SchemaType.OBJECT,
  properties: {
    id: { type: SchemaType.STRING },
    type: { type: SchemaType.STRING, enum: ['TN', 'TLN', 'DS'] },
    // --- THÊM DÒNG NÀY VÀO ---
    difficulty: { type: SchemaType.STRING, enum: ["BIET", "HIEU", "VANDUNG"], description: "Mức độ câu hỏi" },
    // -------------------------
    questionText: { 
      type: SchemaType.STRING, 
      description: "Nội dung câu hỏi (LaTeX $). KHÔNG trả về HTML (như <table>). Nếu cần vẽ bảng thống kê, hãy dùng LaTeX Array. Đối với câu hỏi về hàm số thì chỉ cho duy nhất một trong các dạng thức: công thức, đồ thị, bảng biến thiên, đạo hàm, đồ thị đạo hàm."
  },
    options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    correctAnswer: { type: SchemaType.STRING, description: "TN: Chỉ trả về 'A', 'B', 'C' hoặc 'D'. TLN: Số." },
    explanation: { type: SchemaType.STRING, description: "Lời giải chi tiết. Dùng ký tự '\\n' để xuống dòng giữa các bước giải. Trình bày thoáng, dễ đọc." },

    // Cấu trúc bắt buộc cho câu Đúng/Sai
    statements: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          content: { type: SchemaType.STRING, description: "Nội dung phát biểu" },
          isCorrect: { type: SchemaType.BOOLEAN }
        },
        required: ["id", "content", "isCorrect"]
      }
  },
  // ----------------------------------------------------
    
    variationTableData: { ...variationTableSchema, nullable: true },
    graphFunction: { type: SchemaType.STRING },
    // --- THÊM DÒNG NÀY ---
    asymptotes: { 
      type: SchemaType.ARRAY, 
      items: { type: SchemaType.STRING }, 
      description: "Mảng chứa các đường tiệm cận. Ví dụ: ['x=2', 'y=1', 'y = 2*x + 1]" 
  },
  // ---------------------
    geometryGraph: { ...geometryGraphSchema, nullable: true },
    plotlyData: { ...plotlyDataSchema, nullable: true }
  },
  required: ['id', 'type', 'questionText', 'explanation']
};

// Thêm tham số userApiKey
export const generateQuiz = async (config: QuizConfig, userApiKey: string): Promise<Question[]> => {
  if (!userApiKey) throw new Error("Vui lòng nhập API Key!");

  // Khởi tạo GenAI với key người dùng nhập (thay vì key mặc định)
  const genAI = new GoogleGenerativeAI(userApiKey);

  const tnCount = (config.distribution.TN.BIET || 0) + (config.distribution.TN.HIEU || 0) + (config.distribution.TN.VANDUNG || 0);
  const tlnCount = (config.distribution.TLN.BIET || 0) + (config.distribution.TLN.HIEU || 0) + (config.distribution.TLN.VANDUNG || 0);
  const dsCount = (config.distribution.DS.BIET || 0) + (config.distribution.DS.HIEU || 0) + (config.distribution.DS.VANDUNG || 0);
  const totalQuestions = tnCount + tlnCount + dsCount;

  if (totalQuestions === 0) throw new Error("Nhập số lượng câu hỏi!");

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: { type: SchemaType.ARRAY, items: questionSchema },
        temperature: 0.3,
        // TĂNG LÊN MỨC CAO ĐỂ TRÁNH BỊ CẮT CỤT JSON
        maxOutputTokens: 20000,
      }
    });

    const prompt = `
      Bạn là Chuyên Gia Giáo Dục. Tạo ${totalQuestions} câu hỏi:
      1. CHỦ ĐỀ: "${config.topic}"
      2. BỔ SUNG: "${config.additionalPrompt || "Không có"}"
      
      3. PHÂN PHỐI CHI TIẾT (BẮT BUỘC TUÂN THỦ CẤP ĐỘ):
         - Trắc nghiệm (${tnCount} câu):
            + Mức Biết: ${config.distribution.TN.BIET || 0} câu
            + Mức Hiểu: ${config.distribution.TN.HIEU || 0} câu
            + Mức Vận dụng: ${config.distribution.TN.VANDUNG || 0} câu
         
         - Điền số (${tlnCount} câu):
            + Mức Biết: ${config.distribution.TLN.BIET || 0} câu
            + Mức Hiểu: ${config.distribution.TLN.HIEU || 0} câu
            + Mức Vận dụng: ${config.distribution.TLN.VANDUNG || 0} câu
            
         - Đúng/Sai (${dsCount} câu):
            + Mức Biết: ${config.distribution.DS.BIET || 0} câu
            + Mức Hiểu: ${config.distribution.DS.HIEU || 0} câu
            + Mức Vận dụng: ${config.distribution.DS.VANDUNG || 0} câu

      QUY TẮC HIỂN THỊ (TUYỆT ĐỐI TUÂN THỦ):

      RULE 1. NỘI DUNG CÂU HỎI (questionText):
        - CHỈ chứa đề bài text và công thức LaTeX ($...$).
        - KHÔNG được mô tả hình ảnh bằng lời (Ví dụ SAI: "Hình vẽ bên là...").
        - Nếu đề bài dùng hình ảnh (Đồ thị/BBT/Hình không gian), hãy viết: "Cho hàm số có đồ thị/bảng biến thiên như hình bên." hoặc "Cho hình chóp...".
        - Đối với câu hỏi Hàm số: Nếu ĐÃ cung cấp dữ liệu hình ảnh (graphFunction hoặc variationTableData) thì trong text KHÔNG viết lại công thức hàm số tường minh nữa để tránh lộ đáp án.
        - Câu Vận Dụng: Phải khó hơn, lắt léo hơn câu Biết/Hiểu. Chủ yếu là bài toán ứng dụng thực tế - tuỳ bối cảnh.
        - PHÂN SỐ: Bắt buộc dùng LaTeX '\dfrac{a}{b}' (Ví dụ: $\dfrac{1}{2}$) thay vì viết '1/2'.
        - Ký hiệu giới hạn thì viết: '\displaystyle\lim\limits', kí hiệu nguyên hàm/tích phân thì viết '\displaystyle\int'.
        - TUYỆT ĐỐI KHÔNG viết lời mô tả hình ảnh vào đây (Ví dụ SAI: "(Hình vẽ mô tả một đồ thị...)").
        - Nếu đề bài cần hình, hãy nói "Cho đồ thị như hình bên." và dùng các trường bên dưới để vẽ.
        - 'explanation': Lời giải chi tiết. BẮT BUỘC dùng ký tự '\\n' để ngắt dòng giữa các bước tính toán/lập luận.
        - Trong lời giải có câu chốt cuối cùng: Vậy đáp án đúng là ...
        - TUYỆT ĐỐI KHÔNG được tự viết code bảng biến thiên (như \\begin{array} hay <table>) vào đây. 
         - Nếu đề có bảng biến thiên, chỉ cần ghi "Cho bảng biến thiên như hình bên:" rồi để code tự vẽ.

      RULE 2: NGUYÊN TẮC ĐÁP ÁN ĐÚNG DUY NHẤT (QUAN TRỌNG NHẤT)
        - Với câu hỏi Trắc nghiệm (TN), trong 4 phương án A, B, C, D:
        - CHỈ ĐƯỢC PHÉP CÓ 1 PHƯƠNG ÁN ĐÚNG. 3 phương án còn lại PHẢI LÀ SAI (Phương án nhiễu).
        - Xử lý lỗi thường gặp về tính Đơn điệu (Đồng biến/Nghịch biến):
            + Nếu hàm số đồng biến trên cả 2 khoảng $(-\\infty; -1)$ và $(1; +\\infty)$.
            + THÌ: Chỉ được đưa 1 trong 2 khoảng đó vào đáp án đúng (Ví dụ chọn A là $(1; +\\infty)$).
            + TUYỆT ĐỐI KHÔNG đưa khoảng đúng còn lại (là $(-\\infty; -1)$) vào các phương án B, C, D.
            + Các phương án nhiễu phải là các khoảng nghịch biến hoặc khoảng sai hẳn.

      RULE 3. QUY TẮC CÂU ĐÚNG/SAI (DS):
      - BẮT BUỘC trả về mảng 'statements' gồm 4 phát biểu (a, b, c, d).
      - Mỗi phát biểu có 'content' và 'isCorrect' (true/false).
      - KHÔNG được để trống 'statements'.  

      RULE 4. QUY TẮC CÂU ĐIỀN ĐÁP SỐ (TLN): Câu hỏi phải có câu trả lời là 1 số nguyên hoặc số thập phân, nếu là số thập phân vô hạn thì thêm chú thích yêu cầu làm tròn đến chữ số thập phân thứ hai.

      RULE 5. HÌNH HỌC KHÔNG GIAN (Oxyz) (BẮT BUỘC TUÂN THỦ ĐỂ CÓ NÉT ĐỨT)::
         - BẮT BUỘC dùng trường 'geometryGraph' (Nodes & Edges).  
            
        a. HÌNH CHÓP S.ABCD (Đáy là hình bình hành/chữ nhật):
          - Đỉnh khuất là A (góc trong cùng).
          - Các cạnh xuất phát từ A phải là nét đứt ('DASHED'): AB, AD, SA.
          - Các cạnh còn lại là nét liền ('SOLID').
          - Tọa độ mẫu: A(0,0,0), B(4,0,0), C(6,2,0), D(2,2,0), S(3,1,5).

        b. HÌNH CHÓP S.ABC (Đáy là tam giác):         
          - Chỉ cạnh AC là nét đứt ('DASHED').
          - Các cạnh còn lại là nét liền ('SOLID').
          - Tọa độ mẫu: A(0,0,0), B(3,0,0), C(0,7,0), S(3,1,4).

        c. HÌNH HỘP CHỮ NHẬT ABCD.A'B'C'D':
          - Đỉnh khuất là A (góc trong cùng dưới đáy).
          - Các cạnh xuất phát từ A phải là nét đứt ('DASHED'): AB, AD, AA'.
          - Các cạnh còn lại là nét liền ('SOLID').
          - Tọa độ mẫu: A(0,0,0), B(4,0,0), C(4,3,0), D(0,3,0), A'(0,0,4)...

        d. HÌNH LĂNG TRỤ TAM GIÁC ABC.A'B'C':
          - Cạnh khuất thường là cạnh đáy bên trong (ví dụ AC) hoặc cạnh bên khuất.
          - Hãy suy luận logic để set 'style': 'DASHED' cho đúng cạnh bị che.

      RULE 6. HÌNH PHẲNG (2D) - Tam giác, Hình bình hành, Hình thang...:
          - BẮT BUỘC Đặt tất cả tọa độ Z = 0.
          - SỬ DỤNG HỆ TRỤC TỌA ĐỘ OXY CHUẨN:
            + Trục hoành là x, Trục tung là y.
            + Để vẽ góc vuông chuẩn, hãy đặt các cạnh song song với trục tọa độ.
            + Ví dụ Tam giác ABC vuông tại A: A(0,0,0), B(0,4,0), C(3,0,0). (Vuông tại gốc tọa độ).
            + Ví dụ Hình chữ nhật: (0,0,0), (4,0,0), (4,2,0), (0,2,0).
          - TẤT CẢ CÁC CẠNH PHẢI LÀ 'SOLID'.
          
      RULE 7. QUY TẮC ĐỒ THỊ HÀM SỐ (QUAN TRỌNG):
              - Nếu câu hỏi yêu cầu nhìn đồ thị để tìm cực trị, đồng biến/nghịch biến...:
              - BẮT BUỘC trả về trường 'graphFunction'.
              - CÚ PHÁP PHẢI LÀ JAVASCRIPT THUẦN (Không dùng LaTeX):
                  + SAI: x^3 - 3x, sin(x), \frac{1}{x}
                  + ĐÚNG: x*x*x - 3*x, Math.sin(x), 1/x, (x+1)/(x-2)
              - Ví dụ hàm bậc 3: "x*x*x - 3*x + 1"
              - Ví dụ hàm phân thức: "(2*x + 1)/(x - 1)"
            - Nếu đồ thị có tiệm cận, BẮT BUỘC trả về mảng 'asymptotes'.
            - Cú pháp tiệm cận:
                + Tiệm cận ngang y = 1 -> Viết: "y=1"
                + Tiệm cận đứng x = 2 -> Viết: "x=2"
                + Tiệm cận xiên y = 2x - 1 -> Viết: "y=2*x-1" (Nhớ có dấu * nhân)
            - Ví dụ đầy đủ: 
              {
                "graphFunction": "(2*x + 1)/(x - 1)",
                "asymptotes": ["x=1", "y=2"]
              }


      RULE 8. QUY TẮC BẢNG BIẾN THIÊN (VariationTable):
        - Nếu câu hỏi là "Cho bảng biến thiên như hình bên", BẮT BUỘC phải sinh dữ liệu 'variationTableData'.
        - Cấu trúc CHUẨN KỸ THUẬT:
            + xNodes: ["$-\\infty$", "x1", "x2", "$+\\infty$"] (Luôn bắt đầu và kết thúc bằng vô cực nếu là hàm đa thức/phân thức)
            + yPrimeSigns: ["+", "-", "+"] (Số lượng ít hơn xNodes 1 đơn vị)
            + yPrimeVals: Tại vị trí nghiệm ghi "0", tại vị trí không xác định ghi "||".
            + yNodes: Phải khớp logic với dấu của y'.
              * QUAN TRỌNG VỚI TIỆM CẬN ĐỨNG: Tại vị trí x mà hàm số không xác định (có dấu || ở y' và y), giá trị yNodes BẮT BUỘC phải viết cả giới hạn trái và phải ngăn cách bởi '||'.
              * VÍ DỤ ĐÚNG: "$+\\infty$||$-\\infty$" (Tuyệt đối KHÔNG được viết thiếu như "$+\\infty$||" hay chỉ "$+\\infty$").
              * Nếu y' là "+" -> yNodes tăng. Nếu y' là "-" -> yNodes giảm.
        - MẸO: Hãy tự kiểm tra logic: "Dương đi lên, Âm đi xuống".

      RULE 9. NGUYÊN TẮC PHÂN LOẠI DỮ LIỆU (QUAN TRỌNG - SỬA ĐỔI):
        
        A. NẾU LÀ CÂU HỎI HÌNH HỌC (Oxyz, Hình không gian, Hình phẳng):
           - BẮT BUỘC trả về 'geometryGraph' để vẽ hình.
           - KHÔNG trả về 'variationTableData' hay 'graphFunction'.

        B. NẾU LÀ CÂU HỎI GIẢI TÍCH / HÀM SỐ:
           - Bắt buộc chọn DUY NHẤT 1 trong 3 hình thức hiển thị sau (Không được trộn lẫn):
           
           Option 1: CHO BẰNG CÔNG THỨC (Đại số)
             - Chỉ cung cấp text và công thức trong 'questionText'.
             - Để null các trường: 'graphFunction', 'variationTableData', 'geometryGraph'.
             
           Option 2: CHO BẰNG ĐỒ THỊ
             - Trả về 'graphFunction' (và 'asymptotes' nếu có).
             - Để null các trường: 'variationTableData', 'geometryGraph'.
             - Trong 'questionText' phải ghi: "Cho đồ thị hàm số y=f(x) như hình bên."
             
           Option 3: CHO BẰNG BẢNG BIẾN THIÊN
             - Trả về 'variationTableData'.
             - Để null các trường: 'graphFunction', 'geometryGraph'.
             - Trong 'questionText' phải ghi: "Cho bảng biến thiên như hình bên."

         Trả về JSON mảng ${totalQuestions} câu.
    `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

// ... các import cũ

// Thêm hàm sinh lý thuyết
export const generateTheory = async (topic: string, userApiKey: string): Promise<string> => {
  if (!userApiKey) throw new Error("Vui lòng nhập API Key!");
  const genAI = new GoogleGenerativeAI(userApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Bạn là giáo viên Phổ thông giỏi. Hãy tóm tắt LÝ THUYẾT TRỌNG TÂM cho chủ đề: "${topic}".
    Yêu cầu:
    1. Ngắn gọn, súc tích, tập trung vào công thức, định nghĩa, tính chất quan trọng nhất.
    2. Trình bày bằng Markdown.
    3. Các công thức toán học BẮT BUỘC dùng LaTeX kẹp trong dấu $. Ví dụ: $\\int_{a}^{b} f(x) dx$.
    4. Chia mục rõ ràng (I. Định nghĩa, II. Công thức...).
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Lỗi lấy lý thuyết:", error);
    return "Không thể tải lý thuyết lúc này. Vui lòng thử lại.";
  }
};