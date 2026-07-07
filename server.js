/* ============================================================
   Pronunciation Scoring API
   รับไฟล์เสียงที่ผู้เรียนอัดไว้ ส่งให้ OpenAI ถอดเสียง (Whisper)
   แล้วให้โมเดลภาษาให้คะแนนความถูกต้องเทียบกับคำศัพท์เป้าหมาย
============================================================ */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");
const { toFile } = require("openai");

const PORT = process.env.PORT || 3001;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB พอสำหรับคลิปเสียงไม่กี่วินาที
});

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "[server] ไม่พบ OPENAI_API_KEY ใน environment — ตั้งค่าในไฟล์ .env ก่อนใช้งานฟีเจอร์ให้คะแนนเสียง",
  );
}

// สร้าง client แบบ lazy ไว้ป้องกัน SDK โยน error ตอนเซิร์ฟเวอร์เริ่มทำงานเมื่อยังไม่มีคีย์
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const app = express();
app.use(cors());

app.post("/api/pronunciation-score", upload.single("audio"), async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า OPENAI_API_KEY" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "ไม่พบไฟล์เสียงที่อัปโหลด" });
    }

    const { zh, py, th } = req.body;
    if (!zh) {
      return res.status(400).json({ error: "ไม่พบคำศัพท์เป้าหมาย (zh)" });
    }

    // ขั้นที่ 1: ให้ Whisper ถอดเสียงที่ผู้เรียนอัดมาโดยตรง
    const audioFile = await toFile(req.file.buffer, "recording.webm", {
      type: req.file.mimetype || "audio/webm",
    });
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "zh",
    });
    const heardText = transcription.text?.trim() || "";

    // ขั้นที่ 2: ให้โมเดลภาษาเทียบคำที่ถอดเสียงได้กับคำเป้าหมาย แล้วให้คะแนน+คำแนะนำ
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "คุณเป็นครูสอนภาษาจีนที่ประเมินการออกเสียงของผู้เรียนชาวไทย " +
            "ตอบกลับเป็น JSON เท่านั้นตามรูปแบบ {\"score\": number (0-100), \"feedback\": string (ภาษาไทย สั้นกระชับ ไม่เกิน 2 ประโยค)}",
        },
        {
          role: "user",
          content:
            `คำศัพท์เป้าหมาย: "${zh}" พินอิน: "${py || "-"}" แปลว่า: "${th || "-"}"\n` +
            `ระบบถอดเสียงที่ผู้เรียนพูดออกมาได้ว่า: "${heardText || "(ไม่สามารถถอดเสียงได้)"}"\n` +
            "ให้คะแนนความถูกต้องของการออกเสียงโดยเทียบกับคำเป้าหมาย และให้คำแนะนำสั้นๆ",
        },
      ],
    });

    const result = JSON.parse(completion.choices[0].message.content);

    res.json({
      score: Math.max(0, Math.min(100, Math.round(result.score))),
      feedback: result.feedback,
      heard: heardText,
    });
  } catch (err) {
    console.error("[pronunciation-score] error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดระหว่างวิเคราะห์เสียง กรุณาลองใหม่" });
  }
});

app.listen(PORT, () => {
  console.log(`[server] Pronunciation scoring API listening on http://localhost:${PORT}`);
});
