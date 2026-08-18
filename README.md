# 💧 Groundwater Explorer Thailand

แผนที่ GIS สำรวจข้อมูลบ่อน้ำบาดาลทั่วประเทศไทย — ตำแหน่ง ความลึก ปริมาณน้ำ (Yield) และระดับน้ำสถิต ต่อยอดจากแนวคิด "Groundwater Intelligence Map" ที่เน้นการวิเคราะห์/ตอบคำถาม ไม่ใช่แค่แผนที่จุดบ่อ

**Live demo:** (เพิ่มลิงก์ GitHub Pages หลัง deploy)

## สถานะปัจจุบัน: Phase 1 — Groundwater Explorer (MVP)

หน้าเดียว, เค้าโครง 4 ส่วนตามที่วางแผนไว้:

- **ซ้าย — Filters:** จังหวัด, อำเภอ, ประเภทบ่อ (อุปโภค-บริโภค/เกษตร), ช่วงความลึก, ช่วง Yield
- **กลาง — Map:** ภาพรวมทั้งประเทศเป็นวงกลมต่อจังหวัด (สี/ขนาดตามจำนวนบ่อ) → คลิกจังหวัดหรือเลือกจาก dropdown เพื่อโหลดจุดบ่อจริง (ใช้ Leaflet.markercluster เพราะมีบ่อกว่า 117,000 จุด)
- **ขวา — Well Info:** คลิกจุดบ่อ → รายละเอียด + แผนภาพประกอบความลึกบ่อ (ภาพประกอบอย่างง่าย ไม่ใช่ข้อมูลชั้นดินจริง)
- **ล่าง — Analytics:** จำนวนบ่อ, ความลึก/Yield/ระดับน้ำสถิตเฉลี่ย, histogram การกระจายความลึกและ Yield ของผลลัพธ์ที่กรองอยู่

## แหล่งข้อมูล

**กรมทรัพยากรน้ำบาดาล ระบบพสุธารา (Pasutara) — Open API**
`https://pasutara.dgr.go.th/api_well/api/FindWellAll`

ดึงข้อมูลบ่อทั้งหมด 117,537 บ่อ (ณ วันที่ดึง 2026-08-18) ด้วยสคริปต์ Python ในเซสชันที่สร้างโปรเจกต์นี้ (ไม่ได้เก็บสคริปต์ไว้ใน repo — ดูหมายเหตุด้านล่าง) แล้วประมวลผล:

- แปลงพิกัด UTM → lat/lon (สูตร Snyder มาตรฐาน) สำหรับ ~9,200 บ่อที่ API ไม่ได้ให้ lat/long มาตรง ๆ
- ตัดบ่อที่ไม่มีพิกัดใช้งานได้ทิ้ง (~450 บ่อ)
- แยกเป็นไฟล์ต่อจังหวัด (`data/wells/<จังหวัด>.json`) เพื่อให้หน้าเว็บโหลดเฉพาะจังหวัดที่ผู้ใช้เลือก แทนที่จะโหลดทั้งประเทศทีเดียว (~90MB รวม)
- ไฟล์ดัชนี `data/provinces.json` (ชื่อจังหวัด/จำนวนบ่อ/จุดศูนย์กลาง/ที่อยู่ไฟล์) ใช้ตอนโหลดหน้าแรกและวาดวงกลมภาพรวม

**หมายเหตุความถูกต้องของข้อมูล:** เป็นข้อมูล ณ เวลาที่ดึงมา อาจไม่ตรงกับสถานะปัจจุบันของบ่อทุกบ่อ ใช้เพื่อการศึกษาเบื้องต้นเท่านั้น ไม่ใช่ข้อมูลอ้างอิงทางกฎหมาย/วิศวกรรม (มีข้อความเตือนแบบเดียวกันแสดงอยู่ในตัวเว็บแล้ว)

## Tech stack

Vanilla JS + [Leaflet](https://leafletjs.com/) 1.9.4 + [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) — เก็บไลบรารีไว้ใน `vendor/` แบบ self-host (recycle มาจากโปรเจกต์ `Birdheatmapproject` ในเว็บกฎหมายเดียวกัน) ไม่มี build step, เปิด `index.html` ผ่าน local server (`python -m http.server`) หรือ deploy เป็น static site ได้เลย

```
ดาลดำดึก/
├── index.html
├── app.js
├── vendor/            leaflet.js, leaflet.css, leaflet.markercluster.js, MarkerCluster*.css, leaflet.heat.js
├── data/
│   ├── provinces.json     ดัชนีจังหวัด (78 รายการ)
│   └── wells/<จังหวัด>.json   บ่อรายจังหวัด (117,088 บ่อ รวม)
└── README.md
```

## Roadmap (ตามที่วางแผนไว้)

- **Phase 1 (เสร็จแล้ว)** — Groundwater Explorer: filter + map + well info + analytics พื้นฐาน
- **Phase 2** — Groundwater Potential Index ต่อพื้นที่ (Geology + Soil + LULC + Rainfall + Slope + Drainage Density + NDVI + TWI → High/Moderate/Low potential) ต้องหาชั้นข้อมูลเสริม (ธรณีวิทยา, ฝน, LULC, NDVI, DEM) เพิ่ม — ยังไม่เริ่ม
- **Phase 3** — Time-series ระดับน้ำ ถ้าหาข้อมูลบ่อสังเกตการณ์ (observation wells) หลายปีได้ — ยังไม่เริ่ม
- **Phase 4** — ถามคำถามด้วยภาษาคน ("แถวอำเภอ X มีบ่อไหนให้น้ำเยอะที่สุด") — ยังไม่เริ่ม

## รันเทสต์ในเครื่อง

```
cd ดาลดำดึก
python -m http.server 8000
# เปิด http://localhost:8000
```
