import { useCallback } from 'react';
import { useGameStore, getAttackableTargets } from '../store/gameStore';
import { MAP_CONFIG, PLAYER_FACTION } from '../constants/gameConfig';
import { isSkillTargetValid, MOCK_SKILLS } from '../utils/skillTargeting';

export function useInteractionManager() {
  const onTileClick = useCallback((lx: number, ly: number) => {
    const store = useGameStore.getState();
    const tileId = `${lx},${ly}`;

    // 1. 공격 타겟 모드
    if (store.attackTargetMode && store.confirmedDestination && store.selectedUnitId) {
      const attacker = store.units[store.selectedUnitId];
      if (!attacker) return;
      
      const dest = store.confirmedDestination;
      const validTargets = getAttackableTargets(attacker, store.units, dest.lx, dest.ly);
      const target = validTargets.find(t => t.logicalX === lx && t.logicalY === ly);
      
      if (target) {
        store.executeAttackOnTarget(target.id);
      }
      return;
    }

    // 2. 스킬 타겟 모드 (AoE 타겟팅)
    if (store.skillTargetMode && store.selectedUnitId && store.selectedSkillId) {
      const caster = store.units[store.selectedUnitId];
      const skill = MOCK_SKILLS[store.selectedSkillId];
      if (!caster || !skill) return;

      const dest = store.confirmedDestination || { lx: caster.logicalX, ly: caster.logicalY };
      const validation = isSkillTargetValid(
        skill, dest, { lx, ly }, caster.factionId, store.units, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT, store.mapData || undefined
      );
      
      if (!validation.valid) {
        useGameStore.setState(s => ({ 
          combatLog: [`⚠️ ${validation.reason || '잘못된 타겟입니다.'}`, ...s.combatLog].slice(0, 8) 
        }));
        return;
      }

      store.executeSkillOnTarget({ lx, ly });
      return;
    }

    // [버그 수정] 이미 이동 확정(ActionMenu 대기 중) 상태라면 바닥 클릭으로 인한 중복 confirmMove를 무시함.
    if (store.confirmedDestination) {
      return;
    }

    // 3. 이동 가능 범위 타일 클릭 시 (이동 확정)
    if (store.moveRangeTiles.has(tileId)) {
      if (store.selectedUnitId === store.activeUnitId) {
        store.confirmMove(lx, ly);
      } else {
        store.selectUnit(null); // [UX 개선] 비활성 아군의 이동 범위를 클릭하면 선택 해제
      }
      return;
    }
    
    // 4. 그냥 맵 클릭 (아군 유닛 선택 여부 확인)
    const clickedUnit = Object.values(store.units).find(u => u.logicalX === lx && u.logicalY === ly && u.state !== 'DEAD');
    
    if (clickedUnit) {
      // 적군 유닛인 경우 정보만 보여주고 무시
      if (clickedUnit.factionId !== PLAYER_FACTION) return;
      
      // 이미 선택된 자신을 클릭한 경우 (제자리 이동 확정 처리)
      if (store.selectedUnitId === clickedUnit.id) {
        if (store.activeUnitId === clickedUnit.id) {
          store.confirmMove(lx, ly);
        }
        return;
      }
      
      // 다른 아군 유닛 선택
      store.selectUnit(clickedUnit.id);
      
      // 사방이 막혀서 바로 이동할 곳이 없다면 강제로 다음 페이즈(ActionMenu)로 진입
      setTimeout(() => {
        const st = useGameStore.getState();
        if (st.selectedUnitId === clickedUnit.id && st.activeUnitId === clickedUnit.id && st.moveRangeTiles.size === 0) {
          st.confirmMove(lx, ly);
        }
      }, 0);
      return;
    }

    // 5. 아무것도 해당하지 않는 빈 땅을 클릭했을 경우 선택 해제
    store.selectUnit(null);
  }, []);

  return { onTileClick };
}
