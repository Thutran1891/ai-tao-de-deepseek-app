import axios from 'axios';
import { QuizConfig, Question } from "./types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

// --- SCHEMA CHO DEEPSEEK (giữ nguyên cấu trúc) ---
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

export const generateQuizWithDeepSeek = async (config: QuizConfig, userApiKey: string): Promise<Question[]> => {
    if (!userApiKey) throw new Error("Vui lòng nhập API Key!");

    const tnCount = (config.distribution.TN.BIET || 0) + (config.distribution.TN.HIEU || 0) + (config.distribution.TN.VANDUNG || 0);
    const tlnCount = (config.distribution.TLN.BIET || 0) + (config.distribution.TLN.HIEU || 0) + (config.distribution.TLN.VANDUNG || 0);
    const dsCount = (config.distribution.DS.BIET || 0) + (config.distribution.DS.HIEU || 0) + (config.distribution.DS.VANDUNG || 0);
    const totalQuestions = tnCount + tlnCount + dsCount;

    if (totalQuestions === 0) throw new Error("Nhập số lượng câu hỏi!");

    try {
        // Tạo system prompt với schema rõ ràng
        const systemPrompt = `
Bạn là Chuyên Gia Giáo Dục. Tạo ${totalQuestions} câu hỏi về "${config.topic}".
YÊU CẦU QUAN TRỌNG: Bạn PHẢI trả về JSON hợp lệ theo schema đã định nghĩa. KHÔNG thêm bất kỳ text nào khác ngoài JSON.

SCHEMA JSON:
- Mảng các object, mỗi object có cấu trúc: ${JSON.stringify(questionSchema, null, 2)}

PHÂN PHỐI:
- Trắc nghiệm: ${tnCount} câu (Biết: ${config.distribution.TN.BIET}, Hiểu: ${config.distribution.TN.HIEU}, Vận dụng: ${config.distribution.TN.VANDUNG})
- Điền số: ${tlnCount} câu (Biết: ${config.distribution.TLN.BIET}, Hiểu: ${config.distribution.TLN.HIEU}, Vận dụng: ${config.distribution.TLN.VANDUNG})
- Đúng/Sai: ${dsCount} câu (Biết: ${config.distribution.DS.BIET}, Hiểu: ${config.distribution.DS.HIEU}, Vận dụng: ${config.distribution.DS.VANDUNG})

BỔ SUNG: "${config.additionalPrompt || "Không có"}"
`;

        // Tạo user prompt chi tiết (giữ nguyên các rule từ file cũ)
        const userPrompt = `
Tạo ${totalQuestions} câu hỏi về "${config.topic}" theo phân phối trên.

QUY TẮC QUAN TRỌNG:
1. Chỉ trả về JSON hợp lệ, không giải thích thêm
2. Câu hỏi phải đúng mức độ khó theo phân loại
3. Công thức toán dùng LaTeX trong $...$
4. Đối với câu hàm số: chọn chỉ MỘT trong ba dạng: công thức, đồ thị (dùng graphFunction), hoặc bảng biến thiên (dùng variationTableData)
5. Câu hình học không gian: dùng geometryGraph với các cạnh khuất là DASHED
6. Câu Đúng/Sai: phải có 4 statements với isCorrect true/false
7. Tiệm cận: dùng asymptotes array với định dạng "x=2", "y=1", "y=2*x-1"
`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];

        const response = await axios.post(
            DEEPSEEK_API_URL,
            {
                model: "deepseek-chat",
                messages: messages,
                temperature: 0.3,
                max_tokens: 4000,
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${userApiKey}`
                }
            }
        );

        const content = response.data.choices[0].message.content;
        
        // Xử lý JSON response (DeepSeek có thể trả về với markdown code block)
        let jsonString = content;
        
        // Nếu response có markdown code block, extract JSON
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
        if (jsonMatch) {
            jsonString = jsonMatch[1];
        }
        
        // Clean up và parse JSON
        const parsed = JSON.parse(jsonString.trim());
        
        // Nếu parsed là object có property chứa array, extract array
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            // Tìm property đầu tiên là array
            const arrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
            if (arrayKey) {
                return parsed[arrayKey];
            }
        }
        
        return parsed;
    } catch (error: any) {
        console.error("DeepSeek API Error:", error.response?.data || error.message);
        throw new Error(`Lỗi DeepSeek API: ${error.response?.data?.message || error.message}`);
    }
};

export const generateTheoryWithDeepSeek = async (topic: string, userApiKey: string): Promise<string> => {
    if (!userApiKey) throw new Error("Vui lòng nhập API Key!");

    try {
        const response = await axios.post(
            DEEPSEEK_API_URL,
            {
                model: "deepseek-chat",
                messages: [
                    {
                        role: "user",
                        content: `Bạn là giáo viên Phổ thông giỏi. Hãy tóm tắt LÝ THUYẾT TRỌNG TÂM cho chủ đề: "${topic}".
                        
Yêu cầu:
1. Ngắn gọn, súc tích, tập trung vào công thức, định nghĩa, tính chất quan trọng nhất.
2. Trình bày bằng Markdown.
3. Các công thức toán học BẮT BUỘC dùng LaTeX kẹp trong dấu $. Ví dụ: $\\int_{a}^{b} f(x) dx$.
4. Chia mục rõ ràng (I. Định nghĩa, II. Công thức...).
5. Chỉ trả về nội dung lý thuyết, không thêm lời giải thích khác.`
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${userApiKey}`
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error: any) {
        console.error("Lỗi lấy lý thuyết DeepSeek:", error.response?.data || error.message);
        return "Không thể tải lý thuyết lúc này. Vui lòng thử lại.";
    }
};