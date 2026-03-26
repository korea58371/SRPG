import type { StoreSlice, GameStateSlice } from './storeTypes';
import { TerrainType } from '../../types/gameTypes';
import type { Unit, UnitType } from '../../types/gameTypes';
import { UNIT_CONFIG, BASE_STATS, PLAYER_FACTION } from '../../constants/gameConfig';
import { tileToPixel } from '../gameStore'; // Helper functions from Root store wrapper

export const createGameStateSlice: StoreSlice<GameStateSlice> = (set, get) => ({
  units: {},
  mapData: null,
  elevMap: null,
  mapObjects: [],
  cities: [],
  battleType: 'defensive',
  biome: null,

  setMapData: (mapData, elevMap, mapObjects) => set({ mapData, elevMap, mapObjects }),
  setCities: (cities) => set({ cities }),
  setBattleType: (type) => set({ battleType: type }),
  setBiome: (biome) => set({ biome }),

  initUnits: (mapWidth, mapHeight, attacker, defender) => {
    const battleType = get().battleType;
    const newUnits: Record<string, Unit> = {};
    const usedTiles = new Set<string>();

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
          hp: baseP.hp * (isHeroP ? 2 : 1), maxHp: baseP.hp * (isHeroP ? 2 : 1), attack: baseP.attack * (isHeroP ? 1.5 : 1), defense: baseP.defense, speed: baseP.speed, moveSteps: baseP.moveSteps, attackRange: baseP.attackRange, ct: baseP.speed,
          mp: 100, maxMp: 100, rage: 0, morale: 100,
          skills: isHeroP 
            ? ['mock-cross', 'mock-line', 'mock-cone', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-nova', 'mock-dash-attack'] 
            : ['mock-single', 'mock-radius', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-nova', 'mock-dash-attack'],
          skillCooldowns: {}, skillCharges: {}, state: 'IDLE',
          logicalX: pLx, logicalY: pLy, x: tileToPixel(pLx), y: tileToPixel(pLy), targetX: tileToPixel(pLx), targetY: tileToPixel(pLy), movePath: [], isHero: isHeroP,
        };

        newUnits[`unit-e-${i}`] = {
          id: `unit-e-${i}`, factionId: defender, unitType: typeE,
          hp: baseE.hp * (isHeroE ? 2 : 1), maxHp: baseE.hp * (isHeroE ? 2 : 1), attack: baseE.attack * (isHeroE ? 1.5 : 1), defense: baseE.defense, speed: baseE.speed, moveSteps: baseE.moveSteps, attackRange: baseE.attackRange, ct: baseE.speed,
          mp: 100, maxMp: 100, rage: 0, morale: 100,
          skills: isHeroE 
            ? ['mock-cross', 'mock-line', 'mock-cone', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-nova', 'mock-dash-attack'] 
            : ['mock-single', 'mock-radius', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-nova', 'mock-dash-attack'],
          skillCooldowns: {}, skillCharges: {}, state: 'IDLE',
          logicalX: eLx, logicalY: eLy, x: tileToPixel(eLx), y: tileToPixel(eLy), targetX: tileToPixel(eLx), targetY: tileToPixel(eLy), movePath: [], isHero: isHeroE,
        };
      }
      set({ units: newUnits });
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
        ct: stats.speed,
        mp: 100, maxMp: 100, rage: 0, morale: 100,
        skills: isHero ? ['mock-cross', 'mock-line', 'mock-cone', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-heal', 'mock-aoe-heal'] : ['mock-single', 'mock-radius', 'mock-push', 'mock-pull', 'mock-teleport-react', 'mock-heal'], 
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
      };
    }
    set({ units: newUnits });
    setTimeout(() => get().endUnitTurn(), 300); // 턴 초기화
  }
});
