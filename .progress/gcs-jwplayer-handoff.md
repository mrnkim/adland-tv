# Handoff: GCS Bucket + JW Player Integration

## Status: In Progress (2026-02-11)

## What's Done
- [x] Google Cloud SDK 설치 (`gcloud`, `gsutil`)
- [x] GCS 인증 완료 (`gcloud auth login`)
- [x] `gs://videos_from_ask` 버킷 접근 확인 → **86,260개 파일**
- [x] Super Bowl 파일명 검색 → 227개 매칭
- [x] JW Player 계정 초대 받음 (ari@marketecture.tv → content editor)
- [x] JW Player 계정 생성 완료 (Meeran Kim, Content-editor 권한)
- [x] Super Bowl 2026 광고 36개 TwelveLabs 인덱싱 완료 (adland-agent, YouTube 경로)
- [x] JW Player 구조 분석 완료 (아래 상세)
- [x] JW Player → TwelveLabs URL 업로드 파이프라인 검증 완료
- [x] Tecovas 테스트 성공 (JW `tNNiIpzO` → TL `698c34083a5c76b64cd61158`)
- [x] AI 분석 파이프라인 완성 (brand, theme, emotion, visual_style 등 자동 태깅)
- [x] 중복 업로드 방지 (dedup check by jw_media_id, --force 옵션)
- [x] 앱에서 JW Player 재생 지원 (videoUrl.ts 헬퍼, HLS/썸네일 CDN fallback)
- [x] 프론트엔드 업데이트 (analyze, search, VideoCard → JW Player fallback)
- [x] UserMetadata 타입에 JW Player 필드 추가

## What's Next
- [ ] `medialibrary.html`에서 media ID 일괄 추출 스크립트 작성
- [ ] JW Player 호스팅 영상 배치 인덱싱 (batch jw-to-tl)
- [ ] Ari에게 JW Player API key 요청 (content-editor로는 생성 불가)
- [ ] External video (m.adland.tv) 영상 인덱싱 전략 결정

## Key Findings (2026-02-11)

### JW Player CDN은 API key 없이 개별 미디어 조회 가능
```
https://cdn.jwplayer.com/v2/media/{mediaId}
→ title, duration, MP4 URLs (180p~1080p), HLS, thumbnails
```
- 목록/검색 조회는 불가 (API key 필요)
- Site ID: `LKnEu5Hs`

### adland.tv 비디오 임베딩 구조
| 상황 | 플레이어 | 예시 |
|---|---|---|
| JW Player 호스팅 영상 | JW Player iframe | Tecovas (`tNNiIpzO-19i2Zbpi`) |
| YouTube에 있는 영상 | YouTube iframe | Dunkin' (`youtube.com/watch?v=...`) |
| 오래된 외부 영상 | JW Player (external URL) | `m.adland.tv/파일.mp4` 참조 |

### JW Player 미디어 타입
- **Hosted video** (Feb 2026, 4개): JW CDN에 직접 호스팅, HLS+MP4, 실제 duration
- **External video** (Apr 2025, 213개+): `m.adland.tv` MP4 참조, duration 0

### Full Pipeline (4단계, 검증 완료)
```
JW Player Media ID
  → [0] Dedup check (jw_media_id로 기존 영상 확인, --force로 재처리 가능)
  → [1] CDN JSON 조회 (https://cdn.jwplayer.com/v2/media/{id})
  → [2] TwelveLabs SDK videoUrl 업로드 (다운로드 불필요)
  → [3] AI 분석 (brand, theme, emotion, visual_style, sentiment, category, era, celebrities)
  → [4] 메타데이터 업데이트 (JW 메타 + AI 태그 통합)
```
- 스크립트: `scripts/jw-to-tl-test.js`
- ~15초 소요 (30초 영상 기준, AI 분석 포함)

### 앱 JW Player 재생 지원
```
app/src/lib/videoUrl.ts
  → getVideoUrl(): TL HLS > JW Player HLS fallback
  → getThumbnailUrl(): TL thumbnail > JW thumbnail > JW poster fallback
```
- VideoCard, analyze page, search page 모두 JW Player fallback 적용

