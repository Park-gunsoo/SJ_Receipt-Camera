# SJ レシートカメラ

일본 영수증 촬영·조회 모바일 웹, PC 수정 화면과 공통 처리 백엔드. **본인/초대 테스터용**이며 일본어·한국어·영어를 지원합니다. 웹에서 삭제(휴지통 이동)·복원을 지원하며, 영구 삭제·내보내기는 후속 개발입니다.

## 로컬 화면 실행

Node 22.12 이상(22 LTS 권장)이 필요합니다.

```powershell
npm ci
npm run db:generate
npm run dev
```

`http://127.0.0.1:3000/m/capture`에서 실제 화면을 확인할 수 있습니다. Google 설정이 없는 상태에서는 미연결 안내와 빈 화면만 표시하며 로그인/업로드는 비활성화됩니다. 데모 영수증이나 가짜 OCR/Drive 결과는 없습니다.

## 구현 구성

- Next.js App Router, TypeScript, Tailwind CSS, 3개 언어 모바일 화면과 PC 영수증 관리·수정 화면
- Google 로그인(NextAuth)과 선택형 Drive offline OAuth, 암호화한 refresh token
- 새 Supabase 프로젝트의 PostgreSQL/Prisma, 비공개 GCS 사진, durable outbox, Cloud Tasks OIDC worker, Scheduler 복구
- 비공개 앱 PDF 보관, 선택형 Drive 자동 백업과 미리 예약한 Drive 파일 ID를 통한 업로드 중복 방지
- Vision DOCUMENT_TEXT_DETECTION → 보수적인 일본어 항목 추출 → 규칙 기반 계정과목 후보
- 사용자별 IndexedDB 미전송 자료, 계정 확인 헤더, PWA 설치/정적 에셋/오프라인 안내

배포 구성은 Vercel 웹/API + Supabase PostgreSQL + Google Cloud Run 처리 서비스입니다. 사진은 크기를 줄이는 대신 비공개 GCS로 직접 전송하고, 서버의 이미지 검증과 영속 기록이 끝나야 접수로 표시합니다. 브라우저의 완료 호출이 유실되어도 worker가 저장된 파일을 발견해 복구합니다.

PC 화면 `/web/receipts`에서 원본을 보며 인식값을 수정할 수 있습니다. 수정은 본인 소유권과 버전을 확인하고 이력을 남기며, OCR 재실행은 사용자 수정값을 덮어쓰지 않습니다. 삭제한 영수증은 `/web/trash`에서 복원할 수 있고 원본·PDF·Drive 파일은 보존합니다. 분류기 계약은 `src/lib/contracts.ts`의 Classifier이며 현재 구현은 `src/lib/classifier.ts`입니다. TypeSafe 계정이나 키가 필요하지 않습니다.

## 데이터와 상태

원본 이미지를 비공개 저장하고 DB 접수/작업을 기록한 다음에만 `受付完了`를 반환합니다. 앱 PDF 저장과 OCR은 별도 작업이며 Drive 연결 없이 이용할 수 있습니다. Drive 자동 백업 선택은 새 영수증 접수 시 적용하며 기존 Drive 파일은 유지합니다. Next.js `after`는 큐 등록을 빠르게 시도할 뿐, 작업 지속성을 대신하지 않습니다. DB outbox와 매분 Scheduler가 누락을 복구합니다.

서버 원본과 OCR 결과는 **테스트 중 자동 삭제하지 않습니다**. 사용자 Drive PDF도 유지합니다. 작업 실패를 성공으로 표시하지 않습니다. 지원 이미지: JPEG/PNG/WebP, 12MiB 이하, 최대 4천만 픽셀/가로세로 각 2만 픽셀. HEIC/다중 프레임 이미지는 JPEG 변환 후 가져오도록 안내합니다. 현재 회전(EXIF)/JPEG 정규화를 제공하고 자동 원근 보정/크롭은 하지 않습니다.

로그아웃 시 미전송 사진은 원래 계정의 IndexedDB에 남습니다. 기기 보관에 성공한 자료만 재접속 복구가 가능합니다. 브라우저 종료 후 미전송 업로드, 완전 오프라인 최초 로그인/촬영은 보장하지 않습니다. 서비스워커는 API/계정/이미지/PDF를 캐시하지 않습니다.

## 검증

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

자동 테스트는 추출 오류/0원과 누락 구분/암호화/소유권/IndexedDB 분리/PDF/SQL 접수·작업 복구/선택형 Drive 백업/웹 수정 충돌을 검증합니다. DB 테스트는 실제 SQL을 실행하는 로컬 PGlite와 Prisma를 사용하며 **Google 호출 경계는 stub**입니다. 외부 연동 또는 실제 PostgreSQL 운영 부하 검증으로 해석하면 안 됩니다. 실제 영수증 4장의 기존 OCR 결과로 추출 개선을 비교했으며, 일반적인 인식률을 판단하기에는 표본이 부족합니다.

최신 결과와 미검증 항목은 [CURRENT_STATUS.md](CURRENT_STATUS.md), 외부 연결 순서는 [SETUP.md](SETUP.md), 운영 점검은 [OPERATIONS.md](OPERATIONS.md)를 참조하세요.

## 개발 지침

[PRODUCT_FLOW.md](PRODUCT_FLOW.md), [DB_SCHEMA.md](DB_SCHEMA.md), [PAGE_RULES.md](PAGE_RULES.md), [DESIGN_RULES.md](DESIGN_RULES.md), [API_RULES.md](API_RULES.md)가 현재 기준입니다. 실제 Google 연동과 HTTPS 배포는 완료했으며 Android 실기기의 촬영·화면 잠금·오프라인 복구는 별도 검증이 필요합니다.
