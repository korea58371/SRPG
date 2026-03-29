import type { StoreSlice, GameStateSlice } from './storeTypes';
import { TerrainType } from '../../types/gameTypes';
import type { Unit, UnitType, LevelObjective } from '../../types/gameTypes';
import { MAP_CONFIG, UNIT_CONFIG, PLAYER_FACTION, isPlayableTile, BASE_STATS, TROOP_SKILLS } from '../../constants/gameConfig';
import type { SpawnZone } from '../../utils/mapGenerator';
import { tileToPixel } from '../gameStore'; // Helper functions from Root store wrapper
import { useAppStore } from '../appStore';

export const createGameStateSlice: StoreSlice<GameStateSlice> = (set, get) => ({
  units: {},
  mapData: null,
  elevMap: null,
  mapObjects: [],
  cities: [],
  spawnZones: [],
  battleType: 'defensive',
  biome: null,
  victoryCondition: null,
  defeatCondition: null,

  setMapData: (mapData, elevMap, mapObjects) => set({ mapData, elevMap, mapObjects }),
  setCities: (cities) => set({ cities }),
  setSpawnZones: (zones: SpawnZone[]) => set({ spawnZones: zones }),
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

        const pFallback = findNearestValidTile(cx - 2, cy - 4 + i);
        const pLx = pFallback.lx; const pLy = pFallback.ly;
        usedTiles.add(`${pLx},${pLy}`);
        
        const eFallback = findNearestValidTile(cx + 2, cy - 4 + i);
        const eLx = eFallback.lx; const eLy = eFallback.ly;
        usedTiles.add(`${eLx},${eLy}`);

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

    const appStoreState = useAppStore.getState();
    const characters = appStoreState.characters;
    const deployingHeroIds = appStoreState.pendingBattle?.deployingHeroIds || [];

    // 출격 시 세팅된 영웅 숫자로만 구성
    const playerUnitCount = deployingHeroIds.length;
    const enemyUnitCount = UNIT_CONFIG.ENEMY_UNIT_COUNT;
    const totalUnits = playerUnitCount + enemyUnitCount;

    // ─── 스폰 존 기반 배치 준비 ──────────────────────────────────────────────
    // spawnZones: 'defender'(수비측 = 플레이어 수비 or 적 수비), 'attacker'(공격측)
    // battleType === 'defensive': 플레이어=defender, 적=attacker
    // battleType === 'offensive': 플레이어=attacker, 적=defender
    const currentSpawnZones = get().spawnZones;
    const defenderZone = currentSpawnZones.find(z => z.team === 'defender');
    const attackerZone = currentSpawnZones.find(z => z.team === 'attacker');

    // battleType에 따라 player/enemy가 어떤 존을 쓸지 결정
    const isOffensive = battleType === 'offensive';
    const playerZone  = isOffensive ? attackerZone  : defenderZone;
    const enemyZone   = isOffensive ? defenderZone  : attackerZone;

    // 존 타일 중 유효한(미점령, 육지) 타일 pool 구성
    const buildTilePool = (zone: typeof defenderZone): {lx:number, ly:number}[] => {
      if (!zone) return [];
      const mapData = get().mapData;
      return zone.tiles.filter(t => {
        const terrain = mapData?.[t.y]?.[t.x] ?? TerrainType.SEA;
        const valid = terrain === TerrainType.GRASS || terrain === TerrainType.PATH ||
                      terrain === TerrainType.FOREST || terrain === TerrainType.BEACH;
        return valid && isPlayableTile(t.x, t.y, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT) && !usedTiles.has(`${t.x},${t.y}`);
      }).map(t => ({ lx: t.x, ly: t.y }));
    };

    const getFromPool = (pool: {lx:number, ly:number}[]): {lx:number, ly:number} | null => {
      if (pool.length === 0) return null;
      const idx = Math.floor(Math.random() * pool.length);
      const tile = pool[idx];
      pool.splice(idx, 1); // 사용한 타일 제거
      usedTiles.add(`${tile.lx},${tile.ly}`);
      return tile;
    };

    for (let i = 0; i < totalUnits; i++) {
      let lx = 0, ly = 0;
      let isHero = false;
      const isPlayer = i < playerUnitCount;
      const fId = isPlayer ? attacker : defender;

      let characterData = null;
      if (isPlayer && i < deployingHeroIds.length) {
        characterData = characters[deployingHeroIds[i]];
        isHero = true;
      } else {
        isHero = (fId === PLAYER_FACTION && i < 3) || (fId !== PLAYER_FACTION && (i - playerUnitCount) < 2);
      }

      // 스폰 존 타일풀에서 배치 위치 결정
      const pool = buildTilePool(isPlayer ? playerZone : enemyZone);
      const fromPool = getFromPool(pool);

      if (fromPool) {
        lx = fromPool.lx;
        ly = fromPool.ly;
      } else {
        // 폴백: 스폰 존 없거나 풀 부족 → 기존 랜덤 배치
        const playableMargin = Math.floor(mapWidth * 0.2);
        const pMinX = playableMargin, pMaxX = mapWidth - 1 - playableMargin;
        const pMinY = Math.floor(mapHeight * 0.2), pMaxY = mapHeight - 1 - Math.floor(mapHeight * 0.2);
        const centerX = Math.floor(mapWidth / 2);
        const centerY = Math.floor(mapHeight / 2);
        let tries = 0;
        while (tries < 200) {
          if (isPlayer) {
            lx = centerX + Math.floor(Math.random() * 6) - 3;
            ly = centerY + Math.floor(Math.random() * 6) - 3;
          } else {
            const side = Math.floor(Math.random() * 4);
            const em = 2;
            if (side === 0)      { lx = pMinX + em + Math.floor(Math.random() * 5); ly = pMinY + Math.floor(Math.random() * (pMaxY - pMinY)); }
            else if (side === 1) { lx = pMaxX - em - Math.floor(Math.random() * 5); ly = pMinY + Math.floor(Math.random() * (pMaxY - pMinY)); }
            else if (side === 2) { lx = pMinX + Math.floor(Math.random() * (pMaxX - pMinX)); ly = pMinY + em + Math.floor(Math.random() * 5); }
            else                 { lx = pMinX + Math.floor(Math.random() * (pMaxX - pMinX)); ly = pMaxY - em - Math.floor(Math.random() * 5); }
          }
          const mapData = get().mapData;
          const terrain = mapData?.[ly]?.[lx] ?? TerrainType.SEA;
          const validTerrain = terrain === TerrainType.GRASS || terrain === TerrainType.PATH || terrain === TerrainType.FOREST || terrain === TerrainType.BEACH;
          if (validTerrain && isPlayableTile(lx, ly, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT) && !usedTiles.has(`${lx},${ly}`)) {
            usedTiles.add(`${lx},${ly}`); break;
          }
          tries++;
        }
        if (tries >= 200) {
          const fallback = findNearestValidTile(lx, ly);
          lx = fallback.lx; ly = fallback.ly;
          usedTiles.add(`${lx},${ly}`);
        }
      }

      const id = `unit-${Date.now()}-${i}`;
      
      let type: UnitType;
      let baseHp = 0;
      let attackVal = 0;
      let defenseVal = 0;
      let speedVal = 0;
      let moveStepsVal = 3;
      let attackRangeVal = 1;
      let generalPower, generalCommand, generalLeadership, generalIntelligence;
      let charIdAttr: { characterId?: string } = {};

      if (characterData) {
        type = characterData.troopType ?? 'INFANTRY';
        const st = BASE_STATS[type];
        
        // 편제 병력 수 기반 HP
        baseHp = (characterData.troopCount ?? st.hp) * 1.5; 
        
        // 장수 능력치 기반 추가 보정 (가라 스탯 부여)
        attackVal = st.attack * (1 + characterData.baseStats.power / 40);
        defenseVal = st.defense * (1 + characterData.baseStats.toughness / 40);
        speedVal = characterData.baseStats.agility; // 속도를 민첩으로 대체
        moveStepsVal = st.moveSteps;
        attackRangeVal = st.attackRange;
        generalPower = characterData.baseStats.power / 10;
        generalCommand = characterData.baseStats.command / 10;
        generalLeadership = characterData.baseStats.leadership / 10;
        generalIntelligence = characterData.baseStats.intelligence / 10;
        
        charIdAttr = { characterId: characterData.id };
      } else {
        const isGeneral = i === 0 || i === playerUnitCount;
        type = isGeneral ? 'GENERAL' : getRandomType();
        const stats = isGeneral ? BASE_STATS.GENERAL : BASE_STATS[type];
        baseHp = stats.hp * (isHero ? 2 : 1);
        attackVal = stats.attack * (isHero ? 1.5 : 1);
        defenseVal = stats.defense;
        speedVal = stats.speed;
        moveStepsVal = stats.moveSteps;
        attackRangeVal = stats.attackRange;
        
        if (isGeneral) {
          generalPower = 8; generalCommand = 8; generalIntelligence = 8; generalLeadership = 3;
        }
        
        if (i === 0 && fId === attacker && !deployingHeroIds.length) {
          charIdAttr = { characterId: 'char_001' }; // Fallback
        }
      }

      const px = tileToPixel(lx);
      const py = tileToPixel(ly);
      
      newUnits[id] = {
        id,
        name: characterData?.name,
        factionId: fId,
        unitType: type,
        hp: baseHp, maxHp: baseHp,
        attack: attackVal, defense: defenseVal,
        speed: speedVal, moveSteps: moveStepsVal, attackRange: attackRangeVal,
        hasActed: false,
        mp: 100, maxMp: 100, rage: 0, morale: 100,
        skills: [...new Set([
          ...(TROOP_SKILLS[type] || []),
          ...(characterData?.skills || [])
        ])],
        skillCooldowns: {}, skillCharges: {},
        state: 'IDLE',
        logicalX: lx, logicalY: ly,
        x: px, y: py,
        targetX: px, targetY: py,
        movePath: [],
        generalPower, generalCommand, generalLeadership, generalIntelligence,
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