### TwelveLabs 대시보드 제목 제한
- `system_metadata.filename`은 URL 파일명에서 자동 추출 (read-only, 변경 불가)
- URL 업로드 시 `tNNiIpzO-M4qEmlcb.mp4` 같은 파일명이 표시됨
- 앱에서는 `user_metadata.title`로 올바른 제목 표시

### 2026 Super Bowl 매핑 현황
| 브랜드 | TwelveLabs (YT경로) | JW Player | 비고 |
|---|---|---|---|
| Life360 | `698aff01...` | `VbZSANvI` | 양쪽 존재 |
| Manscaped | `698b01d2...` | `azPq0YHz` | 양쪽 존재 |
| Tecovas | ❌ (YT 없음) | `tNNiIpzO` → `698c3408...` | JW→TL 완료 |
| Ro Serena | ❌ (목록에 없음) | `wdRWvzLj` | JW만 |
| 나머지 32개 | ✅ | ❌ | TL만 (YT 경로) |

## Architecture Overview

```
GCS Bucket (gs://videos_from_ask)     JW Player (CDN + Player)
  86,260 raw video files                 Media library with metadata
  대부분 숫자 ID 파일명                     title, tags (Super Bowl 연도별)
         │                                        │
         │                               Hosted: JW CDN MP4/HLS
         │                               External: m.adland.tv MP4
         │                                        │
         └──── 매핑 미확인 ────────────────────────┘
                            │
                     TwelveLabs Index
                  698c2e05c4d60db04d92a0ac
                  (search, analysis, embeddings)
                            │
                     AdLand.TV App (Next.js)
                  JW Player HLS fallback 재생
                  user_metadata 기반 제목/태그 표시
```

## Key Info

### GCS Bucket
- **Bucket**: `gs://videos_from_ask`
- **Files**: 86,260개 mp4/mov
- **Access**: gsutil 인증 완료 (Miranda 계정)
- **PATH**: `export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"`

### JW Player
- **Player ID**: `19i2Zbpi`
- **Site ID**: `LKnEu5Hs`
- **Dashboard**: https://dashboard.jwplayer.com/p/account/property/LKnEu5Hs
- **CDN media**: `https://cdn.jwplayer.com/v2/media/{mediaId}`
- **CDN embed**: `https://cdn.jwplayer.com/players/{mediaId}-19i2Zbpi.html`
- **권한**: Content-editor (API key 생성 불가, admin 필요)
- **Tags**: Super Bowl 연도별 태그 존재 (1969~현재)
- **"super bowl" 검색**: 217개 (hosted 4 + external 213)

### TwelveLabs Indexes
- **New index**: `698c2e05c4d60db04d92a0ac` (JW Player 영상용)
- **Old index**: `6979ae8323c828386368e5bd` (YouTube 경로 영상 36개)

### SDK 참고
- `user_metadata` (snake_case): SDK `.list()`, `.retrieve()` 응답에서 사용
- `userMetadata` (camelCase): SDK `.update()`, `.create()` 요청에서 사용

## Resume Commands
```bash
# JW Player → TwelveLabs 단건 업로드+분석
node scripts/jw-to-tl-test.js tNNiIpzO

# 강제 재처리 (기존 삭제 후 재업로드)
node scripts/jw-to-tl-test.js tNNiIpzO --force

# GCS 접근 확인
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
gsutil ls gs://videos_from_ask | head -20

# Git: feature branch
git checkout feature/jwplayer-integration
# YouTube 버전 복구: git checkout v1-youtube

# 앱 개발 서버
cd app && npm run dev
```

## Open Questions
1. JW Player에 86,000개 전체가 등록되어 있나? (API key로 확인 필요)
2. GCS 파일명과 JW Player media ID 간 매핑이 존재하나?
3. External video의 `m.adland.tv` URL은 GCS에서 서빙되는 건가?
4. 두 TL 인덱스 (YT경로 vs JW경로)를 통합할 것인가, 분리 유지할 것인가?
