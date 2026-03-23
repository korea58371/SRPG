# 대규모 단위 전쟁 SRPG 아키텍처 및 개발 표준

이 문서는 AI 기반 개발(Vibe Coding)을 위해 작성된 J:\AI\Game\SRPG 프로젝트의 뼈대이자 지침서입니다. 향후 AI는 코드를 작성하기 전 반드시 이 문서를 최우선으로 검토하고, **하드코딩 배제** 및 **모듈화 원칙**을 엄격히 준수합니다.

## 1. 개발 핵심 원칙 (Core Principles)
1. **로직과 렌더링의 분리 (Decoupling)**: 
   - 게임 상태(HP, 위치, 턴, 상성) 등 순수 로직은 `src/store` 또는 독립 모듈 클래스/함수에 위치합니다.
   - `PIXI.Sprite` 및 React 컴포넌트는 오로지 데이터를 받아 렌더링하고 시각적 이펙트를 처리하는 데 집중합니다.
2. **하드코딩 절대 금지 (No Hardcoding)**: 
   - 맵 사이즈, 유닛 속도, 컬러 값, 애니메이션 타이밍 등 모든 매직 넘버(Magic Numbers)는 `src/constants/gameConfig.ts` 중앙 설정 파일에서 관리합니다.
   - 각 모듈은 이 설정 파일의 변수를 참조해야 합니다.
3. **병렬 최적화 렌더링**: 
   - 대규모 150+ 개체 렌더링 시 React의 상태(`useState`, `setState`) 기반의 위치 업데이트는 프레임 드랍을 일으키므로 금지합니다.
   - 시각 좌표 제어는 반드시 `PixiJS`의 `useTick`과 `useRef(Pixi.Sprite)`를 통한 직접 변이(Mutation) 방식으로 구현하여 O(1) 비용 처리 및 Y-Sort 정렬을 지원해야 합니다.
4. **결함 전파 최소화 (Isolation)**: 
   - 파일은 단일 책임 원칙(SRP)에 따라 최대한 분리하고 기능 단위로 작게 쪼갭니다(`mapGenerator.ts`, `pathfinding.ts`, `combatLogic.ts` 등).
   - 에러가 나면 해당 시스템만 다운되도록 예외 처리(Error Boundary)를 적용합니다.

## 2. 디렉토리 아키텍처 (Directory Structure)
\`\`\`text
src/
 ├── constants/       # 게임 내 모든 매직넘버, 글로벌 상수 (gameConfig.ts, terrainColors.ts 등)
 ├── types/           # 전역 TypeScript 데이터 타입 및 인터페이스 명세 (gameTypes.ts)
 ├── store/           # Zustand 기반의 게임 로직 상태 관리소 (UI 반영, 턴 제어 등)
 ├── utils/           # 범용 혹은 수학적 유틸리티 함수 모음 (pathfinding.ts, simplex.ts)
 ├── systems/         # 핵심 기획 로직 (세력 판도 계산, 전투 상성 데미지 모델 등)
 ├── components/      # 시스템을 시각적으로 구현하는 React/PixiJS 컴포넌트 
 │    ├── rendering/  # PixiJS Canvas 안에 들어가는 실제 렌더 요소 (Terrain, Units...)
 │    └── ui/         # HUD 및 일반 React DOM 요소 (메인 메뉴, 미니맵, 상태창)
 └── App.tsx          # 애플리케이션 진입점 및 Stage 랩퍼
\`\`\`

## 3. 기술 스택 요약 및 환경 설정
* **빌드 프레임워크**: Vite + React(v18) + TypeScript
* **그래픽 엔진**: PIXI.js (v7) + @pixi/react (v7) -> *호환성 유지를 위해 v18/v7 고정*
* **CSS/Style**: TailwindCSS (v4)
* **상태 관리**: Zustand (추가 예정)
* **절차적 맵 알고리즘**: Simplex-Noise, A* Pathfinding

---
**[수정 이력]**
- 2026-03-24: Vibe Coding 환경을 위한 초기 아키텍처 설계 수립 및 지침 문서 추가.
