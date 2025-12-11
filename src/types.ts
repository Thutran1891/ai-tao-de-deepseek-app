// src/types.ts

export type QuestionType = 'TN' | 'TLN' | 'DS';
export type DifficultyLevel = 'BIET' | 'HIEU' | 'VANDUNG';

// Cấu trúc Hình học 3D
export interface GeometryNode {
  id: string; x: number; y: number; z: number; labelPosition?: string;
}
export interface GeometryEdge {
  from: string; to: string; style?: 'SOLID' | 'DASHED'; color?: string;
}
export interface GeometryGraph {
  nodes: GeometryNode[]; edges: GeometryEdge[];
}

// Cấu trúc Bảng biến thiên
export interface VariationTableData {
  xNodes: string[];
  yPrimeSigns: string[];
  yPrimeVals?: string[];
  yNodes: string[];
}

export interface QuizConfig {
  topic: string;
  distribution: {
    TN: { BIET: number; HIEU: number; VANDUNG: number };
    TLN: { BIET: number; HIEU: number; VANDUNG: number };
    DS: { BIET: number; HIEU: number; VANDUNG: number };
  };
  additionalPrompt: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  questionText: string; 
  
  options?: string[]; // Cho TN
  correctAnswer?: string; // Cho TN, TLN
  
  // KHÔI PHỤC: Cấu trúc cho câu Đúng/Sai (DS)
  statements?: Array<{
    id: string;
    content: string; 
    isCorrect: boolean; 
  }>;

  explanation: string; 
  
  // Hình ảnh
  graphFunction?: string; 
  asymptotes?: string[]; // <-- Thêm dòng này
  geometryGraph?: GeometryGraph; 
  variationTableData?: VariationTableData; 
  
  userAnswer?: string;
  isCorrect?: boolean;
  showSolution?: boolean;
}

// THÊM: Thông tin gói cước người dùng
export interface UserSubscription {
  uid: string;
  email: string;
  displayName: string;
  startDate: any; // Ngày bắt đầu dùng thử (Timestamp)
  expiryDate?: any; // Ngày hết hạn (nếu đã mua)
  isPremium: boolean; // Trạng thái đã trả phí chưa
}