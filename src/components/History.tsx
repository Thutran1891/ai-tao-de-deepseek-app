import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Clock, Calendar, Trophy, ChevronLeft } from 'lucide-react';
import { Question } from '../types';
import { QuestionCard } from './QuestionCard';

interface HistoryItem {
  id: string;
  topic: string;
  score: number;
  total: number;
  date: any; 
  fullData?: string; // Dữ liệu bài thi đã lưu
}

interface Props {
  onBack: () => void;
}

export const History: React.FC<Props> = ({ onBack }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<Question[] | null>(null);

  // Tìm đến đoạn useEffect fetchHistory:
  useEffect(() => {
    const fetchHistory = async () => {
      if (!auth.currentUser) return;
      try {
        // --- [CODE MỚI - SỬA LẠI ĐOẠN NÀY] ---
        // 1. Trỏ vào đúng sub-collection của user đang đăng nhập
        const historyRef = collection(db, "users", auth.currentUser.uid, "examHistory");

        // 2. Query đơn giản hơn (không cần where userId nữa)
        const q = query(
          historyRef,
          orderBy("date", "desc")
        );
        // -------------------------------------

        const querySnapshot = await getDocs(q);
        // ... (phần xử lý data bên dưới giữ nguyên)
        const data: HistoryItem[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as HistoryItem);
        });
        setHistory(data);
      } catch (error) {
        console.error("Lỗi tải lịch sử:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // --- MÀN HÌNH CHI TIẾT BÀI THI ---
  if (selectedExam) {
      return (
        <div className="max-w-3xl mx-auto bg-slate-50 min-h-screen">
            <div className="sticky top-0 bg-white shadow-sm p-4 z-10 flex items-center gap-3 border-b">
                <button onClick={() => setSelectedExam(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ChevronLeft className="text-gray-600" />
                </button>
                <div>
                    <h2 className="font-bold text-lg text-gray-800">Chi tiết bài làm</h2>
                    <p className="text-xs text-gray-500">Xem lại đáp án và lời giải</p>
                </div>
            </div>
            <div className="p-4 space-y-6 pb-20">
                {selectedExam.map((q, idx) => (
                    // QuestionCard tự động chuyển sang chế độ "Xem lại" vì q.userAnswer đã có dữ liệu
                    <QuestionCard key={idx} index={idx} question={q} />
                ))}
            </div>
        </div>
      );
  }

  // --- MÀN HÌNH DANH SÁCH ---
  return (
    <div className="max-w-3xl mx-auto bg-white min-h-screen sm:min-h-0 sm:rounded-2xl shadow-xl border border-blue-100 flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Clock className="text-blue-600" /> Lịch sử làm bài
        </h2>
        <button onClick={onBack} className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1 rounded hover:bg-gray-100">
          Đóng
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto max-h-[80vh]">
        {loading ? (
          <div className="text-center py-10 text-gray-400">Đang tải dữ liệu...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-2">
              <Trophy size={40} className="text-gray-200" />
              <p>Bạn chưa làm bài thi nào.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => {
              const score10 = ((item.score / item.total) * 10).toFixed(1);
              const dateObj = item.date?.toDate ? item.date.toDate() : new Date();
              
              let scoreColor = "text-red-500";
              if (Number(score10) >= 8) scoreColor = "text-green-500";
              else if (Number(score10) >= 5) scoreColor = "text-yellow-600";

              return (
                <div 
                    key={item.id} 
                    onClick={() => {
                        if (item.fullData) {
                            try {
                                setSelectedExam(JSON.parse(item.fullData));
                            } catch (e) { alert("Dữ liệu bài thi bị lỗi."); }
                        } else {
                            alert("Bài thi cũ này chưa hỗ trợ xem lại chi tiết.");
                        }
                    }}
                    className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-300 group"
                >
                  <div className="flex justify-between items-center">
                      <div className="flex-1 pr-4">
                        <h3 className="font-bold text-gray-800 text-base mb-1 line-clamp-2 group-hover:text-blue-700 transition-colors">{item.topic}</h3>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                              <Calendar size={12}/> 
                              {dateObj.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1"><Trophy size={12}/> {item.score}/{item.total} câu đúng</span>

                        </div>
                      </div>
                      
                      <div className="text-right pl-4 border-l border-gray-100 min-w-[60px]">
                        <div className={`text-2xl font-black ${scoreColor}`}>{score10}</div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Điểm</div>
                      </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};