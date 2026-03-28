import type { StoreSlice, GameStateSlice } from './storeTypes';
import { TerrainType } from '../../types/gameTypes';
import type { Unit, UnitType, LevelObjective } from '../../types/gameTypes';
import { UNIT_CONFIG, BASE_STATS, PLAYER_FACTION, MAP_CONFIG, isPlayableTile } from '../../constants/gameConfig';
import { tileToPixel } from '../gameStore'; // Helper functions from Root store wrapper
import { useAppStore } from '../appStore';

export const createGameStateSlice: StoreSlice<GameStateSlice> = (set, get) => ({
  units: {},
  mapData: null,
  elevMap: null,
  mapObjects: [],
  cities: [],
  battleType: 'defensive',
  biome: null,
  victoryCondition: null,
  defeatCondition: null,

  setMapData: (mapData, elevMap, mapObjects) => set({ mapData, elevMap, mapObjects }),
  setCities: (cities) => set({ cities }),
  setBattleType: (type) => set({ battleType: type }),
  setBiome: (biome) => set({ biome }),

  initUnits: (mapWidth, mapHeight, attacker, defender) => {
    const battleType = get().battleType;
    const newUnits: Record<string, Unit> = {};
    const usedTiles = new Set<string>();

    const findValidEscapeTile = (startX: number, startY: number, stepX: number, stepY: number) => {
      const mapData = get().mapData;
      let cx = startX;
      let cy = startY;
      while (cx >= 0 && cx < MAP_CONFIG.WIDTH && cy >= 0 && cy < MAP_CONFIG.HEIGHT) {
        const terrain = mapData?.[cy]?.[cx] ?? TerrainType.SEA;
        const valid = terrain === TerrainType.GRASS || terrain === TerrainType.PATH || terrain === TerrainType.FOREST || terrain === TerrainType.BEACH;
        const playable = isPlayableTile(cx, cy, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
        if (playable && valid) return { lx: cx, ly: cy };
        cx += stepX;
        cy += stepY;
      }
      return { lx: Math.floor(MAP_CONFIG.WIDTH/2), ly: Math.floor(MAP_CONFIG.HEIGHT/2) };
    };

    // 배치 실패 시 (200회 랜덤 시도 후 유효 타일 미발견) 가장 가까운 유효 타일을 전체 스캔으로 탐색
    const findNearestValidTile = (preferX: number, preferY: number): { lx: number; ly: number } => {
      const mapData = get().mapData;
      let bestDist = Infinity;
      let best = { lx: Math.floor(MAP_CONFIG.WIDTH / 2), ly: Math.floor(MAP_CONFIG.HEIGHT / 2) };
      for (let y = 0; y < MAP_CONFIG.HEIGHT; y++) {
        for (let x = 0; x < MAP_CONFIG.WIDTH; x++) {
          const terrain = mapData?.[y]?.[x] ?? TerrainType.SEA;
          const validT = terrain === TerrainType.GRASS || terrain === TerrainType.PATH || terrain === TerrainType.FOREST || terrain === TerrainType.BEACH;
          const playable = isPlayableTile(x, y, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
          if (validT && playable && !usedTiles.has(`${x},${y}`)) {
            const dist = Math.abs(x - preferX) + Math.abs(y - preferY);
            if (dist < bestDist) { bestDist = dist; best = { lx: x, ly: y }; }
          }
        }
      }
      return best;
    };

    const getRandomType = (): UnitType => {
      const t: UnitType[] = ['INFANTRY', 'SPEARMAN', 'CAVALRY', 'ARCHER'];
      return t[Math.floor(Math.random() * t.length)];
    };

    if (battleType === 'cheat') {
      const cx = Math.floor(mapWidth / 2);
      const cy = Math.floor(mapHeight / 2);

      for (let i = 0; i < 10; i++) {
        const isHeroP = i < 3; 
        const typeP = getRandomType();
        const baseP = BASE_STATS[typeP] || BASE_STATS.INFANTRY;
        
        const isHeroE = i < 3;
        const typeE = getRandomType();
        const baseE = BASE_STATS[typeE] || BASE_STATS.INFANTRY;

        const pLx = cx - 2; const pLy = cy - 4 + i;
        const eLx = cx + 2; const eLy = cy - 4 + i;
        usedTiles.add(`${pLx},${pLy}`); usedTiles.add(`${eLx},${eLy}`);

        newUnits[`unit-p-${i}`] = {
          id: `unit-p-${i}`, factionId: attacker, unitType: typeP,
          hp: baseP.hp * (isHeroP ? 2 : 1), maxHp: baseP.hp * (isHeroP ? 2 : 1), attack: baseP.attack * (isHeroP ? 1.5 : 1), defense: baseP.defense, speed: baseP.speed, moveSteps: baseP.moveSteps, attackRange: baseP.attackRange, hasActed: false,
          mp: 100, maxMp: 100, rage: 0, morale: 100,
          skills: isHeroP 
            ? ['mock-cross', 'mock-line', 'mock-cone', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-nova', 'mock-dash-attack', 'mock-heal', 'mock-aoe-heal', 'mock-buff-atk', 'mock-debuff-def', 'mock-poison', 'mock-regen'] 
            : ['mock-single', 'mock-radius', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-nova', 'mock-dash-attack', 'mock-heal', 'mock-buff-atk', 'mock-debuff-def', 'mock-poison', 'mock-regen'],
          skillCooldowns: {}, skillCharges: {}, state: 'IDLE',
          logicalX: pLx, logicalY: pLy, x: tileToPixel(pLx), y: tileToPixel(pLy), targetX: tileToPixel(pLx), targetY: tileToPixel(pLy), movePath: [], isHero: isHeroP,
          // 샘플: 첫 번째 아군 지휘관에 char_001 포트레이트 연결
          ...(i === 0 ? { characterId: 'char_001' } : {}),
        };

        newUnits[`unit-e-${i}`] = {
          id: `unit-e-${i}`, factionId: defender, unitType: typeE,
          hp: baseE.hp * (isHeroE ? 2 : 1), maxHp: baseE.hp * (isHeroE ? 2 : 1), attack: baseE.attack * (isHeroE ? 1.5 : 1), defense: baseE.defense, speed: baseE.speed, moveSteps: baseE.moveSteps, attackRange: baseE.attackRange, hasActed: false,
          mp: 100, maxMp: 100, rage: 0, morale: 100,
          skills: isHeroE 
            ? ['mock-cross', 'mock-line', 'mock-cone', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-nova', 'mock-dash-attack', 'mock-heal', 'mock-aoe-heal', 'mock-buff-atk', 'mock-debuff-def', 'mock-poison', 'mock-regen'] 
            : ['mock-single', 'mock-radius', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-nova', 'mock-dash-attack', 'mock-heal', 'mock-buff-atk', 'mock-debuff-def', 'mock-poison', 'mock-regen'],
          skillCooldowns: {}, skillCharges: {}, state: 'IDLE',
          logicalX: eLx, logicalY: eLy, x: tileToPixel(eLx), y: tileToPixel(eLy), targetX: tileToPixel(eLx), targetY: tileToPixel(eLy), movePath: [], isHero: isHeroE,
        };
      }
      const target = findValidEscapeTile(0, 0, 1, 1);
      set({ 
        units: newUnits,
        victoryCondition: { type: 'REACH_LOCATION', description: '지정된 위치로 탈출', targetTile: target },
        defeatCondition: { type: 'WIPEOUT_ALLY', description: '아군 부대 전송 실패(전멸)' }
      });
      setTimeout(() => get().endUnitTurn(), 300);
      return;
    }

    // isPlayableTile이 허용하는 중앙 60% 구역의 실제 픽셀 경계 계산
    // getTileDarkness 기준: dist(= Math.max(|nx-0.5|/cx, |ny-0.5|/cy)) <= 0.6 이면 이동 가능
    // → 이동 가능 구역: cx * 0.6 기준으로 중앙에서 ±(mapWidth*0.6/2) 범위
    const playableMargin = Math.floor(mapWidth * 0.2); // 외곽 20% 마진 (각 변에서)
    const pMinX = playableMargin;
    const pMaxX = mapWidth - 1 - playableMargin;
    const pMinY = Math.floor(mapHeight * 0.2);
    const pMaxY = mapHeight - 1 - Math.floor(mapHeight * 0.2);

    // 적군 defensive 배치: isPlayableTile 구역의 좌/우 경계 부근
    const enemyMargin = 2; // 이동 가능 구역 경계에서 여분 2칸 안쪽
    const enemyLeft  = { minX: pMinX + enemyMargin, maxX: pMinX + enemyMargin + 5 };
    const enemyRight = { minX: pMaxX - enemyMargin - 5, maxX: pMaxX - enemyMargin };
    const enemyTop   = { minY: pMinY + enemyMargin, maxY: pMinY + enemyMargin + 5 };
    const enemyBot   = { minY: pMaxY - enemyMargin - 5, maxY: pMaxY - enemyMargin };

    const appStoreState = useAppStore.getState();
    const characters = appStoreState.characters;
    const deployingHeroIds = appStoreState.pendingBattle?.deployingHeroIds || [];

    const totalUnits = UNIT_CONFIG.PLAYER_UNIT_COUNT + (UNIT_CONFIG.INITIAL_SPAWN_COUNT - UNIT_CONFIG.PLAYER_UNIT_COUNT);
    for (let i = 0; i < totalUnits; i++) {
      let lx = 0, ly = 0;
      let isHero = false;
      const isPlayer = i < UNIT_CONFIG.PLAYER_UNIT_COUNT;
      const fId = isPlayer ? attacker : defender;

      let characterData = null;
      if (isPlayer && i < deployingHeroIds.length) {
        characterData = characters[deployingHeroIds[i]];
        isHero = true;
      } else {
        isHero = (fId === PLAYER_FACTION && i < 3) || (fId !== PLAYER_FACTION && i < 2);
      }

      let tries = 0;
      let found = false;
      while (tries < 200) {
        if (battleType === 'defensive') {
          if (fId === PLAYER_FACTION) {
            lx = Math.floor(mapWidth / 2) + Math.floor(Math.random() * 4) - 2;
            ly = Math.floor(mapHeight / 2) + Math.floor(Math.random() * 4) - 2;
          } else {
            const side = Math.floor(Math.random() * 4);
            if (side === 0) {
              lx = enemyLeft.minX  + Math.floor(Math.random() * (enemyLeft.maxX  - enemyLeft.minX  + 1));
              ly = pMinY + Math.floor(Math.random() * (pMaxY - pMinY + 1));
            } else if (side === 1) {
              lx = enemyRight.minX + Math.floor(Math.random() * (enemyRight.maxX - enemyRight.minX + 1));
              ly = pMinY + Math.floor(Math.random() * (pMaxY - pMinY + 1));
            } else if (side === 2) {
              lx = pMinX + Math.floor(Math.random() * (pMaxX - pMinX + 1));
              ly = enemyTop.minY   + Math.floor(Math.random() * (enemyTop.maxY   - enemyTop.minY   + 1));
            } else {
              lx = pMinX + Math.floor(Math.random() * (pMaxX - pMinX + 1));
              ly = enemyBot.minY   + Math.floor(Math.random() * (enemyBot.maxY   - enemyBot.minY   + 1));
            }
          }
        } else {
          lx = Math.floor(Math.random() * mapWidth);
          ly = Math.floor(Math.random() * mapHeight);
        }

        const mapData = get().mapData;
        // 안전한 기본값: GRASS 대신 SEA(통과 불가) 사용 → mapData null 시 수쯙에 배치 방지
        const terrain = mapData?.[ly]?.[lx] ?? TerrainType.SEA;
        const validTerrain = terrain === TerrainType.GRASS || terrain === TerrainType.PATH || terrain === TerrainType.FOREST || terrain === TerrainType.BEACH;
        const playable = isPlayableTile(lx, ly, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);

        if (validTerrain && playable && !usedTiles.has(`${lx},${ly}`)) {
          found = true;
          usedTiles.add(`${lx},${ly}`);
          break;
        }
        tries++;
      }

      // 200회 시도 후에도 유효 타일을 컴지 못한 경우 → 가장 가까운 유효 타일으로 fallback (SEA/CLIFF 절대 배치 방지)
      if (!found) {
        const fallback = findNearestValidTile(lx, ly);
        lx = fallback.lx;
        ly = fallback.ly;
        usedTiles.add(`${lx},${ly}`);
      }

      const id = `unit-${Date.now()}-${i}`;
      
      let type: UnitType;
      let baseHp = 0;
      let attackVal = 0;
      let defenseVal = 0;
      let speedVal = 0;
      let moveStepsVal = 3;
      let attackRangeVal = 1;
      let generalCharisma, generalStrength, generalIntelligence;
      let charIdAttr: { characterId?: string } = {};

      if (characterData) {
        type = characterData.troopType ?? 'INFANTRY';
        const st = BASE_STATS[type];
        
        // 편제 병력 수 기반 HP
        baseHp = (characterData.troopCount ?? st.hp) * 1.5; 
        
        // 장수 능력치 기반 추가 보정 (무력->공격, 지력->방어)
        attackVal = st.attack * (1 + characterData.baseStats.strength / 40);
        defenseVal = st.defense * (1 + characterData.baseStats.intelligence / 40);
        speedVal = st.speed;
        moveStepsVal = st.moveSteps;
        attackRangeVal = st.attackRange;
        generalCharisma = characterData.baseStats.charisma / 10;
        generalStrength = characterData.baseStats.strength / 10;
        generalIntelligence = characterData.baseStats.intelligence / 10;
        
        charIdAttr = { characterId: characterData.id };
      } else {
        const isGeneral = i === 0 || i === UNIT_CONFIG.PLAYER_UNIT_COUNT;
        type = isGeneral ? 'GENERAL' : getRandomType();
        const stats = isGeneral ? BASE_STATS.GENERAL : BASE_STATS[type];
        baseHp = stats.hp * (isHero ? 2 : 1);
        attackVal = stats.attack * (isHero ? 1.5 : 1);
        defenseVal = stats.defense;
        speedVal = stats.speed;
        moveStepsVal = stats.moveSteps;
        attackRangeVal = stats.attackRange;
        
        if (isGeneral) {
          generalCharisma = 3; generalStrength = 8; generalIntelligence = 8;
        }
        
        if (i === 0 && fId === attacker && !deployingHeroIds.length) {
          charIdAttr = { characterId: 'char_001' }; // Fallback
        }
      }

      const px = tileToPixel(lx);
      const py = tileToPixel(ly);
      
      newUnits[id] = {
        id,
        factionId: fId,
        unitType: type,
        hp: baseHp, maxHp: baseHp,
        attack: attackVal, defense: defenseVal,
        speed: speedVal, moveSteps: moveStepsVal, attackRange: attackRangeVal,
        hasActed: false,
        mp: 100, maxMp: 100, rage: 0, morale: 100,
        skills: isHero ? ['mock-cross', 'mock-line', 'mock-cone', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-heal', 'mock-aoe-heal', 'mock-buff-atk', 'mock-debuff-def', 'mock-poison', 'mock-regen'] : ['mock-single', 'mock-radius', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-heal', 'mock-buff-atk', 'mock-debuff-def', 'mock-poison', 'mock-regen'], 
        skillCooldowns: {}, skillCharges: {},
        state: 'IDLE',
        logicalX: lx, logicalY: ly,
        x: px, y: py,
        targetX: px, targetY: py,
        movePath: [],
        generalCharisma, generalStrength, generalIntelligence,
        isHero,
        ...charIdAttr,
      };
    }

    let victory = { type: 'ROUT_ENEMY', description: '적군을 모두 격퇴하라' } as LevelObjective;
    let defeat = { type: 'WIPEOUT_ALLY', description: '아군 전원 전사' } as LevelObjective;

    if (battleType === 'defensive') {
      const target = findValidEscapeTile(MAP_CONFIG.WIDTH - 1, MAP_CONFIG.HEIGHT - 1, -1, -1);
      victory = { type: 'REACH_LOCATION', description: '지정된 위치로 탈출', targetTile: target };
    }

    if (battleType === 'offensive') {
      const enemyHeroId = Object.values(newUnits).find(u => u.factionId !== PLAYER_FACTION && u.isHero)?.id;
      if (enemyHeroId) {
        victory = { type: 'KILL_TARGET', description: '적 지휘관(보스)을 암살하라', targetId: enemyHeroId };
      }
    }

    set({ units: newUnits, victoryCondition: victory, defeatCondition: defeat });
    setTimeout(() => get().endUnitTurn(), 300); // 턴 초기화
  }
});
