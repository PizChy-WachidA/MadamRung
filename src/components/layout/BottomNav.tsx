import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ScanLine, PenLine, BarChart2,
  Settings, Wallet, ShoppingCart, ChevronUp, X, FileText
} from 'lucide-react';

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

const mainItems: NavItem[] = [
  { path: '/', icon: <LayoutDashboard size={22} />, label: 'ภาพรวม' },
  { path: '/scan', icon: <ScanLine size={22} />, label: 'สแกน' },
  { path: '/entry', icon: <PenLine size={22} />, label: 'กรอกขาย' },
  { path: '/reports', icon: <BarChart2 size={22} />, label: 'รายงาน' },
  { path: '/settings', icon: <Settings size={22} />, label: 'ตั้งค่า' },
];

const transactionItems: NavItem[] = [
  { path: '/entry', icon: <PenLine size={20} />, label: 'กรอกขาย' },
  { path: '/bank-income', icon: <Wallet size={20} />, label: 'รับโอน' },
  { path: '/purchase-bills', icon: <ShoppingCart size={20} />, label: 'บิลซื้อ' },
  { path: '/loan', icon: <FileText size={20} />, label: 'เอกสารกู้' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isTransactionActive = ['/bank-income', '/purchase-bills', '/loan'].includes(location.pathname);

  const handleNav = (path: string) => {
    setShowMore(false);
    navigate(path);
  };

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More menu flyout */}
      {showMore && (
        <div className="fixed bottom-[65px] left-1/2 -translate-x-1/2 z-50
          bg-white border border-[#e5e5e5] rounded-2xl shadow-lg w-72 p-2">
          <div className="flex items-center justify-between px-3 py-2 mb-1">
            <span className="text-sm font-semibold text-[#1a1a1a]">ธุรกรรม</span>
            <button onClick={() => setShowMore(false)} className="p-1 rounded-full hover:bg-[#f5f5f5]">
              <X size={16} className="text-[#737373]" />
            </button>
          </div>
          {transactionItems.map(item => (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors
                ${isActive(item.path) ? 'bg-[#f5f5f5] text-[#1a1a1a]' : 'text-[#525252] hover:bg-[#f5f5f5]'}`}
            >
              <span className={isActive(item.path) ? 'text-[#1a1a1a]' : 'text-[#737373]'}>
                {item.icon}
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#e5e5e5]">
        <div className="flex items-stretch max-w-lg mx-auto">
          {/* ภาพรวม */}
          <button
            onClick={() => handleNav('/')}
            className={`bottom-nav-item ${isActive('/') ? 'active' : ''}`}
          >
            <LayoutDashboard size={22} />
            <span className="text-[10px] font-medium">ภาพรวม</span>
          </button>

          {/* สแกน */}
          <button
            onClick={() => handleNav('/scan')}
            className={`bottom-nav-item ${isActive('/scan') ? 'active' : ''}`}
          >
            <ScanLine size={22} />
            <span className="text-[10px] font-medium">สแกน</span>
          </button>

          {/* ธุรกรรม - center, prominent */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`bottom-nav-item relative ${isTransactionActive || showMore ? 'active' : ''}`}
          >
            <div className={`p-2 rounded-full transition-colors ${showMore || isTransactionActive ? 'bg-[#1a1a1a]' : 'bg-[#f5f5f5]'}`}>
              {showMore
                ? <X size={18} className="text-white" />
                : <PenLine size={18} className={isTransactionActive ? 'text-white' : 'text-[#525252]'} />
              }
            </div>
            <span className="text-[10px] font-medium">ธุรกรรม</span>
          </button>

          {/* รายงาน */}
          <button
            onClick={() => handleNav('/reports')}
            className={`bottom-nav-item ${isActive('/reports') ? 'active' : ''}`}
          >
            <BarChart2 size={22} />
            <span className="text-[10px] font-medium">รายงาน</span>
          </button>

          {/* ตั้งค่า */}
          <button
            onClick={() => handleNav('/settings')}
            className={`bottom-nav-item ${isActive('/settings') ? 'active' : ''}`}
          >
            <Settings size={22} />
            <span className="text-[10px] font-medium">ตั้งค่า</span>
          </button>
        </div>
      </nav>
    </>
  );
}
