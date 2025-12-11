import axios from 'axios';
import { QuizConfig, Question } from "./types";

// Sử dụng proxy endpoint thay vì gọi trực tiếp
const PROXY_URL = '/api/deepseek-proxy';

// --- SCHEMA CHO DEEPSEEK ---
const variationTableSchema = {
    type: "object",
    properties: {
        xNodes: { type: "array", items: { type: "string" }, description: "Mốc x (LaTeX)" },
        yPrimeSigns: { type: "array", items: { type: "string" }, description: "Dấu y'" },
        yPrimeVals: { type: "array", items: { type: "string" }, description: "Giá trị tại dòng y' (0, ||)" },
        yNodes: { type: "array", items: { type: "string" }, description: "Giá trị y (LaTeX). Tại tiệm cận đứng BẮT BUỘC dùng định dạng 'LeftVal||RightVal'" }
    }
};

const geometryGraphSchema = {
    type: "object",
    properties: {
        nodes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    x: { type: "number" },
                    y: { type: "number" },
                    z: { type: "number" },
                    labelPosition: { type: "string", nullable: true }
                },
                required: ['id', 'x', 'y', 'z']
            }
        },
        edges: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    from: { type: "string" },
                    to: { type: "string" },
                    style: { type: "string", enum: ['SOLID', 'DASHED'] }
                },
                required: ['from', 'to', 'style']
            }
        }
    }
};

const questionSchema = {
    type: "object",
    properties: {
        id: { type: "string" },
        type: { type: "string", enum: ['TN', 'TLN', 'DS'] },
        difficulty: { type: "string", enum: ["BIET", "HIEU", "VANDUNG"], description: "Mức độ câu hỏi" },
        questionText: { 
            type: "string", 
            description: "Nội dung câu hỏi (LaTeX $). KHÔNG trả về HTML. Chỉ dùng LaTeX Array cho bảng. Cho hàm số: chỉ một dạng thức (công thức, đồ thị, bảng biến thiên)."
        },
        options: { type: "array", items: { type: "string" } },
        correctAnswer: { type: "string", description: "TN: 'A','B','C','D'. TLN: Số." },
        explanation: { type: "string", description: "Lời giải chi tiết. Dùng '\\n' để xuống dòng." },
        statements: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    content: { type: "string", description: "Nội dung phát biểu" },
                    isCorrect: { type: "boolean" }
                },
                required: ["id", "content", "isCorrect"]
            }
        },
        variationTableData: { ...variationTableSchema, nullable: true },
        graphFunction: { type: "string", nullable: true },
        asymptotes: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Mảng chứa các đường tiệm cận." 
        },
        geometryGraph: { ...geometryGraphSchema, nullable: true },
        plotlyData: { 
            type: "object", 
            properties: {
                data: { type: "array", items: { type: "object" } },
                layout: { type: "object", properties: { title: { type: "string", nullable: true } } }
            },
            nullable: true 
        }
    },
    required: ['id', 'type', 'questionText', 'explanation']
};

