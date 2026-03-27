import type { StoreSlice, GameStateSlice } from './storeTypes';
import { TerrainType } from '../../types/gameTypes';
import type { Unit, UnitType, LevelObjective } from '../../types/gameTypes';
import { UNIT_CONFIG, BASE_STATS, PLAYER_FACTION, MAP_CONFIG, isPlayableTile } from '../../constants/gameConfig';
import { tileToPixel } from '../gameStore'; // Helper functions from Root store wrapper

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
        const terrain = mapData?.[cy]?.[cx] ?? TerrainType.GRASS;
        const valid = terrain === TerrainType.GRASS || terrain === TerrainType.PATH || terrain === TerrainType.FOREST || terrain === TerrainType.BEACH;
        const playable = isPlayableTile(cx, cy, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);
        if (playable && valid) return { lx: cx, ly: cy };
        cx += stepX;
        cy += stepY;
      }
      return { lx: Math.floor(MAP_CONFIG.WIDTH/2), ly: Math.floor(MAP_CONFIG.HEIGHT/2) };
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

    const totalUnits = UNIT_CONFIG.PLAYER_UNIT_COUNT + (UNIT_CONFIG.INITIAL_SPAWN_COUNT - UNIT_CONFIG.PLAYER_UNIT_COUNT);
    for (let i = 0; i < totalUnits; i++) {
      let lx = 0, ly = 0;
      let isHero = false;
      const fId = i < UNIT_CONFIG.PLAYER_UNIT_COUNT ? attacker : defender;

      isHero = (fId === PLAYER_FACTION && i < 3) || (fId !== PLAYER_FACTION && i < 2);

      let tries = 0;
      while (tries < 100) {
        if (battleType === 'defensive') {
          if (fId === PLAYER_FACTION) {
            lx = Math.floor(mapWidth / 2) + Math.floor(Math.random() * 4) - 2;
            ly = Math.floor(mapHeight / 2) + Math.floor(Math.random() * 4) - 2;
          } else {
            lx = Math.random() > 0.5 ? Math.floor(Math.random() * 5) : mapWidth - 1 - Math.floor(Math.random() * 5);
            ly = Math.random() > 0.5 ? Math.floor(Math.random() * 5) : mapHeight - 1 - Math.floor(Math.random() * 5);
          }
        } else {
          lx = Math.floor(Math.random() * mapWidth);
          ly = Math.floor(Math.random() * mapHeight);
        }

        const mapData = get().mapData;
        const terrain = mapData?.[ly]?.[lx] ?? TerrainType.GRASS;
        const validTerrain = terrain === TerrainType.GRASS || terrain === TerrainType.PATH || terrain === TerrainType.FOREST || terrain === TerrainType.BEACH;
        
        if (validTerrain && !usedTiles.has(`${lx},${ly}`)) {
          usedTiles.add(`${lx},${ly}`);
          break;
        }
        tries++;
      }

      const id = `unit-${Date.now()}-${i}`;
      const isGeneral = i === 0 || i === UNIT_CONFIG.PLAYER_UNIT_COUNT;
      const type = isGeneral ? 'GENERAL' : getRandomType();
      const stats = isGeneral ? BASE_STATS.GENERAL : BASE_STATS[type];

      const px = tileToPixel(lx);
      const py = tileToPixel(ly);
      
      newUnits[id] = {
        id,
        factionId: fId,
        unitType: type,
        hp: stats.hp * (isHero ? 2 : 1), maxHp: stats.hp * (isHero ? 2 : 1),
        attack: stats.attack * (isHero ? 1.5 : 1), defense: stats.defense,
        speed: stats.speed, moveSteps: stats.moveSteps, attackRange: stats.attackRange,
        hasActed: false,
        mp: 100, maxMp: 100, rage: 0, morale: 100,
        skills: isHero ? ['mock-cross', 'mock-line', 'mock-cone', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-heal', 'mock-aoe-heal', 'mock-buff-atk', 'mock-debuff-def', 'mock-poison', 'mock-regen'] : ['mock-single', 'mock-radius', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-heal', 'mock-buff-atk', 'mock-debuff-def', 'mock-poison', 'mock-regen'], 
        skillCooldowns: {}, skillCharges: {},
        state: 'IDLE',
        logicalX: lx, logicalY: ly,
        x: px, y: py,
        targetX: px, targetY: py,
        movePath: [],
        generalCharisma: isGeneral ? 3 : undefined,
        generalStrength: isGeneral ? 8 : undefined,
        generalIntelligence: isGeneral ? 8 : undefined,
        isHero,
        // 샘플: 첫 번째 아군 장수(i===0)에 char_001 포트레이트 연결
        ...(i === 0 && fId === attacker ? { characterId: 'char_001' } : {}),
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
