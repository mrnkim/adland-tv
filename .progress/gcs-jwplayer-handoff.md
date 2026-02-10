# Handoff: GCS Bucket + JW Player Integration

## Status: Paused (2026-02-10)

## What's Done
- [x] Google Cloud SDK 설치 (`gcloud`, `gsutil`)
- [x] GCS 인증 완료 (`gcloud auth login`)
- [x] `gs://videos_from_ask` 버킷 접근 확인 → **86,260개 파일**
- [x] Super Bowl 파일명 검색 → 227개 매칭
- [x] JW Player 계정 초대 받음 (ari@marketecture.tv → content editor)
- [x] Super Bowl 2026 광고 34개 TwelveLabs 인덱싱 완료 (adland-agent)

## What's Next
- [ ] JW Player 계정 생성 (초대 이메일 "GET STARTED" 클릭)
- [ ] JW Player 대시보드에서 API key/secret 생성
- [ ] JW Player API로 미디어 라이브러리 탐색 (메타데이터 확인)
- [ ] GCS 파일명 ↔ JW Player media ID 매핑 방법 파악
- [ ] 앱에서 JW Player 임베드 재생 구현

## Architecture Overview

```
GCS Bucket (gs://videos_from_ask)     JW Player (CDN + Player)
  86,260 raw video files                 Media library with metadata
  대부분 숫자 ID 파일명                     title, tags, description
         │                                        │
         └──── 매핑 필요 (GCS filename ↔ JW media ID) ────┘
                            │
                     TwelveLabs Index
                  (search, analysis, embeddings)
```

## Key Info

### GCS Bucket
- **Bucket**: `gs://videos_from_ask`
- **Files**: 86,260개 mp4/mov
- **Access**: gsutil 인증 완료 (Miranda 계정)
- **파일명 패턴**:
  - 숫자 ID: `00_10700_hd.mp4` (대다수, 메타데이터 없음)
  - 제목 기반: `videos_original_budweiser_2017_super_bowl_commercial_born_the_hard_way.mp4`
  - 기타: `y2mate.com_-_heinz.mp4`, `wwwffarm.mp4`
- **PATH 필요**: `export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"`

### JW Player
- **Player script**: `https://cdn.jwplayer.com/players/{mediaId}-{playerId}.js`
- **Player ID**: `19i2Zbpi` (adland.tv 설정)
- **Sample media ID**: `tNNilpzO`
- **API docs**: https://docs.jwplayer.com/platform/reference/
- **Dashboard**: https://dashboard.jwplayer.com
- **Media API**: `GET /v2/media/?q=super bowl` (API key 필요)

### Super Bowl 2026 (adland-agent 완료)
- 34/35 완료 (Tecovas 1개 실패 - YouTube에 없음)
- Progress: `.progress/2026-super-bowl-lx-commercials.json`
- 이건 YouTube → TwelveLabs 경로. GCS/JW Player 경로와 별개.

## Resume Commands
```bash
# GCS 접근 확인
export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
gsutil ls gs://videos_from_ask | head -20

# Super Bowl 파일 검색
gsutil ls gs://videos_from_ask | grep -i "super.bowl" | wc -l

# JW Player API 테스트 (API key 생성 후)
curl -H "Authorization: Bearer {API_KEY}" \
  "https://api.jwplayer.com/v2/sites/{SITE_ID}/media/?q=super+bowl&page_length=10"
```

## Open Questions
1. JW Player에 86,000개 전체가 등록되어 있나? 아니면 일부만?
2. GCS 파일명과 JW Player media ID 간 매핑이 존재하나?
3. JW Player 메타데이터에 카테고리/태그가 있나? (Super Bowl, 브랜드 등)
4. 최종 목표: 앱에서 JW Player로 재생? GCS에서 직접 TwelveLabs 인덱싱? 둘 다?
