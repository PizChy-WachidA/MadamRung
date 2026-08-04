import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Upload, Loader2, Eye, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import { formatDateTime, getOCRStatusBadge, getOCRStatusLabel } from '@/lib/utils';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { OCRJob } from '@/types';

type ScanType = 'notebook' | 'slip' | 'bill';

export default function Scan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<ScanType>('notebook');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<OCRJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const fetchJobs = async () => {
    if (!user) return;
    setLoadingJobs(true);
    const { data } = await supabase
      .from('ocr_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setJobs((data || []) as OCRJob[]);
    setLoadingJobs(false);
  };

  useEffect(() => { fetchJobs(); }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error('ไฟล์ใหญ่เกิน 10MB'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleScanOCR = async () => {
    if (!file || !user || !preview) return;
    setUploading(true);

    // Upload image
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const bucket = selectedType === 'slip' ? 'bank-slips' : selectedType === 'bill' ? 'bill-images' : 'sales-images';
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
    if (uploadError) { toast.error('อัปโหลดรูปไม่สำเร็จ'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);

    // Create OCR job
    const { data: job, error: jobError } = await supabase
      .from('ocr_jobs')
      .insert({ user_id: user.id, image_url: publicUrl, ocr_type: selectedType, status: 'pending' })
      .select()
      .single();

    if (jobError || !job) { toast.error('สร้าง OCR job ไม่สำเร็จ'); setUploading(false); return; }

    // Call OCR edge function
    toast.loading('AI กำลังอ่านรูปภาพ...', { id: 'ocr' });
    const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('ocr-scan', {
      body: { jobId: job.id, imageUrl: publicUrl, ocrType: selectedType, imageBase64: preview },
    });

    if (ocrError) {
      let msg = ocrError.message;
      if (ocrError instanceof FunctionsHttpError) {
        try { msg = await ocrError.context.text(); } catch {}
      }
      toast.error(`OCR ล้มเหลว: ${msg}`, { id: 'ocr' });
      setUploading(false);
      return;
    }

    toast.success('AI อ่านรูปเสร็จแล้ว!', { id: 'ocr' });
    setUploading(false);
    setPreview(null);
    setFile(null);
    await fetchJobs();
    navigate(`/review/${job.id}`);
  };

  const handleDeleteJob = async (jobId: string) => {
    await supabase.from('ocr_jobs').delete().eq('id', jobId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    toast.success('ลบรายการแล้ว');
  };

  const typeLabels: Record<ScanType, string> = {
    notebook: 'สมุดขาย',
    slip: 'สลิปโอนเงิน',
    bill: 'บิลซื้อของ',
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="text-base font-semibold text-[#1a1a1a]">สแกน AI</h1>
        <p className="text-xs text-[#737373]">ถ่ายรูปหรืออัปโหลดเพื่อให้ AI อ่านข้อมูล</p>
      </div>

      <div className="page-content">
        {/* Type selector */}
        <div className="card-base">
          <p className="text-sm font-medium text-[#1a1a1a] mb-3">ประเภทที่ต้องการสแกน</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(typeLabels) as ScanType[]).map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`py-2.5 px-2 rounded-xl text-sm font-medium transition-colors border
                  ${selectedType === type
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                    : 'bg-white text-[#525252] border-[#e5e5e5] hover:bg-[#f5f5f5]'}`}
              >
                {typeLabels[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Upload area */}
        <div className="card-base">
          {preview ? (
            <div className="space-y-3">
              <div className="relative">
                <img src={preview} alt="preview" className="w-full max-h-64 object-contain rounded-lg border border-[#e5e5e5]" />
                <button
                  onClick={() => { setPreview(null); setFile(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-white border border-[#e5e5e5] rounded-full shadow-sm"
                >
                  <XCircle size={16} className="text-[#dc2626]" />
                </button>
              </div>
              <button onClick={handleScanOCR} disabled={uploading} className="btn-primary w-full">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {uploading ? 'AI กำลังอ่าน...' : `ให้ AI อ่าน${typeLabels[selectedType]}`}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#525252]">เลือกวิธีอัปโหลดรูป</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="btn-primary flex-col h-20 gap-2 text-sm"
                >
                  <Camera size={24} />
                  ถ่ายรูป
                </button>
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="btn-secondary flex-col h-20 gap-2 text-sm"
                >
                  <Upload size={24} />
                  อัปโหลด
                </button>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
              <input ref={galleryRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>
          )}
        </div>

        {/* Job list */}
        <div className="card-base">
          <p className="section-title mb-3">รายการรอตรวจสอบ</p>
          {loadingJobs ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-[#f5f5f5] rounded-lg animate-pulse" />)}
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-[#a3a3a3] text-center py-6">ยังไม่มีรายการสแกน</p>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#f5f5f5] hover:bg-[#fafafa]">
                  <img
                    src={job.image_url}
                    alt=""
                    className="w-12 h-12 object-cover rounded-lg border border-[#e5e5e5] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={getOCRStatusBadge(job.status)}>{getOCRStatusLabel(job.status)}</span>
                      <span className="text-xs text-[#a3a3a3]">
                        {job.ocr_type === 'notebook' ? 'สมุด' : job.ocr_type === 'slip' ? 'สลิป' : 'บิล'}
                      </span>
                    </div>
                    <p className="text-xs text-[#737373] truncate">{formatDateTime(job.created_at)}</p>
                  </div>
                  <div className="flex gap-1">
                    {job.status === 'pending' && (
                      <button
                        onClick={() => navigate(`/review/${job.id}`)}
                        className="p-2 rounded-lg hover:bg-[#f5f5f5] text-[#2563eb]"
                        title="ตรวจสอบ"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-[#dc2626]"
                      title="ลบ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
