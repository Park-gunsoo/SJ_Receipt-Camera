# 실제 Google 연동 준비

현재 소스는 외부 설정 없이도 화면을 열 수 있지만, Google 로그인·Drive 저장·OCR 성공을 가장하지 않습니다. 아래 계정/결제 설정은 소스 개발과 별개이며 아직 적용하지 않았습니다. 비밀키를 채팅에 붙여넣거나 Git에 커밋하지 마세요.

## 1. 준비할 것

1. Google Cloud 프로젝트 1개와 결제 계정. 초대된 본인/테스터만 이용합니다.
2. **이 서비스 전용 새 Supabase 프로젝트**의 PostgreSQL 연결 주소. DB만 Supabase를 사용하며 Supabase Auth/Storage는 사용하지 않습니다. 기존 서비스 프로젝트에 테이블을 추가하지 않습니다.
3. 웹/API의 Vercel HTTPS 주소(APP_URL), 별도 처리 서비스의 Cloud Run 주소(WORKER_BASE_URL).

화면 작업에 Google 결제는 필요하지 않습니다. 실제 Vision/저장/작업 실행에는 결제 가능한 프로젝트 설정이 필요하며, 무료 제공 서비스라는 제품 정책과 인프라 비용은 별개입니다. 기본 테스트 한도는 사용자별 하루 접수 100건/OCR 호출 100회이며 `.env`에서 운영자가 바꿀 수 있습니다. 사용자 화면에서 무료 상품 한도로 홍보하지 않습니다.

## 2. Google Cloud 리소스

리전 기본값: `asia-northeast1`(도쿄). Supabase도 가능한 경우 Tokyo 리전을 선택합니다.

- API: Drive, Cloud Vision, Cloud Storage, Cloud Tasks, Cloud Run, Cloud Scheduler, Secret Manager, Cloud Build, Artifact Registry.
- 비공개 GCS 버킷: Uniform bucket-level access + Public access prevention. 수명주기 자동 삭제는 설정하지 않습니다.
- Cloud Tasks 큐: `sj-receipts`, 동시 실행 2, 초당 실행 2, 최대 전달 시도 5, 최소 backoff 30초. 작업 본문은 영수증이 아닌 작업 ID만 포함합니다.
- Cloud Run 처리 서비스: Node 컨테이너, 요청 제한 600초, 1 CPU/1GiB 이상, concurrency 4, min instances 0, max instances 2로 테스트를 시작합니다. 부하 측정 후 조정합니다. worker URL은 애플리케이션에서 OIDC로 인증합니다. 웹 화면은 Vercel에서 제공합니다.
- Cloud Scheduler: 매분 `POST WORKER_BASE_URL/api/jobs/reconcile`, OIDC audience는 WORKER_BASE_URL, 서비스 계정은 TASK_SERVICE_ACCOUNT_EMAIL. 이 스케줄러가 없으면 접수/작업 복구를 보장할 수 없습니다.
- GCS CORS: 실제 Vercel APP_URL origin의 POST/GET/HEAD만 허용합니다. 5분 서명 form은 파일 크기와 staging 경로로 한정됩니다. 완전 수신·해시·이미지 검증 후에만 서버 원본 경로로 저장하므로 브라우저가 접수 원본을 덮어쓸 수 없습니다.

서비스 계정은 앱용과 작업호출용을 분리합니다. 앱 계정에는 해당 버킷의 object 권한, 해당 큐의 tasks.enqueuer, 필요한 secret 읽기, Vision 호출 권한만 부여합니다. 작업호출 계정에는 불필요한 DB/스토리지 권한을 주지 않습니다. 앱 계정에는 작업호출 계정에 한정한 `iam.serviceAccounts.actAs`가 필요합니다. Cloud Tasks/Cloud Scheduler 서비스 에이전트의 OIDC 토큰 생성 권한도 Google 공식 설정대로 확인합니다. 사용자 Drive는 서비스 계정이 아니라 각 사용자의 OAuth 권한으로 접근합니다.

## 3. Google 로그인과 Drive 권한

Google Auth Platform에서 OAuth 동의 화면을 만들고, External + Testing으로 시작합니다. 본인/테스터 이메일을 Test users에 넣고 앱의 TESTER_EMAILS에도 같은 목록을 설정합니다.

Web application OAuth client의 redirect URI를 정확하게 등록합니다:

```
https://YOUR_VERCEL_HOST/api/auth/callback/google
https://YOUR_VERCEL_HOST/api/drive/callback
```

로컬 연결 검증도 필요하면 아래 두 주소를 별도로 추가합니다:

```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/drive/callback
```

최초 로그인은 `openid email profile`. Drive 연결은 별도 동의로 `openid email https://www.googleapis.com/auth/drive.file` + offline access를 요청합니다. 다른 Google 계정을 Drive로 연결하면 거절합니다. 앱 생성 파일만 다루며 Drive 전체 권한을 요청하지 않습니다. Testing 상태에서 Drive 권한을 요청한 refresh token은 일반적으로 7일 후 만료되므로 재연결이 필요합니다. 공개 전 Production 상태/브랜딩/동의 화면 요건을 별도로 확인해야 합니다.

## 4. 환경변수와 배포

