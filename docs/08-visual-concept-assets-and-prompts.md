# 비주얼 콘셉트 자산과 재생성 프롬프트

## 제작 경로

- 제작일: 2026-08-06
- 생성 모드: Codex 내장 `imagegen` 경로
- 요청 모델 방향: GPT Image 계열의 고품질 3D 콘셉트 생성
- Higgsfield: 현재 실행 환경에 커넥터가 없어 호출하지 못함
- 원칙: 이미지 안의 글자는 소셜 카드 외에는 사용하지 않고, 7개 언어 문구는 HTML에서 렌더링
- 기준 이미지: `concept-site/public/assets/key-art.png`

Higgsfield가 연결되면 아래 자산별 프롬프트에 `key-art.png`를 스타일 참조 이미지로 첨부해 같은 세트로 재생성한다.

## 공통 비주얼 잠금

- 프리미엄 3D 미니어처 디오라마와 수집형 피규어 재질
- 흑요석, 상아, 오래된 황동, 네온 시안/마젠타, 오로라 민트/보라
- 둥근 돌 캐릭터의 바닥 판정 크기는 모두 동일
- 의상과 액세서리는 원형 바닥 판정을 바꾸지 않음
- 표정은 크고 명확하지만 돌의 매끈한 둥근 실루엣을 유지
- 원작·상표·로고·워터마크·실제 방송 캐릭터 모방 금지
- 경쟁 판 위에는 랜덤 장애물, 격자, 손, 인간, 읽을 수 없는 장식 글자를 넣지 않음

## 자산 목록

| 파일 | 용도 | 핵심 프롬프트 |
|---|---|---|
| `key-art.png` | 웹 히어로·브랜드 기준 | 세 시대가 만나는 원형 시공의 판, 흑/백 8대8, 브릭 경·비트캣·오로라-8 전경, 3/4 탑다운, 중세 금빛·현대 네온·미래 오로라 조명 |
| `character-roster.png` | 출시 캐릭터 10종 | 어두운 스튜디오에서 2열×5개, 몽돌·브릭 경·루나벨·핀치·모모·비트캣·세이프티 박사·제로-볼트·코멧 키드·오로라-8, 동일 크기와 간격, 텍스트 없음 |
| `board-topdown.png` | 표준 보드 설계 | 거의 직교인 탑다운 원형 흑요석 판, 황동 경계, 중앙 메달, 8대8 대칭 배치 마커, 낙하 경계가 보이고 격자 없음 |
| `arena-medieval.png` | 중세 아레나 | 스테인드글라스의 석양, 오래된 황동, 촛불, 미니어처 관중, 판 전체가 보이는 높은 3/4 게임 카메라 |
| `arena-modern.png` | 현대 아레나 | 비가 막 그친 네온 옥상, 청록·자홍 도시 반사와 드론, 판 위는 건조하고 조준이 선명함 |
| `arena-future.png` | 미래 아레나 | 행성 새벽선과 유리 온실, 백색 세라믹, 오로라, 빛 식물, 시각은 무중력이나 판의 표준 중력 유지 |
| `ui-lobby.png` | 게임 로비 | 왼쪽 7개 아이콘 내비게이션, 중앙 캐릭터/시공의 판, 오른쪽 프로필·시즌·파티·아레나, 하단 큰 플레이 진입 |
| `ui-battle.png` | 전투 HUD | 보드 중심을 비우고 외곽 8대8 상태, 상단 턴 타이머, 하단 캐릭터·5능력치·파워·회전·접촉선 |
| `ui-collection.png` | 캐릭터/상점 | 왼쪽 10종 그리드, 중앙 3D 미리보기, 오른쪽 5각 능력치·마스터리·코스메틱·직접 구매, 랜덤 상자 없음 |
| `items-skills.png` | 능력치·아이템 | 4×4 아이콘 시트: 추진·중량·내구·정밀·회전과 튜닝 키·궤적·코어·왕관·표정·재질·시즌·리플레이·체험 아이템 |
| `og.png` | 공유용 소셜 카드 | 키아트 정체성을 유지하고 왼쪽에 `ALKKAGI: RIFT BOARD`를 정확히 한 번 표기한 16:9 카드 |

### 핵심 게임성 V2 추가 자산

