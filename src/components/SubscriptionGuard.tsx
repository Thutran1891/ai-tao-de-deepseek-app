import React, { useEffect, useState, createContext, useContext } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserSubscription } from '../types';
import { Lock, CheckCircle } from 'lucide-react';

// 1. TẠO CONTEXT ĐỂ CHIA SẺ DỮ LIỆU BẢN QUYỀN
interface SubContextType {
  isPremium: boolean;
  daysLeft: number;
}
const SubscriptionContext = createContext<SubContextType>({ isPremium: false, daysLeft: 0 });

// Hook để các component con (như QuizInput) gọi lấy dữ liệu
export const useSubscription = () => useContext(SubscriptionContext);

interface Props {
  children: React.ReactNode;
}

export const SubscriptionGuard: React.FC<Props> = ({ children }) => {
  const [subStatus, setSubStatus] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    const checkSubscription = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      let userData: UserSubscription;

      if (userSnap.exists()) {
        userData = userSnap.data() as UserSubscription;
      } else {
        userData = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "Bạn",
          startDate: serverTimestamp(),
          isPremium: false
        };
        await setDoc(userRef, userData);
      }

      setSubStatus(userData);

      const start = userData.startDate?.toDate ? userData.startDate.toDate() : new Date();
      const now = new Date();
      
      if (userData.isPremium && userData.expiryDate) {
          const expiry = userData.expiryDate.toDate();
          const diffTime = expiry.getTime() - now.getTime();
          setDaysLeft(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      } else {
          const trialEnd = new Date(start);
          trialEnd.setDate(trialEnd.getDate() + 30);
          const diffTime = trialEnd.getTime() - now.getTime();
          setDaysLeft(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }
      
      setLoading(false);
    };

    checkSubscription();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Đang kiểm tra bản quyền...</div>;

  const isExpired = !subStatus?.isPremium && daysLeft <= 0;

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="mb-4 flex justify-center">
            <div className="bg-red-100 p-4 rounded-full">
                <Lock className="w-10 h-10 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Hết hạn dùng thử</h2>
          <p className="text-gray-600 mb-6">
            Bạn đã hết 30 ngày miễn phí. Vui lòng gia hạn để tiếp tục sử dụng.
          </p>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 text-left">
            <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><CheckCircle size={16}/> Gói Học Sinh</h3>
            <ul className="text-sm text-blue-700 space-y-1 ml-6 list-disc">
                <li>Tạo đề thi không giới hạn</li>
                <li>Giải chi tiết + Vẽ hình 3D</li>
                <li>Lưu lịch sử làm bài</li>
            </ul>
            <div className="mt-3 text-center text-2xl font-black text-blue-600">
                20.000đ <span className="text-sm font-normal text-gray-500">/ năm</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-gray-500">
                Chuyển khoản với nội dung: <br/>
                <span className="font-mono font-bold text-black bg-gray-200 px-2 py-1 rounded select-all">MG {auth.currentUser?.email?.split('@')[0]}</span>
            </div>
            {/* THAY THÔNG TIN TÀI KHOẢN CỦA BẠN VÀO ĐÂY */}
            <img 
                src={`https://img.vietqr.io/image/MB-0912345678-compact2.jpg?amount=20000&addInfo=MG ${auth.currentUser?.email?.split('@')[0]}&accountName=NGUYEN VAN A`} 
                alt="QR Payment" 
                className="mx-auto w-48 rounded-lg border"
            />
            <p className="text-xs text-gray-400 mt-2">
                Liên hệ Admin để kích hoạt sau khi chuyển khoản.
            </p>
          </div>
          
          <button onClick={() => auth.signOut()} className="mt-6 text-gray-500 hover:underline text-sm">
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  // 2. CUNG CẤP DỮ LIỆU CHO CON (QUIZ INPUT)
  return (
    <SubscriptionContext.Provider value={{ isPremium: !!subStatus?.isPremium, daysLeft }}>
      {children}
    </SubscriptionContext.Provider>
  );
};