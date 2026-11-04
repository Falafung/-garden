# ตั้งค่าซิงก์ข้อมูลทุกเครื่อง (Firebase) + Google Drive

> 🎬 **ดูวิดีโอคู่มือ (1 นาที 18 วินาที):** [https://falafung.github.io/-garden/docs/firebase-setup-video.html](https://falafung.github.io/-garden/docs/firebase-setup-video.html)
> ทำตามไม่ได้ตรงไหน ลองดูวิดีโอนี้ก่อน — กดหยุด/เลื่อนดูทีละขั้นได้

ทำ**ครั้งเดียว** ใช้เวลาประมาณ 10 นาที ฟรีทั้งหมด (แพ็กเกจ Spark ของ Firebase)
หลังตั้งค่าเสร็จ ให้ล็อกอินด้วยบัญชี Google เดียวกันในมือถือ คอม และ iPad แล้วข้อมูลจะตรงกันอัตโนมัติ

> หน้าเว็บของ Firebase/Google อาจเปลี่ยนชื่อปุ่มเล็กน้อย ถ้าหาไม่เจอ ให้มองหาคำที่ใกล้เคียง

---

## 1. สร้างโปรเจกต์ Firebase

1. เข้า **https://console.firebase.google.com** ด้วยบัญชี Google ที่จะใช้กับสวน
2. กด **สร้างโปรเจกต์ / Create a project** → ตั้งชื่อ เช่น `suan-app` → กดต่อไป
3. หน้า Google Analytics **ปิดได้** (ไม่จำเป็น) → กด **สร้างโปรเจกต์**

## 2. เพิ่มเว็บแอป แล้วคัดลอกค่าตั้งค่า

1. ในหน้าแรกของโปรเจกต์ กดไอคอน **`</>`** (Web)
2. ตั้งชื่อเล่น เช่น `สมุดสวน` → **ไม่ต้อง**ติ๊ก Firebase Hosting → กด **Register app**
3. จะเห็นโค้ดหน้าตาแบบนี้ ให้**คัดลอกส่วนนี้เก็บไว้**:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "suan-app-xxxx.firebaseapp.com",
  projectId: "suan-app-xxxx",
  storageBucket: "suan-app-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

ค่าเหล่านี้**ไม่ใช่รหัสลับ** (ใครเห็นก็เข้าข้อมูลคุณไม่ได้ เพราะมีกฎในข้อ 4 ป้องกันอยู่)

## 3. เปิดการล็อกอินด้วย Google

1. เมนูซ้าย **Build → Authentication** → กด **Get started**
2. แท็บ **Sign-in method** → เลือก **Google** → กดเปิด **Enable** → เลือกอีเมลติดต่อ → **Save**
3. แท็บ **Settings → Authorized domains** → กด **Add domain** → ใส่ `falafung.github.io` → **Add**

## 4. สร้างฐานข้อมูล Firestore และตั้งกฎความปลอดภัย

1. เมนูซ้าย **Build → Firestore Database** → กด **Create database**
2. Location เลือก **asia-southeast1 (Singapore)** (ใกล้ไทย เลือกแล้วเปลี่ยนไม่ได้)
3. เลือก **Start in production mode** → **Create**
4. ไปที่แท็บ **Rules** (ลิงก์ตรง: https://console.firebase.google.com/project/gardenfarm/firestore/rules) ลบของเดิมทั้งหมด แล้ววางกฎด้านล่างนี้ **ทั้งหมด** → กด **Publish**
   (กฎชุดเดียวกันอยู่ในไฟล์ [`firestore.rules`](firestore.rules) ด้วย)

```
rules_version = '2';
// กฎความปลอดภัยของสมุดสวน — วางทั้งหมดนี้ใน Firebase → Firestore Database → Rules แล้วกด Publish
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }

    // รายการสวนของแต่ละคน + ข้อมูลรูปแบบเดิม (ก่อนมีระบบกลุ่ม): เจ้าของบัญชีเท่านั้น
    match /users/{uid}/{document=**} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }

    match /farms/{farmId} {
      function farm() { return get(/databases/$(database)/documents/farms/$(farmId)).data; }
      function isMember() { return signedIn() && request.auth.uid in farm().members; }
      function myRole() { return farm().members[request.auth.uid].role; }
      function canWrite() { return isMember() && myRole() in ['owner', 'editor']; }
      function canMoney() { return isMember() && (myRole() == 'owner' || farm().members[request.auth.uid].money == true); }
      function isOwner() { return isMember() && myRole() == 'owner'; }

      // เจ้าของแก้ข้อมูลสวน/สมาชิกได้ แต่ห้ามเปลี่ยนเจ้าของ
      function ownerUpdate() {
        return signedIn()
          && request.auth.uid in resource.data.members
          && resource.data.members[request.auth.uid].role == 'owner'
          && request.resource.data.ownerUid == resource.data.ownerUid
          && request.resource.data.members[resource.data.ownerUid].role == 'owner';
      }
      // เข้าร่วมด้วยลิงก์เชิญ: เพิ่มได้เฉพาะตัวเอง และสิทธิ์ต้องตรงกับลิงก์ที่ยังใช้ได้
      function joinWithInvite() {
        let me = request.resource.data.members[request.auth.uid];
        let inv = get(/databases/$(database)/documents/farms/$(farmId)/invites/$(me.invite)).data;
        let md = request.resource.data.members.diff(resource.data.members);
        return signedIn()
          && !(request.auth.uid in resource.data.members)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members'])
          && md.addedKeys().hasOnly([request.auth.uid])
          && md.changedKeys().size() == 0 && md.removedKeys().size() == 0
          && me.role in ['editor', 'viewer']
          && me.role == inv.role
          && me.money == inv.money
          && inv.revoked == false
          && inv.expiresAt > request.time.toMillis();
      }
      // สมาชิก (ที่ไม่ใช่เจ้าของ) ออกจากสวนเองได้
      function leave() {
        let md = request.resource.data.members.diff(resource.data.members);
        return signedIn()
          && request.auth.uid in resource.data.members
          && resource.data.members[request.auth.uid].role != 'owner'
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members'])
          && md.removedKeys().hasOnly([request.auth.uid])
          && md.addedKeys().size() == 0 && md.changedKeys().size() == 0;
      }

      allow get, list: if signedIn() && request.auth.uid in resource.data.members;
      allow create: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.members.keys().hasOnly([request.auth.uid])
        && request.resource.data.members[request.auth.uid].role == 'owner';
      allow update: if ownerUpdate() || joinWithInvite() || leave();
      allow delete: if signedIn() && resource.data.ownerUid == request.auth.uid;

      match /records/{key} {
        allow read: if isMember();
        allow write: if canWrite();
      }
      match /money/{key} {
        allow read: if canMoney();
        allow write: if canMoney() && canWrite();
      }
      match /invites/{code} {
        allow get: if signedIn();
        allow list, delete: if isOwner();
        allow create: if isOwner() && request.resource.data.role in ['editor', 'viewer'];
      }
    }
  }
}
```

กฎนี้หมายความว่า
- ข้อมูลสวนอ่านได้เฉพาะ **สมาชิกของสวนนั้น** · บันทึก/แก้ไขได้เฉพาะ **เจ้าของ** และสมาชิกสิทธิ์ **บันทึก/แก้ไขได้**
- **บัญชีเงิน** และราคาต่างๆ อ่านได้เฉพาะคนที่เจ้าของให้สิทธิ์ “เห็นบัญชีเงิน” (ถูกซ่อนจริงที่เซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนบนหน้าจอ)
- เข้าร่วมสวนได้เฉพาะคนที่มี **ลิงก์เชิญที่ยังไม่หมดอายุ** และได้สิทธิ์ตามที่ลิงก์กำหนดเท่านั้น
- เฉพาะ **เจ้าของ** เชิญ/นำสมาชิกออก/เปลี่ยนสิทธิ์ได้

> ถ้าเคยวางกฎชุดเก่า (ที่มีแค่ `match /users/{uid}`) ให้วางชุดนี้แทน — ข้อมูลเดิมจะถูกย้ายเข้า “สวน” ของคุณอัตโนมัติเมื่อล็อกอินครั้งถัดไป

## 5. (ถ้าต้องการ) เปิด Google Drive

ใช้สำหรับปุ่ม “สำรองลง Drive”, “กู้คืนจาก Drive” และ “บัญชี → Google Sheets”

1. เข้า **https://console.cloud.google.com** → ด้านบนเลือกโปรเจกต์ชื่อเดียวกับข้อ 1
2. ค้นหา **Google Drive API** → กด **Enable**

แอปขอสิทธิ์ Drive แบบ “เฉพาะไฟล์ที่แอปสร้าง” เท่านั้น — **มองไม่เห็นไฟล์อื่นใน Drive ของคุณ**
ไฟล์ทั้งหมดจะอยู่ในโฟลเดอร์ชื่อ **สมุดสวน**

ถ้าตอนกดเชื่อม Drive ขึ้นว่า *“Access blocked”* หรือ *“แอปนี้ยังไม่ได้รับการยืนยัน”*:
ไปที่ **Google Cloud Console → Google Auth Platform (หรือ OAuth consent screen) → Audience** แล้วเพิ่มอีเมลของคุณใน **Test users** (หรือกด **Publish app**)

## 6. ใส่ค่าตั้งค่าในแอป

เลือกวิธีใดวิธีหนึ่ง:

- **แนะนำ:** ส่งค่า `firebaseConfig` จากข้อ 2 ให้ผู้ดูแลใส่ในไฟล์ `firebase-config.js` ของเว็บ → ทุกเครื่องใช้ได้ทันทีโดยไม่ต้องวางเอง
- **หรือ:** เปิดแอป → **ตั้งค่า → ☁️ ซิงก์ข้อมูลทุกเครื่อง** → วางค่าลงในช่อง → **บันทึกค่าตั้งค่า** (ต้องทำในทุกเครื่อง)

จากนั้นกด **เข้าสู่ระบบด้วย Google** ในทุกเครื่อง (ใช้บัญชีเดียวกัน)

- เครื่องแรกที่ล็อกอิน: ข้อมูลในเครื่องจะถูกอัปโหลดขึ้นคลาวด์
- เครื่องถัดไป: ถ้าเครื่องนั้นมีข้อมูลอยู่แล้ว แอปจะถามว่าจะ **รวมข้อมูล** (แนะนำ) / ใช้ของคลาวด์ / ใช้ของเครื่องนี้

---

## แชร์สวนให้คนอื่น (ครอบครัว คนงาน หุ้นส่วน)

1. ไปที่ **ตั้งค่า → 👥 สมาชิกสวน**
2. เลือกสิทธิ์: **บันทึก/แก้ไขได้** หรือ **ดูอย่างเดียว** และติ๊ก **เห็นบัญชีเงิน** ถ้าต้องการให้เห็นรายรับรายจ่ายและราคา
3. กด **สร้างลิงก์เชิญ** → **คัดลอก** หรือ **แชร์** ส่งทาง LINE/อีเมล
4. คนที่ได้รับเปิดลิงก์ → ล็อกอินด้วย Google → กด **เข้าร่วม** แล้วจะเห็นข้อมูลสวนทันที

- ลิงก์ใช้ได้ 7 วัน และใช้ได้หลายคน ยกเลิกลิงก์ได้ทุกเมื่อ
- เจ้าของเปลี่ยนสิทธิ์ หรือ **นำออก** ได้ทุกเมื่อ คนที่ถูกนำออกจะเห็นข้อมูลไม่ได้ทันที
- ถ้าใครเป็นสมาชิกหลายสวน สลับสวนได้ที่ **ตั้งค่า → สวนที่เปิดอยู่**
- รายการที่สมาชิกบันทึกจะมีชื่อผู้บันทึกกำกับไว้

---

## คำถามที่พบบ่อย

**ไม่มีอินเทอร์เน็ตในสวน บันทึกได้ไหม?**
ได้ บันทึกตามปกติ ไอคอนข้างชื่อสวนจะเป็น ☁️⚠ พอมีอินเทอร์เน็ตจะซิงก์ให้เอง

**ใช้ฟรีได้นานแค่ไหน?**
แพ็กเกจฟรีของ Firebase ให้พื้นที่ 1 GB และเขียนข้อมูลได้ 20,000 ครั้งต่อวัน ซึ่งเกินพอสำหรับสวนครอบครัว

**ให้คนในครอบครัว/คนงานช่วยบันทึกได้ไหม?**
ได้ — ดูหัวข้อ “แชร์สวนให้คนอื่น” ด้านล่าง

**ไอคอนสถานะหมายถึงอะไร?**
☁️✓ ซิงก์แล้ว · ☁️… กำลังซิงก์ · ☁️⚠ ออฟไลน์ (จะซิงก์ทีหลัง) · ☁️✕ มีปัญหา (กดดูรายละเอียดในหน้าตั้งค่า)