`.env.example`을 참고해 로컬 `.env` 또는 Cloud Run Secret Manager에 설정합니다. TOKEN_ENCRYPTION_KEY는 32바이트 랜덤값의 base64, NEXTAUTH_SECRET은 별도의 충분히 긴 랜덤값입니다. 키를 바꾸면 기존 Drive 토큰을 복호화할 수 없으므로 재연결/키 이전 계획이 필요합니다.

Cloud Run에서는 첨부 서비스 계정의 Application Default Credentials를 사용하며 서비스계정 JSON 키를 이미지에 넣지 않습니다. Vercel의 GOOGLE_SERVICE_ACCOUNT_JSON은 암호화한 서버 전용 환경변수로 설정하고 절대로 NEXT_PUBLIC 접두어를 사용하지 않습니다. 로컬 실제 호출을 테스트할 때만 `gcloud auth application-default login` 또는 안전한 별도 경로의 자격증명을 사용합니다.

```powershell
npm ci
npm run check:config
npm run db:migrate
npm test
npm run build
```

Dockerfile의 기본 target은 실행용 standalone 서버입니다. `migrator` target은 DB 마이그레이션 실행용입니다. DB 마이그레이션은 앱 요청에서 자동 실행하지 않으며 배포 전에 1회 실행합니다.

### Supabase DB 연결

- 무료 조직에 새 `sj-receipt-camera` 프로젝트를 생성합니다. 무료 프로젝트 개수 제한에 걸리거나 유료 조직만 있으면 추가 비용을 확인하기 전 생성하지 않습니다.
- Connect → Session pooler의 **5432 포트** 연결 문자열을 DATABASE_URL로 설정합니다. IPv4 환경에서도 접속 가능하며 이 작은 Cloud Run 서비스는 DB_POOL_SIZE=3으로 시작합니다. 6543 transaction pooler 주소를 마이그레이션에 사용하지 않습니다.
- Supabase API Settings에서 **Data API를 비활성화**합니다. 브라우저용 anon/publishable key나 service_role key는 앱에서 필요하지 않습니다.
- Prisma migration은 테이블 소유자 역할로 적용합니다. 포함된 private_access migration이 모든 앱 테이블에서 RLS를 활성화하고 anon/authenticated 권한을 제거합니다. 서버 API가 로그인 계정의 소유권을 추가 검증합니다.
- DB 암호는 URL 인코딩하고 TLS 검증을 유지합니다. 필요하면 Supabase가 제공하는 CA 인증서를 설치합니다. `rejectUnauthorized: false`로 우회하지 않습니다.
- 무료 플랜에는 DB 500MB, 1주 비활성 시 일시 중지, 자동 백업 미포함 조건이 있습니다. 테스트 범위를 넘어가기 전 백업과 요금제를 검토합니다. 원본 이미지/PDF는 이 DB 용량에 넣지 않습니다.
- [Supabase Prisma 연결](https://supabase.com/docs/guides/database/prisma), [접속 방식](https://supabase.com/docs/guides/database/connecting-to-postgres), [요금](https://supabase.com/pricing)

배포 절차: GitHub 업로드 → Vercel 웹 배포 → Supabase DB 마이그레이션 → Cloud Run 처리 서비스 → OAuth URI 등록 → Tasks와 Scheduler → 본인 로그인. APP_URL과 NEXTAUTH_URL은 Vercel 주소로, WORKER_BASE_URL은 처리 서비스 주소로 설정합니다. 구글 설정이 끝나기 전에는 화면 미리보기만 가능하며 실제 촬영 저장 성공으로 안내하지 않습니다.

## 5. Android 실기기 합격 확인

1. Chrome에서 HTTPS 주소를 열고 Google 로그인과 Drive 연결을 완료합니다.
2. 실제 영수증을 1장 촬영합니다. 별도 저장 버튼 없이 `送信中`이 나와야 합니다.
3. `受付完了` 후 화면을 잠그거나 브라우저를 닫습니다. PC Drive에서 같은 영수증 PDF가 생기는지 확인합니다.
4. 다시 접속해 날짜·합계·원본·PDF·Drive 링크를 확인합니다. 틀리거나 모호한 값은 未確認/확인 필요여야 합니다.
5. 연결 후 비행기 모드에서 촬영 → 페이지를 닫음 → 네트워크 복구 → 같은 계정으로 재접속하여 자동 전송을 확인합니다. 브라우저 데이터 삭제는 복구 범위가 아닙니다.
6. 업로드 응답을 끊은 뒤 재접속해 DB 영수증과 Drive PDF가 각 1개인지 확인합니다.
7. worker 처리 중 재시작 후, lease 만료(최대 10분)와 Scheduler를 거쳐 복구되는지 확인합니다.
8. OCR 오류를 유도해도 PDF가 저장되는지, Drive 권한 취소/용량 부족이 완료로 표시되지 않는지 확인합니다.
9. 다른 테스터 계정에서 첫 계정의 기록·이미지·PDF 접근이 404인지 확인합니다.
10. 홈 화면 설치 후 촬영/복구를 반복합니다. iPhone은 별도 테스트 전까지 미검증으로 기록합니다.

## 공식 참고

- [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [테스트 토큰 만료](https://developers.google.com/identity/protocols/oauth2)
- [Drive 권한](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [중복 방지용 Drive 파일 ID](https://developers.google.com/workspace/drive/api/guides/create-file)
- [Cloud Tasks와 Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-tasks)
- [Vision 요금](https://cloud.google.com/vision/pricing)
