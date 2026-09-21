# 운영/복구 — 비공개 테스트

## 정상 접수의 정의

Receipt.intakeState=ACCEPTED, acceptedAt 존재, 원본 GCS 객체/sha256/길이 검증 완료, PDF/OCR Job 영속 기록. Drive 자동 백업을 선택했다면 ARCHIVE Job도 기록합니다. 모바일 상태와 달리 로그에만 성공이 있거나 ID만 만든 것은 접수가 아닙니다.

## 작업 복구

- Scheduler가 매분 reconcile 엔드포인트를 OIDC로 호출합니다. UPLOADING 상태에서 원본이 확인되면 접수와 PDF/OCR 작업을 복구하며, 접수 시 Drive 백업을 선택했다면 ARCHIVE 작업도 생성합니다.
- PENDING/기한 만료 작업을 재등록합니다. RUNNING lease는 10분이며 이전 worker의 늦은 완료는 토큰이 달라 거부됩니다.
- 자동 작업 시도는 기본 5회입니다. 앱 PDF는 별도의 PDF 작업이며 Drive와 무관하게 저장합니다. Drive 권한/용량 문제는 백업만 BLOCKED로 정지하고 재연결 후 재개합니다. 한도 초과 OCR은 다음 JST 날짜부터 다시 시도합니다.
- FAILED는 무한 재시도하지 않습니다. 원인 해결 후 운영자가 대상 작업을 PENDING, attempts=0, nextRunAt=현재, lease=null, enqueuedAt=null로 변경해 재처리할 수 있습니다. DB 운영 작업은 대상 영수증/사용자를 확인한 후 수행합니다.
- 웹의 삭제는 앱 휴지통으로 이동하는 기능입니다. 원본 사진·앱 PDF·Drive 파일·수정 이력은 보존하고 자동 삭제하지 않습니다. 일반 조회/수정/신규 파일 링크 발급은 차단하고 `/web/trash`에서 본인 자료만 복원합니다. 이미 발급된 60초 서명 URL은 만료까지 열릴 수 있으며 Drive 파일은 Drive에서 계속 열립니다.
- 휴지통에 있는 동안 새 작업 호출/claim은 제외합니다. 이미 실행 중인 작업은 결과/오류를 저장해 복원 후 상태가 유실되지 않게 합니다. 복원은 기존 PENDING 작업의 큐 등록 표시만 초기화하며, 완료 작업·시도 횟수·한도는 초기화하지 않습니다. 영구 삭제는 이번 기능에 포함하지 않습니다.

## 관찰 지표

UsageDay.intake/ocr는 사용자·JST 날짜별 접수 및 실제 OCR 호출 예약 횟수입니다. Job.attempts/lastError/completedAt과 Receipt.byteLength/createdAt/acceptedAt으로 시도·오류·저장량·접수 지연을 집계할 수 있습니다. Cloud Monitoring에서 Scheduler 호출 실패, 오래된 PENDING/RUNNING, Cloud Run 5xx, Vision 요청/예산을 확인합니다. 테스트 자료가 적으면 자동 대시보드를 만들지 않고 아래 조회를 사용합니다.

```sql
SELECT state, kind, count(*) FROM "Job" GROUP BY state, kind;
SELECT "lastError", count(*) FROM "Job" WHERE "lastError" IS NOT NULL GROUP BY "lastError";
SELECT day, sum(intake), sum(ocr) FROM "UsageDay" GROUP BY day ORDER BY day DESC;
SELECT sum("byteLength") AS original_bytes FROM "Receipt" WHERE "deletedAt" IS NULL;
```

애플리케이션 로그에는 고정 오류 코드·작업 ID만 남깁니다. 토큰, 이메일, OCR 원문, 영수증 내용/사진은 일반 로그에 남기지 않습니다. DB/스토리지 운영 접근 역시 제한합니다.

## 알려진 한계

- Vision 응답 성공 직후 DB 저장 전에 프로세스가 죽는 극단적 상황에서는 OCR 호출이 반복될 수 있습니다. 외부 API와 DB 사이에 원자적 트랜잭션은 없으며, 호출 한도/재시도 상한으로 비용을 제한합니다.
- 최종 Drive 이름/폴더 갱신은 OCR와 PDF 저장이 모두 끝난 다음의 METADATA 작업입니다. 갱신 실패 시 기존 PDF는 그대로 남습니다.
- 재촬영은 새 자료로 보존합니다. 오늘 범위에서 이미지 유사도 중복 그룹은 생성하지 않습니다.
- 계정별 조회를 서버에서 검증합니다. PGlite 테스트는 실제 다중 인스턴스 PostgreSQL 운영 검증을 대체하지 않습니다.
