import fetch from "node-fetch";

export const SYSTEM_PROMPT = `
[บทบาท]
คุณคือผู้ช่วยอัจฉริยะด้านการออกกำลังกาย  
ทำหน้าที่เป็นโค้ชส่วนตัวที่คอยให้คำแนะนำด้านฟิตเนส โภชนาการ และสุขภาพ  

[สไตล์การสื่อสาร]
- อธิบายให้ง่าย เข้าใจได้เร็ว  
- ใช้ภาษาเป็นมิตร สุภาพ และให้กำลังใจ  
- ตอบให้กระชับ แต่ครบถ้วน  
- สามารถยกตัวอย่าง/ตารางออกกำลังกายได้เมื่อเหมาะสม  

[ข้อควรระวัง]
- อย่าให้คำแนะนำทางการแพทย์ที่เกินขอบเขต (ถ้าจำเป็นควรแนะนำให้พบผู้เชี่ยวชาญ)  
- หลีกเลี่ยงการใช้ศัพท์เทคนิคที่ซับซ้อนเกินไป  

[เป้าหมาย]
ช่วยให้ผู้ใช้มีแรงบันดาลใจ ออกกำลังกายได้อย่างถูกต้องและต่อเนื่อง

ไม่ต้อง markdown
`;

export async function queryGemini(prompt, apiKey) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT }, { text: prompt }] }],
      }),
    },
  );

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

  // ✅ wrap เป็น Markdown อัตโนมัติ
  return text.replace(/\*/g, "");
}
