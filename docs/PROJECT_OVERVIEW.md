# 알까기: 시공의 판 — 프로젝트 종합 현황

PC 웹용 3D 캐릭터 알까기 게임의 제작 문서와 구현 현황입니다. 현재 프로젝트는 **게임의 재미와 공정성을 먼저 검증하고, Web3 출금은 법률·등급분류·보안 검토 뒤 별도 단계로 여는 것**을 전제로 합니다.

## 가장 먼저 읽을 문서

1. [마스터 시나리오](01-master-scenario.md)
2. [핵심 규칙과 모드](02-core-gameplay-and-modes.md)
3. [출시 캐릭터 10종](03-launch-roster.md)
4. [아레나·아트·오디오·타격감](04-arenas-art-audio-impact.md)
5. [Web3 경제·안전·출시 게이트](05-web3-economy-and-safety.md)
6. [MVP 제작 로드맵](06-mvp-roadmap.md)
7. [결정사항과 열린 질문](07-decisions-and-open-questions.md)
8. [구현용 오디오 이벤트 명세](../specs/audio-events.csv)
9. [다국어 비주얼 콘셉트북 HTML](../public/ALKAGI_CONCEPT_BOOK.html)
10. [이미지 자산·재생성 프롬프트](08-visual-concept-assets-and-prompts.md)
11. [알까기 핵심 게임성 V2 — 턴·파워·추락·음성](09-core-gameplay-revision-v2.md)
12. [HTML5 엔진·네트워크 아키텍처 V1](10-html5-engine-and-network-architecture.md)
13. [플레이 가능한 HTML5 세로 슬라이스](../public/play/index.html)
14. [실제 WebGL 3D 제작 엔진 착수 V1](11-production-engine-start-v1.md)
15. [실제 3D 아레나 실행 화면](../app/arena/page.tsx)
16. [실제 게임 제작 순서와 단계별 완료 기준](12-production-development-order.md)
17. [경기 이벤트 로그·3D 리플레이 V1](13-match-event-log-and-replay-v1.md)
18. [원화 캐릭터 10종 3D 경기 통합](14-concept-character-3d-integration.md)
19. [원화 기반 3D 모델 패스와 와이드 아레나 밸런스](15-3d-model-pass-and-wide-arena-balance.md)
20. [최초 원화 보존형 3D 경기 — 흑백 팀·스킬·사운드](16-original-art-black-white-skills-audio.md)

## 프로젝트 전용 스킬

- [`design-alkkagi-game`](../skills/design-alkkagi-game/SKILL.md): 물리 규칙, 세계관, 캐릭터, 모드, 밸런스, MVP를 일관되게 설계합니다.
- [`direct-game-feel-audio`](../skills/direct-game-feel-audio/SKILL.md): 충돌음, 음악, VFX, 카메라, 히트스톱과 접근성을 하나의 타격감 시스템으로 설계합니다.

두 스킬은 3D 알까기 제작 요구에 맞춰 프로젝트 전용으로 구성하고 검증했습니다.

## 현재 상태

- 단계: 프리프로덕션 + 플레이 가능한 HTML5 버티컬 슬라이스
- 작업명: **알까기: 시공의 판** (`ALKKAGI: Rift Board`)
- 플랫폼: 데스크톱 브라우저 우선
- 핵심 모드: 싱글 캠페인, 연습/퍼즐, 캐주얼 PvP, 랭크 PvP
- 기본 지급: 동일 성능의 무명석 8개
- 초기 캐릭터: 기본 1종 + 개성형 9종
- Web3: 게스트 플레이 우선, 지갑 선택 사항, 현금성 출금은 MVP 이후 규제·보안 게이트
- 구현 완료: 3:3·5:5, 20초 배치, 랜덤 선공, 보너스 샷, 능력치 물리, 원소 VFX/SFX, AI 레벨 1–10
- 서버 기반: D1 프로필·테스트 포인트·XP·레벨·LV ±2 매칭 큐·최근 10경기 리플레이
- 실제 3D 엔진: Three.js/WebGL 장면, 3D 캐릭터 돌, 120Hz 충돌, 레이캐스트 조준, 원소 VFX, 지옥 AI 경기
- 경기 기록: 배치와 모든 샷을 버전형 이벤트 로그로 저장하고 로비에서 실제 3D 물리로 다시보기
- 원화 캐릭터: 최초 콘셉트 10종을 3D 데칼·입체 장비·선택 원화 UI로 실제 5:5 경기에 통합
- 3D 모델 패스 V2: 둥근 석재 몸체·입체 얼굴·캐릭터별 장비와 새 PBR 렌더 시트를 적용
- 와이드 아레나: 플레이 면적 약 56% 확대, 충돌 반발 완화, 가장자리 그립 존으로 링아웃 난이도 상향
- 원화 보존형 경기: 최초 10종 캐릭터와 위험 배경을 사용하고 원형 아레나 문양을 실제 3D 재질로 재구성
- 팀 식별: 매 경기 흑돌·백돌 진영 무작위 배정, 몸체·팀 밴드·HUD·생존 표시를 통일
- 캐릭터 스킬: 10종 전부 추진·중량·회전·그립·구조·조준 효과를 실제 물리에 연결
- 오디오: 전체·효과음·음악 3채널 믹서, 속성별 타격 레이어와 3D 충격파 구현

실시간 양자간 경기 동기화, 캐릭터별 독립 GLB 리깅·표정 애니메이션, 상점·업그레이드와 규제 검토를 마친 정산 시스템은 다음 제작 단계입니다.
