import React, { useState, useMemo, useEffect } from 'react';
import { QuizConfig } from '../types';
// import { Sparkles, KeyRound, LogOut, Clock } from 'lucide-react';
import { auth } from '../firebase'; // Import auth
import { useSubscription } from './SubscriptionGuard'; // Import Hook lấy ngày
// --------------------------------------THÊM LÝ THUYẾT
import { Sparkles, KeyRound, LogOut, Clock, BookOpen, X } from 'lucide-react'; // Thêm BookOpen, X
import { generateTheoryWithDeepSeek } from '../deepseekService'; // ĐỔI TÊN: thay generateTheory bằng generateTheoryWithDeepSeek
import { LatexText } from './LatexText'; // Để hiển thị công thức toán

// ----------------------------------
interface Props {
  // Hàm callback nhận thêm apiKey
  onGenerate: (config: QuizConfig, apiKey: string) => void;
  isLoading: boolean;
}

export const QuizInput: React.FC<Props> = ({ onGenerate, isLoading }) => {
  const [topic, setTopic] = useState('');
  const [prompt, setPrompt] = useState('');
  
  // --- STATE CHO API KEY ---
  const [apiKey, setApiKey] = useState('');
  const [saveKey, setSaveKey] = useState(true);
  // -----------------THÊM LÝ THUYẾT
  // ... bên trong component QuizInput
  const [showTheoryModal, setShowTheoryModal] = useState(false);
  const [theoryContent, setTheoryContent] = useState('');
  const [loadingTheory, setLoadingTheory] = useState(false);
  // -------------------------------------

  // Lấy thông tin ngày còn lại từ SubscriptionGuard (MỚI THÊM)
  const { daysLeft, isPremium } = useSubscription();

  // Load Key từ LocalStorage khi mở app - ĐỔI TÊN KEY
  useEffect(() => {
    const saved = localStorage.getItem('user_deepseek_key'); // ĐỔI: user_gemini_key -> user_deepseek_key
    if (saved) setApiKey(saved);
  }, []);

  const [matrix, setMatrix] = useState({
    TN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
    TLN: { BIET: 0, HIEU: 0, VANDUNG: 0 },
    DS: { BIET: 0, HIEU: 0, VANDUNG: 0 },
  });

  // Tính tổng số câu hỏi theo thời gian thực
  const totalQuestions = useMemo(() => {
    let total = 0;
    Object.values(matrix).forEach(type => {
      total += (type.BIET || 0) + (type.HIEU || 0) + (type.VANDUNG || 0);
    });
    return total;
  }, [matrix]);

  const handleChange = (type: 'TN'|'TLN'|'DS', level: 'BIET'|'HIEU'|'VANDUNG', val: string) => {
    const num = parseInt(val) || 0;
    setMatrix(prev => ({
      ...prev,
      [type]: { ...prev[type], [level]: num }
    }));
  };
  // =====Thêm lý thuyết
  const handleOpenTheory = async () => {
    if (!topic) return alert("Vui lòng nhập chủ đề trước!");
    if (!apiKey) return alert("Cần có API Key để tải lý thuyết!");

    setShowTheoryModal(true);

    // Nếu đã có nội dung rồi thì không load lại để tiết kiệm token
    if (theoryContent) return;

    setLoadingTheory(true);
    try {
        const content = await generateTheoryWithDeepSeek(topic, apiKey); // ĐỔI: generateTheory -> generateTheoryWithDeepSeek
        setTheoryContent(content);
    } catch (e) {
        alert("Lỗi tải lý thuyết");
        setShowTheoryModal(false);
    } finally {
        setLoadingTheory(false);
    }
  };
  // -----------------------------
  const handleSubmit = () => {
    // Validate Key
    if (!apiKey.trim()) return alert("Vui lòng nhập API Key để tiếp tục!");
    if (!topic) return alert("Vui lòng nhập chủ đề!");
    if (totalQuestions === 0) return alert("Vui lòng nhập số lượng câu hỏi ít nhất là 1!");
    
    // Lưu Key nếu người dùng chọn
    if (saveKey) localStorage.setItem('user_deepseek_key', apiKey); // ĐỔI: user_gemini_key -> user_deepseek_key
    else localStorage.removeItem('user_deepseek_key'); // ĐỔI: user_gemini_key -> user_deepseek_key

    // Gửi Key kèm config
    onGenerate({ topic, distribution: matrix, additionalPrompt: prompt }, apiKey);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-blue-100 relative">
      
      {/* Nút Đăng xuất */}
      <button onClick={() => auth.signOut()} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 text-xs flex items-center gap-1 font-bold">
        <LogOut size={14}/> Thoát
      </button>

      {/* ... code cũ ở trên ... */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">AI TẠO ĐỀ</h1>
        <p className="text-gray-500 mb-2">Cô Thu mến chào, {auth.currentUser?.displayName}!</p>
        
        {/* --- [CODE ĐÃ SỬA MÀU] --- */}
        {/* bg-yellow-100: Nền vàng nhạt */}
        {/* border-yellow-300: Viền vàng đậm hơn chút cho rõ nét */}
        <div className="inline-block bg-yellow-100 px-6 py-2 rounded-xl border border-yellow-300 shadow-sm">
            {/* text-violet-700: Chữ màu tím Violet đậm */}
            <p className="text-violet-700 font-bold text-base">
                Giáo viên: Trần Thị Kim Thu
            </p>
            {/* text-violet-600: Chữ màu tím Violet nhạt hơn chút */}
            <p className="text-violet-600 text-xs font-bold uppercase tracking-wider mt-1">
                Trường THPT Cây Dương
            </p>
        </div>
        {/* ------------------------- */}
      </div>
      {/* --- KHU VỰC NHẬP API KEY --- */}
      <div className="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="flex justify-between items-center mb-2">
          {/* ĐỔI LABEL: Gemini API Key -> DeepSeek API Key */}
          <label className="text-sm font-bold text-yellow-800 flex items-center gap-2">
                <KeyRound size={18}/> DeepSeek API Key
            </label>
            {/* ĐỔI LINK: https://aistudio.google.com/app/apikey -> https://platform.deepseek.com/api_keys */}
            <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                Dán Key tại đây
            </a>
        </div>
        <input 
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Dán mã Key bắt đầu bằng sk-..."  // ĐỔI: "AIza..." -> "sk-..."
          className="w-full p-3 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white"
        />
        <div className="mt-2 flex items-center gap-2">
            <input 
                type="checkbox" id="saveKey" 
                checked={saveKey} onChange={(e) => setSaveKey(e.target.checked)} 
                className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="saveKey" className="text-xs text-gray-600 cursor-pointer select-none">
                Lưu Key trên máy này cho lần sau
            </label>
        </div>
      </div>
      {/* --------------------------- */}

      <div className="mb-6">
    <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề môn học</label>
    <div className="flex gap-2">
        <input 
          value={topic}
          onChange={(e) => {
              setTopic(e.target.value);
              setTheoryContent(''); // Reset lý thuyết khi đổi chủ đề
          }}
          placeholder="Ví dụ: Hàm số bậc 3, Tích phân..." 
          className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
        />

        {/* NÚT LÝ THUYẾT MỚI */}
        <button 
            onClick={handleOpenTheory}
            className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 whitespace-nowrap"
            title="Xem công thức & Lý thuyết"
        >
            <BookOpen size={20} /> Lý thuyết
        </button>
        </div>
      </div>
      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
          <label className="block text-sm font-medium text-gray-700">Cấu trúc đề thi</label>
          {/* Thêm dòng chú thích nhỏ */}
          <span className="text-xs text-red-500 italic mr-2">(Khuyên dùng: &lt; 10 câu để AI chạy tốt nhất)</span>
          <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
            Tổng cộng: {totalQuestions} câu
          </span>
        </div>
        
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div className="font-bold text-gray-400 self-end pb-2">Loại \ Mức</div>
          <div className="font-semibold text-green-600 bg-green-50 py-2 rounded">Biết</div>
          <div className="font-semibold text-blue-600 bg-blue-50 py-2 rounded">Hiểu</div>
          <div className="font-semibold text-purple-600 bg-purple-50 py-2 rounded">Vận dụng</div>

          {/* Dòng Trắc nghiệm */}
          <div className="flex items-center justify-center font-bold bg-gray-50 rounded">TN (4 chọn 1)</div>
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TN', 'BIET', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TN', 'HIEU', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TN', 'VANDUNG', e.target.value)} />

          {/* Dòng Tự luận số */}
          <div className="flex items-center justify-center font-bold bg-gray-50 rounded">TLN (Điền số)</div>
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TLN', 'BIET', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TLN', 'HIEU', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('TLN', 'VANDUNG', e.target.value)} />

          {/* Dòng Đúng Sai */}
          <div className="flex items-center justify-center font-bold bg-gray-50 rounded">ĐS (Đúng/Sai)</div>
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('DS', 'BIET', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('DS', 'HIEU', e.target.value)} />
          <input type="number" min="0" className="p-2 border rounded text-center" onChange={e => handleChange('DS', 'VANDUNG', e.target.value)} />
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-1">Yêu cầu bổ sung (Optional)</label>
        <textarea 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ví dụ: Câu mức vận dụng nên tạo bài toán thực tế..." 
          className="w-full p-3 border rounded-lg h-24 resize-none focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      <button 
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70"
      >
        {isLoading ? (
          <>Đang tạo {totalQuestions} câu hỏi...</>
        ) : (
          <><Sparkles /> TẠO ĐỀ NGAY ({totalQuestions} CÂU)</>
        )}
      </button>

      {/* --- PHẦN HIỂN THỊ SỐ NGÀY CÒN LẠI (MỚI THÊM) --- */}
      <div className="mt-6 text-center border-t pt-4">
        {isPremium ? (
            <div className="text-sm font-bold text-green-600 flex items-center justify-center gap-1">
                <Sparkles size={16} /> Tài khoản VIP (Không giới hạn)
            </div>
        ) : (
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <Clock size={14} /> 
                Bạn còn <b className="text-blue-600">{daysLeft} ngày</b> dùng thử miễn phí.
            </div>
        )}
      </div>

    {/* --- MODAL LÝ THUYẾT --- */}
    {showTheoryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-3xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col relative">

                {/* Header Modal */}
                <div className="p-4 border-b flex justify-between items-center bg-orange-50 rounded-t-2xl">
                    <h3 className="text-xl font-bold text-orange-800 flex items-center gap-2">
                        <BookOpen size={24}/> KIẾN THỨC TRỌNG TÂM: {topic}
                    </h3>
                    <button onClick={() => setShowTheoryModal(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X size={28} />
                    </button>
                </div>

                {/* Content Modal */}
                <div className="p-6 overflow-y-auto flex-1 text-gray-800 leading-relaxed text-base">
                    {loadingTheory ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-4">
                            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-500 animate-pulse">Đang tổng hợp công thức...</p>
                        </div>
                    ) : (
                        // Sử dụng LatexText để hiển thị đẹp cả Markdown và Toán
                        <div className="whitespace-pre-wrap">
                            <LatexText text={theoryContent} />
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="p-4 border-t bg-gray-50 rounded-b-2xl text-right">
                    <button 
                        onClick={() => setShowTheoryModal(false)}
                        className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
      )}      
      {/* --------------------------------------- */}
    </div>
  );
};