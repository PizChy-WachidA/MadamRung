import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center p-8">
        <div className="text-6xl font-bold text-[#1a1a1a] mb-4">404</div>
        <p className="text-xl font-medium text-[#525252] mb-2">ไม่พบหน้าที่ต้องการ</p>
        <p className="text-sm text-[#737373] mb-6">หน้า "{location.pathname}" ไม่มีในระบบ</p>
        <a
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-[#1a1a1a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#2d2d2d] transition-colors"
        >
          กลับหน้าหลัก
        </a>
      </div>
    </div>
  );
};

export default NotFound;
