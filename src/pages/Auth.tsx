import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ShoppingBag, Eye, EyeOff, KeyRound, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, mapSupabaseUser } from '@/hooks/useAuth';

// Phone number → internal email mapping (single-user app)
const PHONE_NUMBER = '0813830622';
const DISPLAY_PHONE = '081-383-0622';
// Map phone to internal email for Supabase auth
function phoneToEmail(phone: string): string {
  return `${phone.replace(/-/g, '')}@madamrung.shop`;
}
const INTERNAL_EMAIL = phoneToEmail(PHONE_NUMBER);

type AuthStep = 'password' | 'setup_otp_email' | 'setup_otp' | 'setup_password';

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<AuthStep>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // For first-time setup
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);

  // Main login with phone + password
  const handleLogin = async () => {
    if (!password.trim()) { toast.error('กรุณากรอกรหัสผ่าน'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: INTERNAL_EMAIL,
      password,
    });
    if (error) {
      toast.error('รหัสผ่านไม่ถูกต้อง หรือยังไม่ได้ตั้งรหัสผ่าน');
      setLoading(false);
      return;
    }
    if (data.user) {
      login(mapSupabaseUser(data.user));
      navigate('/');
    }
  };

  // First-time setup: send OTP to recovery email
  const handleSendSetupOTP = async () => {
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      toast.error('กรุณากรอกอีเมลสำรองที่ถูกต้อง');
      return;
    }
    setLoading(true);
    // Try to create/login the internal account via OTP
    const { error } = await supabase.auth.signInWithOtp({
      email: INTERNAL_EMAIL,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`ส่งรหัส OTP ไปยัง ${INTERNAL_EMAIL} แล้ว`);
    setStep('setup_otp');
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) { toast.error('กรุณากรอกรหัส OTP'); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: INTERNAL_EMAIL,
      token: otp.trim(),
      type: 'email',
    });
    setLoading(false);
    if (error) { toast.error('รหัส OTP ไม่ถูกต้อง หรือหมดอายุแล้ว'); return; }
    toast.success('ยืนยัน OTP แล้ว');
    setStep('setup_password');
  };

  const handleSetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data.user) {
      login(mapSupabaseUser(data.user));
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[#1a1a1a]">ร้านมาดามรุ่ง</h1>
        <p className="text-sm text-[#737373] mt-1">ระบบบัญชีร้านกระเป๋าหนังแท้</p>
      </div>

      <div className="w-full max-w-sm bg-white border border-[#e5e5e5] rounded-2xl p-6 shadow-sm">

        {/* Step 1: Main login */}
        {step === 'password' && (
          <>
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-1">เข้าสู่ระบบ</h2>
            <p className="text-sm text-[#737373] mb-5">สำหรับ นางสาวรุ่ง หังษาบุตร เท่านั้น</p>

            {/* Phone display (non-editable) */}
            <div className="mb-4 p-3 bg-[#f5f5f5] rounded-xl flex items-center gap-3">
              <Phone size={18} className="text-[#737373] flex-shrink-0" />
              <div>
                <p className="text-xs text-[#737373]">เบอร์มือถือ</p>
                <p className="text-base font-bold text-[#1a1a1a] tracking-wide">{DISPLAY_PHONE}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-base">รหัสผ่าน</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="กรอกรหัสผ่าน"
                    className="input-base pl-10 pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button onClick={handleLogin} disabled={loading} className="btn-primary w-full">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                เข้าสู่ระบบ
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-[#e5e5e5] text-center">
              <p className="text-sm text-[#737373] mb-2">ครั้งแรก หรือลืมรหัสผ่าน?</p>
              <button
                onClick={() => setStep('setup_otp_email')}
                className="text-sm font-medium text-[#2563eb] hover:underline"
              >
                ตั้งรหัสผ่านใหม่
              </button>
            </div>
          </>
        )}

        {/* Step 2a: Enter recovery email for OTP */}
        {step === 'setup_otp_email' && (
          <>
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">ตั้งรหัสผ่าน</h2>
            <p className="text-sm text-[#737373] mb-5">
              ระบบจะส่งรหัส OTP ไปยังอีเมลของระบบ กดปุ่มด้านล่างเพื่อรับรหัส
            </p>

            <div className="mb-4 p-3 bg-[#f5f5f5] rounded-xl">
              <p className="text-xs text-[#737373]">OTP จะส่งไปยัง</p>
              <p className="text-sm font-medium text-[#1a1a1a] break-all">{INTERNAL_EMAIL}</p>
            </div>

            <div className="space-y-3">
              <button onClick={handleSendSetupOTP} disabled={loading} className="btn-primary w-full">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                ส่งรหัส OTP
              </button>
              <button onClick={() => setStep('password')} className="btn-secondary w-full">ย้อนกลับ</button>
            </div>
          </>
        )}

        {/* Step 2b: Enter OTP */}
        {step === 'setup_otp' && (
          <>
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">กรอกรหัส OTP</h2>
            <p className="text-sm text-[#737373] mb-5">
              กรอกรหัส OTP ที่ได้รับจากอีเมล <strong className="break-all">{INTERNAL_EMAIL}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="label-base">รหัส OTP</label>
                <input
                  type="text" value={otp} maxLength={6}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
                  placeholder="รหัส OTP"
                  className="input-base text-center text-2xl font-bold tracking-[0.5em]"
                  autoFocus
                />
              </div>
              <button onClick={handleVerifyOTP} disabled={loading} className="btn-primary w-full">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                ยืนยัน OTP
              </button>
              <button onClick={() => { setStep('setup_otp_email'); setOtp(''); }} className="btn-secondary w-full text-sm">
                ย้อนกลับ
              </button>
            </div>
          </>
        )}

        {/* Step 3: Set new password */}
        {step === 'setup_password' && (
          <>
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">ตั้งรหัสผ่านใหม่</h2>
            <p className="text-sm text-[#737373] mb-5">กรอกรหัสผ่านสำหรับใช้เข้าสู่ระบบ</p>
            <div className="space-y-4">
              <div>
                <label className="label-base">รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'} value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                    placeholder="ตั้งรหัสผ่านใหม่"
                    className="input-base pr-10"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]">
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button onClick={handleSetPassword} disabled={loading} className="btn-primary w-full">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                บันทึกรหัสผ่านและเข้าสู่ระบบ
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-[#a3a3a3] mt-6 text-center">
        ร้านกระเป๋าหนังแท้ มาดามรุ่ง · เบอร์ {DISPLAY_PHONE}
      </p>
    </div>
  );
}