// Hàm chính tạo đề thi qua proxy
export const generateQuizWithDeepSeek = async (config: QuizConfig, userApiKey: string): Promise<Question[]> => {
    if (!userApiKey) throw new Error("Vui lòng nhập API Key!");
    
    console.log("🔍 [Debug] Starting generateQuizWithDeepSeek...");
    console.log("🔍 [Debug] API Key length:", userApiKey.length);
    console.log("🔍 [Debug] API Key starts with:", userApiKey.substring(0, 3));
    
    const tnCount = (config.distribution.TN.BIET || 0) + (config.distribution.TN.HIEU || 0) + (config.distribution.TN.VANDUNG || 0);
    const tlnCount = (config.distribution.TLN.BIET || 0) + (config.distribution.TLN.HIEU || 0) + (config.distribution.TLN.VANDUNG || 0);
    const dsCount = (config.distribution.DS.BIET || 0) + (config.distribution.DS.HIEU || 0) + (config.distribution.DS.VANDUNG || 0);
    const totalQuestions = tnCount + tlnCount + dsCount;

    if (totalQuestions === 0) throw new Error("Nhập số lượng câu hỏi ít nhất là 1!");
    
    // Tạo prompt chi tiết
    const systemPrompt = `Bạn là Chuyên Gia Giáo Dục chuyên tạo đề thi Toán học. 
    Hãy tạo ${totalQuestions} câu hỏi về chủ đề "${config.topic}" theo phân phối và yêu cầu sau.
    
    QUAN TRỌNG: Bạn PHẢI trả về JSON hợp lệ theo schema đã định. Chỉ trả về JSON, không thêm text giải thích.
    
    SCHEMA JSON cần tuân thủ: ${JSON.stringify(questionSchema, null, 2)}
    
    PHÂN PHỐI CÂU HỎI:
    - Trắc nghiệm (TN): ${tnCount} câu
      + Mức Biết: ${config.distribution.TN.BIET || 0}
      + Mức Hiểu: ${config.distribution.TN.HIEU || 0}
      + Mức Vận dụng: ${config.distribution.TN.VANDUNG || 0}
      
    - Tự luận số (TLN): ${tlnCount} câu
      + Mức Biết: ${config.distribution.TLN.BIET || 0}
      + Mức Hiểu: ${config.distribution.TLN.HIEU || 0}
      + Mức Vận dụng: ${config.distribution.TLN.VANDUNG || 0}
      
    - Đúng/Sai (DS): ${dsCount} câu
      + Mức Biết: ${config.distribution.DS.BIET || 0}
      + Mức Hiểu: ${config.distribution.DS.HIEU || 0}
      + Mức Vận dụng: ${config.distribution.DS.VANDUNG || 0}
    
    YÊU CẦU BỔ SUNG: ${config.additionalPrompt || "Không có"}
    
    QUY TẮC QUAN TRỌNG:
    1. Mỗi câu hỏi phải có ID duy nhất (ví dụ: "q1", "q2")
    2. Công thức toán học dùng LaTeX trong $...$
    3. Câu hình học không gian: dùng geometryGraph với cạnh khuất là DASHED
    4. Câu hàm số: chỉ chọn MỘT dạng (công thức, đồ thị, hoặc bảng biến thiên)
    5. Tiệm cận: dùng asymptotes array (ví dụ: ["x=2", "y=1"])
    6. Bảng biến thiên: dùng variationTableData với định dạng chuẩn
    7. Câu Đúng/Sai: phải có 4 statements với isCorrect true/false`;

    const userPrompt = `Tạo chính xác ${totalQuestions} câu hỏi về "${config.topic}" theo phân phối và yêu cầu trên.
    Đảm bảo mỗi câu đúng mức độ khó.
    Chỉ trả về JSON mảng các câu hỏi.`;

    try {
        console.log("🔍 [Debug] Sending request to proxy...");
        console.log("🔍 [Debug] Proxy URL:", PROXY_URL);
        
        const response = await axios.post(PROXY_URL, {
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            apiKey: userApiKey,
            model: "deepseek-chat",
            temperature: 0.3,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        }, {
            timeout: 60000, // 60 giây timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("🔍 [Debug] Response received:", response.status);
        
        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            throw new Error("DeepSeek trả về response không đúng định dạng");
        }

        const content = response.data.choices[0].message.content;
        console.log("🔍 [Debug] Content received, length:", content.length);
        
        // Xử lý JSON response (có thể có markdown code block)
        let jsonString = content;
        
        // Trích xuất JSON từ code block nếu có
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
        if (jsonMatch) {
            jsonString = jsonMatch[1];
            console.log("🔍 [Debug] Extracted JSON from code block");
        } else if (content.includes('{')) {
            // Tìm phần JSON đầu tiên
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}') + 1;
            if (start !== -1 && end !== 0) {
                jsonString = content.substring(start, end);
            }
        }
        
        console.log("🔍 [Debug] Parsing JSON...");
        const parsed = JSON.parse(jsonString.trim());
        
        // Xử lý response: có thể là object chứa array hoặc trực tiếp là array
        let questionsArray: Question[] = [];
        
        if (Array.isArray(parsed)) {
            questionsArray = parsed;
        } else if (parsed && typeof parsed === 'object') {
            // Tìm property đầu tiên là array
            const arrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
            if (arrayKey) {
                questionsArray = parsed[arrayKey];
            } else if (parsed.questions) {
                questionsArray = parsed.questions;
            } else if (parsed.data) {
                questionsArray = parsed.data;
            }
        }
        
        console.log("🔍 [Debug] Parsed questions count:", questionsArray.length);
        
        // Validate số lượng câu hỏi
        if (questionsArray.length !== totalQuestions) {
            console.warn(`⚠️ Số câu hỏi tạo (${questionsArray.length}) không khớp yêu cầu (${totalQuestions})`);
        }
        
        return questionsArray;
    } catch (error: any) {
        console.error("❌ [Debug] DeepSeek Proxy Error:");
        console.error("Error message:", error.message);
        console.error("Error response:", error.response?.data);
        console.error("Error config:", error.config);
        
        if (error.code === 'ECONNABORTED') {
            throw new Error("Request timeout - Vui lòng thử lại với ít câu hỏi hơn");
        } else if (error.response?.status === 401) {
            throw new Error("API Key không hợp lệ. Vui lòng kiểm tra lại DeepSeek API Key");
        } else if (error.response?.status === 429) {
            throw new Error("Quá nhiều request. Vui lòng thử lại sau vài phút");
        } else if (error.response?.data?.error) {
            throw new Error(`DeepSeek API: ${error.response.data.error}`);
        } else if (error.message.includes('Network Error')) {
            throw new Error("Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại");
        } else {
            throw new Error(`Lỗi tạo đề: ${error.message || "Unknown error"}`);
        }
    }
};

