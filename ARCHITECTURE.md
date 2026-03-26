# Web SRPG 엔진 아키텍처 & 개발 가이드

이 문서는 AI 웹 기반 SRPG 프로젝트의 아키텍처 개요와 개발 철학을 설명합니다. **새로운 기능을 구현하기 전에 이 컨텍스트를 반드시 숙지하고 컴포넌트 역할을 침범하지 마십시오.**

---

## 🏗️ 1. 아키텍처 설계 사상 (Separation of Concerns)

프로젝트는 React 기반의 생태계에서 PIXI.js의 성능적 이점을 취하되, 유지보수를 위해 **Model(Data) - View(Rendering) - Controller(Interaction) - Engine(Logic)** 의 책임을 철저히 나눕니다.

### 1-1. 게임 상태 (Store & Model)
- **위치**: `src/store/` 
- **설명**: Zustand를 기반으로 구동되며, 게임에 필요한 모든 **순수 데이터(State)**를 관장합니다. 유닛의 위치(logicalX, logicalY), HP, 턴 등 논리적 객체만 다룹니다.
- **철칙**: 이곳에는 렌더링에 필요한 View 데이터(HTML 요소 조작 등)나 비동기 화면 타임아웃 이벤트(`setTimeout`으로 애니메이션 강제 조작 등)를 최대한 배제합니다. 상태를 결합하는 Slice 패턴으로 나뉘어져 관리됩니다.

### 1-2. 전투 및 시스템 로직 (Engine)
- **위치**: `src/engine/` (예: `combatEngine.ts`, `skillEngine.ts`, `aiEngine.ts`)
- **설명**: 데미지 수치 산출, 스킬 범위(AoE) 판별, AI의 최단 경로 BFS 탐색, 충돌 및 상태 이상 처리를 수행하는 **순수 함수 집합**입니다.
- **철칙**: 엔진 내부는 상태(`get()`, `set()`)를 읽고 바꿀 수 있지만, UI에 직접 관여하지 않습니다. 

### 1-3. 뷰와 렌더링 (View & PixiJS)
- **위치**: `src/components/`, `src/App.tsx`
- **설명**: Store를 Subscribing 하여 화면에 보여주는 **수동적인** 렌더러들입니다.
- **동기화**: `ReactPixi`를 통해 상태가 바뀌면 View가 자동으로 업데이트됩니다. 
- **애니메이션**: 픽셀 이동(픽셀상 `x`, `y`)은 컴포넌트 내의 애니메이션 루프(`useTick`)에서 Store의 `targetX`, `targetY`를 추적하는 간선 보간(Interpolation) 연산을 거쳐 부드럽게 자체 렌더링 됩니다.

### 1-4. 상호작용 매니저 (Controller & Interaction)
- **위치**: `src/hooks/useInteractionManager.ts` 등에 집중
- **설명**: 마우스 클릭, 우클릭, 키보드 선택 등 사용자 조작의 맥락(Context)을 이해하고, 모드(이동 모드, 스킬 모드, 공격 모드)에 따른 분기를 담당합니다.
- **철칙**: `App.tsx` 등 그리기 전담 컴포넌트 안에 100줄이 넘는 클릭 `if` 분기문을 두지 마십시오. 모든 판별 처리 후 `store.executeAction(...)` 같은 단일 액션만 트리거해야 합니다.

---

## 📏 2. 핵심 시스템 명세

### 2-1. 단위 좌표계 (Logical vs View)
- 모든 유닛과 지형은 `(lx, ly)`라는 논리 정수 좌표 배열 데이터를 지닙니다. 논리적 거리 판별, 사거리, 충돌은 **무조건 Logical 기준**입니다.
- 화면 표시는 `tileToPixel()` 함수 등을 통해 화면 좌표 x, y로 매핑되며, Isometric(쿼터뷰) 변환 매트릭스(`scale(1, 0.5) * rotate(45)`)는 최상위 `Container(App.tsx 레이어)`에서 전역적으로 렌더러에 한번만 스냅되어 출력됩니다.

### 2-2. 턴 시스템 (CT - Charge Time)
- 이 게임은 Round 방식이 아니라 **CT(Charge Time) 기반 개별 턴제**입니다.
- 턴 게이지가 100에 도달하면 해당 유닛이 `ActiveUnit`으로 배정받습니다.

---

## ⛔ 3. 안티패턴 및 절대 금지 규칙

1. **하드코딩 및 뗌빵 금지** : 만약 클릭이 먹히지 않거나 애니메이션이 느리다고 해서 컴포넌트 안에 강제로 `style.left = ...` 하거나 UI 레이어가 아닌 Store에서 `if (bug) setTimeout(...)` 등을 쑤셔 넣지 마십시오. 원천 레이어의 데이터 파이프라인(Store 갱신 -> View 관찰)을 쫓아가서 근원을 고쳐야 합니다.
2. **God Object (거대 파일) 지양** : 파일 덩치가 400~500줄을 넘어간다면, 그것이 더 작은 컴포넌트, 훅, 슬라이스로 나뉠 수 없는지부터 확인하십시오.
3. **무분별한 강결합** : 스킬 클래스를 추가할 때 대상 계산법을 UI 파일(`Menu.tsx`)에 넣지 마십시오. Engine이나 Util 레벨에서만 작성되어야 합니다.
