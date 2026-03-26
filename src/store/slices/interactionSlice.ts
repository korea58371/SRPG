import type { StoreSlice, InteractionSlice } from './storeTypes';
import { MAP_CONFIG, PLAYER_FACTION } from '../../constants/gameConfig';
import { calcMoveRange, findMovePath } from '../../utils/moveRange';
import { tileToPixel, buildTileSets } from '../gameStore';
import { _moveThenAct, _resolveSkill } from '../../engine/skillEngine';

// 터치/마우스 이벤트 중복 발동으로 인한 빠른 더블클릭 오작동 방지용 타이머
let lastSelectTime = 0;

export const createInteractionSlice: StoreSlice<InteractionSlice> = (set, get) => ({
  selectedUnitId: null,
  moveRangeTiles: new Set(),
  hoveredMoveTile: null,
  hoveredMapTile: null,
  hoveredMapPixel: null,
  previewPath: [],
  confirmedDestination: null,
  confirmedPath: [],
  isMoveAnimating: false,
  moveOrigin: null,
  combatLog: [],
  floatingDamages: [],
  battleResult: null,
  attackTargetMode: false,
  skillTargetMode: false,
  selectedSkillId: null,
  hoveredUnitId: null,
  fieldMenuPos: null,
  unitListModalOpen: false,
  heroListModalOpen: false,
  isCameraLocked: false,
  openFieldMenu: (pos) => set({ fieldMenuPos: pos }),
  closeFieldMenu: () => set({ fieldMenuPos: null }),
  setUnitListModalOpen: (isOpen) => set({ unitListModalOpen: isOpen }),
  setHeroListModalOpen: (isOpen) => set({ heroListModalOpen: isOpen }),
  setIsCameraLocked: (locked: boolean) => set({ isCameraLocked: locked }),

  clearBattleResult: () => set({ battleResult: null }),
  setHoveredUnitId: (id) => set({ hoveredUnitId: id }),
  removeFloatingDamage: (id) => set(s => ({ floatingDamages: s.floatingDamages.filter(d => d.id !== id) })),
  
  enterAttackTargetMode: () => set({ attackTargetMode: true, skillTargetMode: false, selectedSkillId: null }),
  enterSkillTargetMode: (skillId) => set({ skillTargetMode: true, selectedSkillId: skillId, attackTargetMode: false }),
  cancelSkillTargetMode: () => set({ skillTargetMode: false, selectedSkillId: null }),

  selectUnit: (id) => {
    lastSelectTime = Date.now();
    const s = get();
    if (!id || !s.mapData) {
      set({ selectedUnitId: null, moveRangeTiles: new Set(), previewPath: [] });
      return;
    }
    const unit = s.units[id];
    if (!unit || unit.factionId !== PLAYER_FACTION || unit.state === 'DEAD') {
      set({ selectedUnitId: id, moveRangeTiles: new Set(), previewPath: [] });
      return;
    }
    const { friendlyTiles, enemyTiles } = buildTileSets(s.units, id);
    const range = calcMoveRange(
      unit.logicalX, unit.logicalY, unit.moveSteps,
      s.mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
    );
    set({ selectedUnitId: id, moveRangeTiles: range, previewPath: [] });
  },

  setHoveredMoveTile: (tile) => {
    const s = get();
    if (!s.selectedUnitId || !s.mapData || !tile) {
      set({ previewPath: [], hoveredMoveTile: null });
      return;
    }
    const unit = s.units[s.selectedUnitId];
    if (!unit) return;

    if (!s.moveRangeTiles.has(`${tile.lx},${tile.ly}`)) {
      set({ previewPath: [], hoveredMoveTile: null });
      return;
    }

    const { friendlyTiles, enemyTiles } = buildTileSets(s.units, s.selectedUnitId);
    const path = findMovePath(
      unit.logicalX, unit.logicalY, tile.lx, tile.ly, unit.moveSteps,
      s.mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles,
    );
    set({ previewPath: path, hoveredMoveTile: tile });
  },

  setHoveredMapTile: (tile) => set({ hoveredMapTile: tile }),
  setHoveredMapPixel: (pixel) => set({ hoveredMapPixel: pixel }),

  confirmMove: (lx, ly) => {
    // [BUG FIX] 유닛 선택 직후 너무 빠르게 제자리 이동(확정)이 중복 처리되는 것을 방지
    if (Date.now() - lastSelectTime < 300) return;

    const s = get();
    if (!s.selectedUnitId) return;
    if (s.selectedUnitId !== s.activeUnitId) return; // [BUG FIX] 자신의 턴이 아닌 유닛 조작 차단
    
    const unit = s.units[s.selectedUnitId];
    if (!unit) return;

    let path = [...s.previewPath];
    if (path.length === 0 || path[path.length - 1].lx !== lx || path[path.length - 1].ly !== ly) {
      if (s.mapData) {
        const { friendlyTiles, enemyTiles } = buildTileSets(s.units, s.selectedUnitId);
        path = findMovePath(
          unit.logicalX, unit.logicalY, lx, ly, unit.moveSteps,
          s.mapData, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, friendlyTiles, enemyTiles
        );
      }
    }
    if (path.length === 0) path.push({ lx, ly });
    
    const px = tileToPixel(lx);
    const py = tileToPixel(ly);
    const origin = { lx: unit.logicalX, ly: unit.logicalY, px: unit.x, py: unit.y };
    const movePath = path.slice(1);

    set((s2) => ({
      confirmedDestination: { lx, ly },
      confirmedPath: path,
      hoveredMoveTile: null,
      previewPath: [],
      isMoveAnimating: true,
      moveOrigin: origin,
      units: {
        ...s2.units,
        [s.selectedUnitId!]: {
          ...s2.units[s.selectedUnitId!],
          logicalX: lx,
          logicalY: ly,
          targetX: px,
          targetY: py,
          movePath,
          state: movePath.length > 0 ? 'MOVING' : 'IDLE',
        }
      }
    }));

    if (movePath.length > 0) {
      const durationMs = movePath.length * 70 + 100;
      setTimeout(() => {
        set({ isMoveAnimating: false });
      }, durationMs);
    } else {
      set({ isMoveAnimating: false });
    }
  },

  cancelConfirmedMove: () => set((s) => {
    const payload: any = {
      confirmedDestination: null,
      confirmedPath: [],
      attackTargetMode: false,
      skillTargetMode: false,
      selectedSkillId: null,
      isMoveAnimating: false,
      moveOrigin: null,
    };
    if (s.moveOrigin && s.selectedUnitId) {
      const origin = s.moveOrigin;
      payload.units = {
        ...s.units,
        [s.selectedUnitId]: {
          ...s.units[s.selectedUnitId],
          logicalX: origin.lx,
          logicalY: origin.ly,
          x: origin.px,
          y: origin.py,
          targetX: origin.px,
          targetY: origin.py,
          state: 'IDLE',
          movePath: []
        }
      };
    }
    return payload;
  }),

  // 엔진 호출 래핑 액션들
  executeAction: (action) => {
    const s = get();
    const { selectedUnitId, confirmedDestination, units } = s;
    if (!selectedUnitId || !confirmedDestination) return;

    const unit = units[selectedUnitId];
    if (!unit) return;

    const dest = confirmedDestination;
    const px = tileToPixel(dest.lx);
    const py = tileToPixel(dest.ly);

    if (action === 'WAIT') {
      set({ moveOrigin: null });
      // 대기 시 MP 10 회복 (최대치 초과 불가)
      const newMp = Math.min(unit.maxMp, unit.mp + 10);
      const updatedUnit = { ...unit, mp: newMp };
      set((s) => ({
        units: { ...s.units, [selectedUnitId]: updatedUnit }
      }));
      _moveThenAct(selectedUnitId, updatedUnit, dest, px, py, [], null, null);
    } else if (action === 'ATTACK') {
      get().enterAttackTargetMode();
    } else if (action === 'CANCEL') {
      get().cancelConfirmedMove();
    }
  },

  executeAttackOnTarget: (targetId) => {
    const s = get();
    const { selectedUnitId, confirmedDestination, units } = s;
    if (!selectedUnitId || !confirmedDestination) return;
    const unit = units[selectedUnitId];
    if (!unit) return;

    const dest = confirmedDestination;
    const px = tileToPixel(dest.lx);
    const py = tileToPixel(dest.ly);

    set({ attackTargetMode: false, moveOrigin: null });
    // 평타(일반 공격)는 'basic-attack' 스킬로 통합 처리됩니다.
    const targetUnit = units[targetId];
    if (!targetUnit) {
      get().cancelConfirmedMove();
      return;
    }
    _moveThenAct(selectedUnitId, unit, dest, px, py, [], { lx: targetUnit.logicalX, ly: targetUnit.logicalY }, 'basic-attack');
  },

  executeSkillOnTarget: (targetTile) => {
    const s = get();
    const { selectedUnitId, selectedSkillId, units, confirmedDestination } = s;
    if (!selectedUnitId || !selectedSkillId || !confirmedDestination) return;

    const unit = units[selectedUnitId];
    if (!unit) return;

    const dest = confirmedDestination;
    const px = tileToPixel(dest.lx);
    const py = tileToPixel(dest.ly);

    set({ skillTargetMode: false, selectedSkillId: null, attackTargetMode: false, moveOrigin: null });
    _moveThenAct(selectedUnitId, unit, dest, px, py, [], targetTile, selectedSkillId);
  }
});