// Hàm tạo lý thuyết qua proxy
export const generateTheoryWithDeepSeek = async (topic: string, userApiKey: string): Promise<string> => {
    if (!userApiKey) throw new Error("Vui lòng nhập API Key!");
    
    console.log("🔍 [Debug] Generating theory for topic:", topic);
    
    try {
        const response = await axios.post(PROXY_URL, {
            messages: [
                {
                    role: "user",
                    content: `Bạn là giáo viên Toán THPT giỏi. Hãy tóm tắt LÝ THUYẾT TRỌNG TÂM cho chủ đề: "${topic}".
                    
YÊU CẦU:
1. Ngắn gọn, súc tích, tập trung vào công thức, định nghĩa, tính chất quan trọng nhất
2. Trình bày bằng Markdown với các heading (#, ##, ###)
3. Các công thức toán học BẮT BUỘC dùng LaTeX kẹp trong dấu $
   Ví dụ: $\\int_{a}^{b} f(x) dx$, $\\lim_{x \\to a} f(x)$
4. Chia mục rõ ràng: I. Định nghĩa, II. Công thức, III. Tính chất, IV. Ví dụ minh họa
5. Chỉ trả về nội dung lý thuyết, không thêm lời giải thích khác
6. Dùng tiếng Việt với thuật ngữ Toán học chuẩn

Hãy tạo lý thuyết chất lượng, tập trung vào những phần học sinh thường hay quên hoặc nhầm lẫn.`
                }
            ],
            apiKey: userApiKey,
            model: "deepseek-chat",
            temperature: 0.2,
            max_tokens: 2000
        }, {
            timeout: 30000, // 30 giây timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            throw new Error("DeepSeek trả về response không đúng định dạng");
        }

        return response.data.choices[0].message.content;
    } catch (error: any) {
        console.error("❌ [Debug] Theory generation error:", error.message);
        
        if (error.response?.status === 401) {
            throw new Error("API Key không hợp lệ. Vui lòng kiểm tra lại DeepSeek API Key");
        } else if (error.response?.data?.error) {
            throw new Error(`Lỗi lý thuyết: ${error.response.data.error}`);
        } else {
            return `Không thể tải lý thuyết lúc này: ${error.message}`;
        }
    }
};

// Hàm test API Key (tùy chọn)
export const testDeepSeekApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey) return false;
    
    try {
        const response = await axios.post(PROXY_URL, {
            messages: [{ role: "user", content: "Hello" }],
            apiKey: apiKey,
            model: "deepseek-chat",
            temperature: 0.1,
            max_tokens: 10
        }, {
            timeout: 10000
        });
        
        return response.status === 200;
    } catch (error) {
        console.error("API Key test failed:", error);
        return false;
    }
};