---
name: sati-3d-engine
description: คู่มือปฏิบัติการ (Runbook) สำหรับพัฒนา สร้างโมเดล 3D Low-Poly (.glb) รันเซิร์ฟเวอร์ Vite + Gemini Interactions API Proxy และตรวจสอบระบบของโปรเจกต์ SATI (สำรับแห่งสติ)
---

# SATI 3D Low-Poly Tarot & Thaksa Engine Skill

สกิลเฉพาะทางประจำโปรเจกต์ `sati-project` สำหรับดูแลสถาปัตยกรรม Web 3D Game (Vite + Three.js + GLTFLoader), ตัวสร้างโมเดล `.glb` สไตล์ Flat-Shaded Low-Poly และระบบหลังบ้าน Gemini Interactions API (`gemini-3.8-flash`)

## 1. โครงสร้างโปรเจกต์ (Project Architecture)

- `public/models/` — เก็บไฟล์โมเดล 3D Binary glTF 2.0 (`.glb`) ที่คอมไพล์จากสคริปต์ (พร้อม Per-Triangle `COLOR_0` + `TEXCOORD_0`):
  - `sanctuary_room.glb` (กระโจมหมอดูไม้แปดเหลี่ยม ม่านเบอร์กันดีผูกทอง พรมแขวนผนัง 3 ผืน ชั้นโต๊ะขวดโพชัน เทียน และลูกแก้วสีรุ้งขาตั้ง 3 ขาซ้าย-ขวา)
  - `divination_table.glb` (โต๊ะแปดเหลี่ยมไม้แกะสลักปูผ้ากำมะหยี่เบอร์กันดีขอบทองพร้อมพู่ห้อยมุมโต๊ะ และเชิงเทียนทองเหลือง)
  - `sati_archmage.glb` (หมอดูสติชุดคลุมเบอร์กันดี-พลัมปักลายดวงดาวพระจันทร์ ผ้าโพกศีรษะอัญมณีเรืองแสง เคราเงิน 11 ช่อ ผ้าคลุมไหล่และผ้าคลุมหลังสีม่วง แยก Node `SatiHead`, `SatiLeftArm`, `SatiRightArm`, `SatiTorso`)
  - `sati_custom.glb` (โมเดลสติฉบับปั้นด้วย Blender 5.3 จากสคริปต์ `.agents/skills/sati-3d-engine/scripts/build_sati_blender.py`: มีโครงกระดูก `SatiBlenderRig`, ShapeKeys ปากพูด-กะพริบตา `MouthOpen`/`Blink`, คลิป `Idle`/`Shuffle`/`Thinking`/`Talk`, ลูกแก้วบนฝ่ามือ `SatiPalmOrb` และไพ่สับกลางอากาศ `SatiShuffleCards` — หากมีไฟล์นี้เอนจินจะโหลดมาแสดงผลแทน `sati_archmage.glb`)
  - `player_hands.glb` (มือซ้ายและมือขวาของผู้เล่นสวมกำไลทองและแหวนมรกต/ทับทิม แยก Node `PlayerLeftHand`, `PlayerRightHand`)
- `src/scene/proceduralTextures.js` — ตัวสร้าง `CanvasTexture` สำหรับลายปักเสื้อคลุม (`RobeEmbroidered`), ผ้ากำมะหยี่ปูโต๊ะ (`TableVelvet`), พรมแขวนผนัง 3 ลาย (`Tapestry*`) และผนังกระโจม (`TentWalls`)
- `src/data/tarot78.js` — ข้อมูลไพ่ทาโรต์ Rider-Waite 78 ใบ และระบบวาดหน้าไพ่/หลังไพ่ Low-Poly เฉพาะตัวครบทั้ง 78 ใบ
- `src/engine/satiBrain.js` — ระบบคำนวณทักษาปกรณ์ไทย (ชื่อจริง-นามสกุล + ชื่อเล่น + วันเกิด พ.ศ.) และระบบสังเคราะห์คำตอบเตือนสติ (รองรับทั้ง Gemini API Proxy และ Offline Fallback)
- `src/engine/storage.js` — ระบบบันทึกสถานะผูกกับ Gmail (LocalStorage + Backend JSON/SQLite sync) เก็บ `remainingDeck`, `natalCards`, `coins`, `hasDeckPass`, `chatHistory`
- `src/scene/satiScene3D.js` — เอนจิน 3D Three.js + `GLTFLoader` + `RoomEnvironment` IBL + `EffectComposer` (`UnrealBloomPass` + `OutputPass`) + 2048x2048 `PCFSoftShadow` + ระบบสลับมือซ้าย (`x < 0`) และมือขวา (`x >= 0`)
- `src/main.js` & `index.html` — ระบบควบคุมลูปเกม 4 ขั้นตอนและ UI `<dialog>` มาตรฐาน
- `backend/geminiProxyServer.js` — เซิร์ฟเวอร์ Express เชื่อมต่อ `@google/genai` (`client.interactions.create` ด้วยโมเดล `gemini-3.8-flash`) และ API บันทึกข้อมูลผู้ใช้

## 2. คำสั่งใช้งานหลัก (Commands)

```powershell
# 1. สร้าง/อัปเดตไฟล์โมเดล 3D (.glb) ทั้งหมดลงใน public/models/
npm run build:models

# 1b. ปั้นและ Rig โมเดลสติ + แอนิเมชัน 4 คลิปใหม่ด้วย Blender 5.3 ลงใน public/models/sati_custom.glb
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python .\.agents\skills\sati-3d-engine\scripts\build_sati_blender.py

# 2. รันระบบพัฒนาแบบครบวงจร (Vite Frontend + Backend Proxy)
npm run dev

# 3. บิลด์ตรวจสอบ Production Bundle
npm run build
```

## 3. กฎสำคัญเมื่อแก้ไขโค้ด Gemini API และ Web UI
- **Gemini API**: ห้ามใช้ `gemini-2.5-flash` หรือ `generateContent` ที่ตกรุ่น ให้ใช้ `@google/genai` (`>= 2.29.1`) เรียก `ai.interactions.create({ model: 'gemini-3.8-flash', input, system_instruction, generation_config: { thinking_level: 'low', max_output_tokens: 1024 } })` เสมอ
- **Web Modals**: ใช้ `<dialog>` มาตรฐานพร้อม `showModal()` และ `closedby="any"` (พร้อม pointerdown/pointerup fallback) ตามมาตรฐาน `modern-web-guidance`