| 파일 | 용도 | 핵심 프롬프트 |
|---|---|---|
| `arena-medieval-danger-v2.png` | 중세 위험 배경 | 기존 판과 카메라를 유지하고 판 아래를 쇠사슬·용암 강·거대 화구·무너진 다리·용의 그림자가 보이는 왕들의 용광로 심연으로 교체 |
| `arena-modern-danger-v2.png` | 현대 위험 배경 | 기존 판과 카메라를 유지하고 난간 없는 초고층 정비탑, 수천 미터 아래 차량 불빛, 번개, 케이블과 드론으로 낙하 깊이를 강조 |
| `arena-future-danger-v2.png` | 미래 위험 배경 | 기존 판과 카메라를 유지하고 판 아래 보라색 중력 소용돌이, 정거장 파편, 탈출정과 우주 깊이를 배치 |
| `ui-battle-core-v2.png` | 핵심 전투 조작 HUD | 선택 돌의 후방 당기기 핸들, 점선 초기 궤적, 첫 접촉 마커, 파랑·금색·빨강 0–100/MAX 파워, 미세 조절 링, 보너스 샷 아이콘, 8대8 상태와 세 시대 심연 |

```text
Core gameplay visual lock: the player selects one cute round stone, pulls backward opposite the shot like a slingshot or billiards cue, adjusts deterministic power from 0 to 100, then releases. Show blue control, gold heavy, red MAX, a first-contact marker, survivor pips, active turn, and a bonus-shot icon that stays lit after an opponent falls. Beneath the board, always show a frightening but family-friendly abyss with strong depth cues. No gore, no fake paragraph text, no logo, no watermark, and no obstruction over the aiming lane.
```

## 키아트 전체 프롬프트

```text
Original key art for a Korean-inspired 3D flicking-stone arena game. A circular black stone board is suspended where three eras meet: warm medieval castle, rainy neon rooftop, orbital aurora garden. Eight expressive black stones face eight ivory stones. Foreground heroes: compact brass knight helmet, neon cat-ear headphones, aurora halo. High-end stylized 3D cinematic, premium collectible materials, three-quarter top-down gameplay-readable camera, 16:9. Obsidian, ivory, antique brass, neon cyan, magenta, aurora mint. No text, logo, watermark, Go grid, hands or humans. All pieces have identical circular footprints.
```

## 캐릭터 로스터 전체 프롬프트

```text
Ten original anthropomorphic round stone characters in two clean rows of five on a dark navy studio background: plain balanced rookie, stout brass knight, violet crescent moon witch, clockwork inventor with wind-up key, delivery rider with compact helmet, cyan-magenta music cat headphones, safety professor with yellow hard hat, future bolt guardian with cyan seams, comet racer with orange crest, aurora guide with eight short halo petals. Same premium PBR collectible style as the key art. Equal scale, identical circular footprints, no text, no duplicate design, no cropped character.
```

## UI 프롬프트 잠금

```text
Use realistic production-ready PC game UI, not loose concept art. Dark translucent glass, stone and brass frames, cyan-magenta focus, 16:9 desktop hierarchy. Keep practical control sizes and reserve blank zones for HTML localization. Do not render words, prices, logos, loot boxes, gambling cues or UI over the gameplay aiming area.
```

## 검증 기록

- 최초 생성 이미지 10장, 핵심 게임성 V2 이미지 4장, 소셜 카드 1장 모두 알까기 폴더 내부에 복사함
- 로스터 한 장에 서로 다른 캐릭터 10종이 2×5로 존재함
- 탑다운 보드에 검은 돌 8개와 흰 돌 8개가 존재함
- 세 아레나의 판은 원형·평면·동일한 경쟁 표면으로 읽힘
- 소셜 카드 문구 `ALKKAGI: RIFT BOARD` 철자를 확인함
- UI·아이템 이미지는 텍스트를 제외하여 7개 언어 HTML에 재사용 가능
- V2 전투 HUD에서 후방 당기기, 짧은 조준선, 첫 접촉점, 0–100/MAX 게이지와 보너스 샷 아이콘을 확인함
- V2 아레나 3장에서 판 아래의 용광로·초고층·중력 소용돌이와 낙하 깊이를 확인함
