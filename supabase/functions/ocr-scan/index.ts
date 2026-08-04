import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ONSPACE_AI_KEY = Deno.env.get('ONSPACE_AI_API_KEY') ?? '';
const ONSPACE_AI_BASE_URL = Deno.env.get('ONSPACE_AI_BASE_URL') ?? '';

const PROMPTS: Record<string, string> = {
  notebook: `คุณเป็นระบบอ่านสมุดบันทึกการขาย กรุณาอ่านรูปภาพนี้และแยกข้อมูลออกมาเป็น JSON ตามโครงสร้างนี้:
{
  "date": "YYYY-MM-DD",
  "entries": [
    { "item_name": "ชื่อสินค้า", "quantity": 1, "unit_price": 0, "total_price": 0 }
  ],
  "daily_total": 0
}
กฎ:
- ถ้าอ่านไม่ออก ให้ใส่ "[ไม่ชัดเจน]" ในชื่อสินค้า
- ถ้าไม่มีวันที่ในภาพ ให้ date เป็น null
- ตัวเลขต้องเป็นตัวเลขล้วน ไม่มีเครื่องหมายคั่นพัน
- ตอบกลับเฉพาะ JSON เท่านั้น`,

  slip: `คุณเป็นระบบอ่านสลิปโอนเงิน กรุณาอ่านรูปภาพสลิปนี้และแยกข้อมูลออกมาเป็น JSON:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "amount": 0,
  "sender_name": "ชื่อผู้โอน",
  "sender_account": "เลขบัญชีผู้โอน",
  "reference_no": "เลขอ้างอิน"
}
กฎ:
- ถ้าไม่มีข้อมูลใด ให้เป็น null
- amount เป็นตัวเลขล้วน ไม่มีเครื่องหมายคั่นพัน
- ตอบกลับเฉพาะ JSON เท่านั้น`,

  bill: `คุณเป็นระบบอ่านบิล/ใบเสร็จ กรุณาอ่านรูปภาพนี้และแยกข้อมูลออกมาเป็น JSON:
{
  "date": "YYYY-MM-DD",
  "bill_number": "เลขที่บิล",
  "supplier_name": "ชื่อร้าน/บริษัทผู้ขาย",
  "items": [
    { "item_name": "ชื่อสินค้า", "quantity": 1, "unit_price": 0, "total_price": 0 }
  ],
  "total_amount": 0,
  "discount": 0,
  "tax_amount": 0,
  "net_amount": 0
}
กฎ:
- ถ้าไม่มีข้อมูลใด ให้เป็น null หรือ 0
- ตัวเลขต้องเป็นตัวเลขล้วน
- ตอบกลับเฉพาะ JSON เท่านั้น`
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId, imageUrl, ocrType = 'notebook', imageBase64 } = await req.json();

    if (!jobId || (!imageUrl && !imageBase64)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: jobId and imageUrl/imageBase64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update job to reviewing
    await supabaseAdmin.from('ocr_jobs').update({ status: 'reviewing' }).eq('id', jobId);

    const prompt = PROMPTS[ocrType] || PROMPTS.notebook;

    // Use imageBase64 if provided, else imageUrl
    const imageContent = imageBase64 || imageUrl;
    const isBase64 = imageContent.startsWith('data:');

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: isBase64 ? imageContent : imageUrl,
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ];

    console.log(`[OCR] Calling OnSpace AI for job ${jobId}, type: ${ocrType}`);

    const aiResponse = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ONSPACE_AI_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[OCR] AI API error:', errText);
      await supabaseAdmin.from('ocr_jobs').update({ status: 'pending', raw_text: `Error: ${errText}` }).eq('id', jobId);
      return new Response(
        JSON.stringify({ error: `OnSpace AI error: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.choices?.[0]?.message?.content ?? '';
    console.log('[OCR] Raw AI response:', rawText.substring(0, 200));

    // Parse JSON from response
    let parsedData: Record<string, unknown> = {};
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
      const jsonStr = jsonMatch[1]?.trim() || rawText.trim();
      parsedData = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[OCR] JSON parse error:', parseErr);
      // Try to extract JSON object directly
      const objMatch = rawText.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { parsedData = JSON.parse(objMatch[0]); } catch {}
      }
    }

    // Update OCR job with results
    const { error: updateError } = await supabaseAdmin.from('ocr_jobs').update({
      raw_text: rawText,
      parsed_data: parsedData,
      status: 'pending', // Keep pending for user review
    }).eq('id', jobId);

    if (updateError) {
      console.error('[OCR] Update job error:', updateError);
    }

    return new Response(
      JSON.stringify({ success: true, jobId, parsed_data: parsedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[OCR] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
