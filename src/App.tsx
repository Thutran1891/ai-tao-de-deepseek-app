import { useState, useEffect } from 'react';
import { QuizInput } from './components/QuizInput';
import { QuestionCard } from './components/QuestionCard';
import { Login } from './components/Login';
import { History } from './components/History';
import { generateQuizWithDeepSeek, generateTheoryWithDeepSeek } from './deepseekService'; // ĐỔI: generateQuiz -> generateQuizWithDeepSeek, generateTheory -> generateTheoryWithDeepSeek
import { QuizConfig, Question } from './types';
// import { RefreshCcw, Trophy, ArrowLeft, History as HistoryIcon, Save } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
// 1. Thêm BookOpen, X vào dòng import từ 'lucide-react'
import { RefreshCcw, Trophy, ArrowLeft, History as HistoryIcon, Save, BookOpen, X } from 'lucide-react';

// 2. Import hàm sinh lý thuyết và component hiển thị Latex
// REMOVED: import { generateTheory } from './deepseekService'; // XÓA DÒNG NÀY VÌ ĐÃ IMPORT Ở TRÊN
import { LatexText } from './components/LatexText';

import { SubscriptionGuard } from './components/SubscriptionGuard'; // Import mới
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [score, setScore] = useState(0);
  const [currentApiKey, setCurrentApiKey] = useState<string>("");
  const [viewHistory, setViewHistory] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // --- [CODE MỚI] STATE QUẢN LÝ LÝ THUYẾT ---
  const [showTheory, setShowTheory] = useState(false);
  const [theoryContent, setTheoryContent] = useState('');
  const [loadingTheory, setLoadingTheory] = useState(false);

  // Hàm mở lý thuyết (chỉ tải nếu chưa có nội dung)
  const handleToggleTheory = async () => {
    setShowTheory(true); // Mở khung ngay

    // Nếu đã có nội dung hoặc thiếu thông tin thì dừng
    if (theoryContent || !config?.topic || !currentApiKey) return;

    setLoadingTheory(true);
    try {
      const content = await generateTheoryWithDeepSeek(config.topic, currentApiKey); // ĐỔI: generateTheory -> generateTheoryWithDeepSeek
      setTheoryContent(content);
    } catch (error) {
      console.error(error);
      setTheoryContent("Không thể tải lý thuyết. Vui lòng thử lại.");
    } finally {
      setLoadingTheory(false);
    }
  };
  // ------------------------------------------

  const handleGenerate = async (newConfig: QuizConfig, apiKey: string) => {
    setLoading(true);
    setConfig(newConfig);
    setCurrentApiKey(apiKey);
    setScore(0);
    setIsSaved(false);
    setQuestions([]); 
    setTheoryContent(''); // <--- THÊM DÒNG NÀY ĐỂ RESET LÝ THUYẾT CŨ
    try {
      const result = await generateQuizWithDeepSeek(newConfig, apiKey); // ĐỔI: generateQuiz -> generateQuizWithDeepSeek
      setQuestions(result);
    } catch (error: any) {
      alert("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (config && currentApiKey) handleGenerate(config, currentApiKey);
  };

  const handleUpdateScore = (isCorrect: boolean) => {
    if (isCorrect) setScore(prev => prev + 1);
  };

  // --- THÊM HÀM QUAN TRỌNG NÀY ---
  // Hàm này giúp lưu đáp án người dùng chọn vào bộ nhớ, để khi bấm "Lưu điểm", nó sẽ lưu cả đáp án này lên Server
  const handleQuestionUpdate = (updatedQ: Question) => {
    setQuestions(prev => prev.map(q => q.id === updatedQ.id ? updatedQ : q));
  };
  // ------------------------------

  // Tìm đến hàm này:
  const handleSaveResult = async () => {
    if (!user || !config || isSaved) return;
    try {
      // --- [ĐOẠN CŨ - XÓA HOẶC COMMENT LẠI] ---
      /* await addDoc(collection(db, "results"), {
        userId: user.uid,
        topic: config.topic,
        score: score,
        total: questions.length,
        date: serverTimestamp(),
        fullData: JSON.stringify(questions) 
      });
      */

      // --- [ĐOẠN MỚI - THAY THẾ VÀO ĐÂY] ---
      // Lưu vào: users -> [ID của user] -> examHistory -> [Bài thi]
      const historyRef = collection(db, "users", user.uid, "examHistory");
      
      await addDoc(historyRef, {
        // Không cần lưu userId nữa vì đã nằm trong folder của họ rồi
        topic: config.topic,
        score: score,
        total: questions.length,
        date: serverTimestamp(),
        fullData: JSON.stringify(questions) 
      });
      // ----------------------------------------
      
      setIsSaved(true);
      alert("Đã lưu kết quả thành công!");
    } catch (e) {
      console.error("Lỗi lưu:", e);
      alert("Không thể lưu kết quả.");
    }
  };

  if (!user) return <Login />;

  if (viewHistory) {
    return <History onBack={() => setViewHistory(false)} />;
  }

  return (
    <SubscriptionGuard>
    <div className="min-h-screen py-8 px-4 font-sans bg-slate-50">
      {questions.length === 0 ? (
        <>
          <div className="max-w-2xl mx-auto mb-4 flex justify-end">
             <button onClick={() => setViewHistory(true)} className="flex items-center gap-2 text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors">
                <HistoryIcon size={20}/> Xem Lịch sử
             </button>
          </div>
          <QuizInput onGenerate={handleGenerate} isLoading={loading} />
        </>
        ) : (
          <div className="max-w-3xl mx-auto animate-fade-in relative"> {/* Thêm relative */}
            
            {/* THANH HEADER (CHỨA NÚT LÝ THUYẾT) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 mb-6 flex flex-col sm:flex-row justify-between items-center sticky top-2 z-10 gap-3">
              <div className="flex-1">
                <h2 className="font-bold text-lg text-gray-800 line-clamp-1">{config?.topic}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                  <span className="flex items-center gap-1"><Trophy size={16} className="text-yellow-500" /> Đúng: <b className="text-primary">{score}/{questions.length}</b></span>
                  {!isSaved ? (
                      <button onClick={handleSaveResult} className="flex items-center gap-1 text-green-600 hover:underline font-medium text-xs bg-green-50 px-2 py-1 rounded border border-green-200">
                          <Save size={14}/> Lưu điểm
                      </button>
                  ) : (
                      <span className="text-green-600 text-xs font-bold flex items-center gap-1"><Save size={14}/> Đã lưu</span>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                {/* --- [NÚT LÝ THUYẾT MỚI] --- */}
                <button 
                  onClick={handleToggleTheory}
                  className="flex-1 sm:flex-none justify-center px-3 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-sm font-bold flex items-center gap-2 border border-orange-200 transition-colors"
                >
                  <BookOpen size={18}/> Lý thuyết
                </button>
                {/* --------------------------- */}

                <button onClick={() => setQuestions([])} className="flex-1 sm:flex-none justify-center px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-1 border border-transparent hover:border-gray-200">
                  <ArrowLeft size={16}/> Quay lại
                </button>
                <button onClick={handleRegenerate} disabled={loading} className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                  <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
                  {loading ? "Đang tạo..." : "Tạo lại"}
                </button>
              </div>
            </div>

            {/* DANH SÁCH CÂU HỎI (GIỮ NGUYÊN) */}
            <div className="space-y-6 pb-20">
              {questions.map((q, idx) => (
                <QuestionCard 
                  key={q.id || idx} 
                  index={idx} 
                  question={q} 
                  onUpdateScore={handleUpdateScore} 
                  onDataChange={handleQuestionUpdate}
                />
              ))}
            </div>

            {/* --- [KHUNG SIDEBAR LÝ THUYẾT] (Code giống hệt bên QuizInput) --- */}
            {showTheory && (
              <div className="fixed top-24 right-5 w-[450px] max-w-[90vw] h-[80vh] bg-white rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.15)] border border-gray-200 z-50 flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="p-4 border-b flex justify-between items-center bg-orange-50 rounded-t-2xl">
                      <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                          <BookOpen size={20}/> KIẾN THỨC: {config?.topic}
                      </h3>
                      <button 
                          onClick={() => setShowTheory(false)} 
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm border border-gray-100"
                      >
                          <X size={18} />
                      </button>
                  </div>

                  <div className="p-5 overflow-y-auto flex-1 text-gray-800 leading-relaxed text-sm scroll-smooth">
                      {loadingTheory ? (
                          <div className="flex flex-col items-center justify-center h-full space-y-3">
                              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                              <p className="text-gray-500 text-xs animate-pulse">Đang tra cứu kiến thức...</p>
                          </div>
                      ) : (
                          <div className="whitespace-pre-wrap">
                              <LatexText text={theoryContent} />
                          </div>
                      )}
                  </div>
              </div>
            )}
            {/* ---------------------------------------------------------------- */}

          </div>
        )}
    </div>
    </SubscriptionGuard>
  );
}

export default App;