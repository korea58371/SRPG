// J:/AI/Game/SRPG/src/screens/StrategyMapScreen.tsx
// 마이크로셀 그룹화 방식 — 자연스러운 구불구불한 국경선
// 같은 Province 마이크로셀: 경계선 없음 → 병합된 것처럼 보임
// 다른 Province 마이크로셀: 흰 경계선 → Azgaar 스타일 국경

import { useMemo, useState } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { generateProvinces, type MicroCell, type BoundaryEdge, type TerrainIcon, type RiverSegment } from '../utils/provinceGenerator';
import { useAppStore } from '../store/appStore';
import type { Province } from '../types/appTypes';
import { FACTIONS, PLAYER_FACTION } from '../constants/gameConfig';

const SVG_W = 1440;
const SVG_H = 820;

// 팩션 색상 번호를 HEX 문자열로 변환
function getFactionColor(fId: string): string {
  const c = FACTIONS[fId]?.color;
  if (typeof c === 'number') return '#' + c.toString(16).padStart(6, '0');
  return '#aaaaaa';
}
const OCEAN_COLOR  = '#b8d4e8';
const OCEAN_WAVE   = '#9ec3df';

// 지형 색상 팔레트
const TERRAIN_FILL: Record<string, string> = {
  peak:      '#3d3530',  // 어두운 암색 — 험준한 고산
  mountain:  '#6b5a48',  // 짙은 갈회색 — 암석 산악
  highland:  '#a3a060',  // 올리브 — 고원
  forest:    '#4a7c50',  // 짙은 녹색 — 숲
  plains:    '#c8b96b',  // 황금 — 평야
  wasteland: '#b89860',  // 모래색 — 황무지
  coastal:   '#6aadcb',  // 청록 — 해안
  ocean:     '#b8d4e8',  // 바다 (참조용)
};

type MapMode = 'faction' | 'terrain';

// ─── 마이크로셀 인접 Province 판별 (렌더링 최적화) ────────────────────────────
// allCells에서 Province 중심 좌표 취합
function getProvinceCenters(
  allCells: MicroCell[],
  provinces: Record<string, Province>,
): Record<string, { cx: number; cy: number }> {
  const acc: Record<string, { sumX: number; sumY: number; count: number }> = {};
  for (const cell of allCells) {
    if (!cell.provinceId) continue;
    if (!acc[cell.provinceId]) acc[cell.provinceId] = { sumX: 0, sumY: 0, count: 0 };
    acc[cell.provinceId].sumX += cell.cx;
    acc[cell.provinceId].sumY += cell.cy;
    acc[cell.provinceId].count += 1;
  }
  const result: Record<string, { cx: number; cy: number }> = {};
  for (const id of Object.keys(provinces)) {
    const a = acc[id];
    if (a) result[id] = { cx: a.sumX / a.count, cy: a.sumY / a.count };
    else {
      const p = provinces[id];
      result[id] = { cx: p.seedX * SVG_W, cy: p.seedY * SVG_H };
    }
  }
  return result;
}

// ─── 범례 ────────────────────────────────────────────────────────────────────
function Legend({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="smap-legend">
      {Object.keys(FACTIONS).slice(0, 10).map((k) => (
        <div key={k} className="smap-legend-item">
          <span className="smap-legend-dot" style={{ background: getFactionColor(k), border: '1px solid rgba(255,255,255,0.3)' }} />
          <span>{FACTIONS[k].name} {counts[k] ?? 0}성</span>
        </div>
      ))}
      <div className="smap-legend-item text-xs text-gray-400">외 {Object.keys(FACTIONS).length - 10}개 세력 생략...</div>
    </div>
  );
}

// ─── Province 상세 패널 ───────────────────────────────────────────────────────
function ProvincePanel({ province, onClose }: { province: Province; onClose: () => void }) {
  const declareWar      = useAppStore(s => s.declareWar);
  const executeDomestic = useAppStore(s => s.executeDomestic);
  const provinces       = useAppStore(s => s.provinces);

  const isPlayer = province.owner === PLAYER_FACTION;
  const canAttack = province.owner !== PLAYER_FACTION && Object.values(provinces).some(
    p => p.owner === PLAYER_FACTION && p.adjacentIds.includes(province.id)
  );
  const color = getFactionColor(province.owner);

  return (
    <div className="smap-panel">
      <div className="smap-panel-header" style={{ borderColor: color }}>
        <h3 className="smap-panel-title">{province.name}</h3>
        {province.isCapital && <span className="smap-panel-capital">👑</span>}
        <button className="smap-panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="smap-panel-owner" style={{ color }}>{FACTIONS[province.owner]?.name || '알 수 없음'}</div>
      <div className="smap-panel-stats">
        <div className="smap-stat"><span>🌾 식량</span><span>{province.food}</span></div>
        <div className="smap-stat"><span>💰 금</span><span>{province.gold}</span></div>
      </div>
      <div className="smap-panel-actions">
        {isPlayer && (
          <button className="smap-action-btn smap-action-domestic"
            onClick={() => { executeDomestic(province.id); onClose(); }}>
            🏛 내정 (+10식량 +8금)
          </button>
        )}
        {canAttack && (
          <button className="smap-action-btn smap-action-war"
            onClick={() => {
              const atk = Object.values(provinces).find(
                p => p.owner === PLAYER_FACTION && p.adjacentIds.includes(province.id)
              );
              if (atk) declareWar(atk.id, province.id);
            }}>
            ⚔️ 전쟁 선포
          </button>
        )}
        {province.owner !== PLAYER_FACTION && !canAttack && (
          <p className="smap-panel-hint">인접 아군 영지 없어 공격 불가</p>
        )}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function StrategyMapScreen() {
  const provinces          = useAppStore(s => s.provinces);
  const selectedProvinceId = useAppStore(s => s.selectedProvinceId);
  const selectProvince     = useAppStore(s => s.selectProvince);
  const strategyTurn       = useAppStore(s => s.strategyTurn);
  const endStrategyTurn    = useAppStore(s => s.endStrategyTurn);
  const worldSeed          = useAppStore(s => s.worldSeed);

  // 클릭: Province ID 기록
  const [mapMode, setMapMode]             = useState<MapMode>('faction');

  // worldSeed 기반으로 allCells + boundaryEdges 생성
  const { allCells, boundaryEdges, oceanDepth, terrainIcons, rivers } = useMemo(() => {
    if (!worldSeed) return { allCells: [], boundaryEdges: [], oceanDepth: [], terrainIcons: [], rivers: [] };
    const result = generateProvinces(SVG_W, SVG_H, worldSeed);
    const cells = result.allCells.map(cell => {
      if (cell.isOcean || !cell.province) return cell;
      const live = provinces[cell.provinceId!];
      if (!live) return cell;
      return { ...cell, province: live };
    });
    return {
      allCells: cells,
      boundaryEdges: result.boundaryEdges,
      oceanDepth: result.oceanDepth,
      terrainIcons: result.terrainIcons,
      rivers: result.rivers
    };
  }, [worldSeed, provinces]);

  // Province 중심 좌표 (본거지 아이콘, 이름 표시용)
  const centers = useMemo(
    () => getProvinceCenters(allCells, provinces),
    [allCells, provinces]
  );

  const selectedProvince = selectedProvinceId ? provinces[selectedProvinceId] : null;

  // 최적화: Province 단위로 셀을 미리 그룹핑 (리렌더링 시 12000번 루프 방지)
  const cellsByProvince = useMemo(() => {
    const map: Record<string, typeof allCells> = {};
    for (const c of allCells) {
      if (c.isOcean || !c.provinceId) continue;
      if (!map[c.provinceId]) map[c.provinceId] = [];
      map[c.provinceId].push(c);
    }
    return map;
  }, [allCells]);

  const all = Object.values(provinces);
  const counts = useMemo(() => {
    return all.reduce((acc, p) => {
      acc[p.owner] = (acc[p.owner] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [all]);

  // 상위 세력 몇 개만 추출하여 뱃지 표시
  const topFactions = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="smap-root">
      {/* 상단 HUD */}
      <div className="smap-hud">
        <div className="smap-hud-left">
          <h2 className="smap-title">⚡ 군략화면</h2>
          <span className="smap-turn">전략 턴 {strategyTurn}</span>
        </div>
        <div className="smap-hud-stats">
          {topFactions.map(([fId, cnt]) => {
            const hexColor = getFactionColor(fId);
            return (
              <span key={fId} className="smap-stat-badge" style={{ borderColor: hexColor, color: hexColor }}>
                {FACTIONS[fId]?.name.split(' ')[0]} {cnt}성
              </span>
            );
          })}
        </div>
        <div className="smap-hud-right">
          <button
            className="smap-btn-toggle"
            onClick={() => setMapMode(m => m === 'faction' ? 'terrain' : 'faction')}
            title="지도 모드 전환"
          >
            {mapMode === 'faction' ? '🗺 지형도' : '⚔️ 세력도'}
          </button>
          <button className="smap-btn-end" onClick={endStrategyTurn}>턴 종료 →</button>
        </div>
      </div>

      {/* 지도 (확대/축소 지원) */}
      <div className="smap-map-area" style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#b8d4e8' }}>
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={6}
          centerOnInit={true}
          wheel={{ step: 0.15 }}
          pinch={{ step: 5 }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="smap-svg"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: 'block', width: '100%', height: '100%' }}
            >
              <defs>
            {/* 바다 패턴 */}
            <pattern id="ocean-p" width="50" height="50" patternUnits="userSpaceOnUse">
              <rect width="50" height="50" fill={OCEAN_COLOR} />
              <path d="M0 25 Q12 20 25 25 Q37 30 50 25" stroke={OCEAN_WAVE} strokeWidth="0.5" fill="none" opacity="0.45" />
              <path d="M0 38 Q12 33 25 38 Q37 43 50 38" stroke={OCEAN_WAVE} strokeWidth="0.4" fill="none" opacity="0.3" />
            </pattern>
            {/* 선택된 Province 글로우 */}
            <filter id="sel-glow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>

            {/* ====== 날카로운 프랙탈 폴리곤 렌더링을 위해 스무딩(Goo) 및 디스플레이스먼트 변형 필터 모두 제거 ====== */}
            
            {/* ====== 지형 심벌 (Azgaar 스타일 벤치마킹) ====== */}
            <g id="icon-mountain">
              <path d="M0 -12 L-10 8 L10 8 Z" fill="#6b5a48" stroke="#3d3530" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M0 -12 L0 8 L10 8 Z" fill="#8a7661" stroke="none" />
            </g>
            <g id="icon-peak">
              <path d="M0 -16 L-12 10 L12 10 Z" fill="#4a423d" stroke="#221e1a" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M0 -16 L0 10 L12 10 Z" fill="#615750" stroke="none" />
              <path d="M0 -16 L-5 -5 L0 -3 L5 -6 Z" fill="#ffffff" stroke="none" />
            </g>
            <g id="icon-forest">
              <circle cx="0" cy="-6" r="6" fill="#4a7c50" stroke="#2a4c30" strokeWidth="1" />
              <circle cx="-5" cy="-2" r="5" fill="#4a7c50" stroke="#2a4c30" strokeWidth="1" />
              <circle cx="5" cy="-2" r="5" fill="#4a7c50" stroke="#2a4c30" strokeWidth="1" />
              <path d="M-1 0 L-1 6 L1 6 L1 0 Z" fill="#503a27" />
            </g>
          </defs>

          {/* 바다 배경 */}
          <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="url(#ocean-p)" />

          {/* ── 마이크로셀 렌더링 ──────────────────────────────────────────────
              핵심: stroke 전략
              - 같은 Province 내 셀: stroke 없음 (seamless 병합 효과)
              - 바다 셀: 투명 (바다 패턴만 보임)
              - 육지 셀: 세력 색
              경계는 인접 셀이 다른 Province일 때 자연스럽게 드러남
          ─────────────────────────────────────────────────────────────────── */}

          {/* ── 마이크로셀 바다 셀 ───────────────────────────────────────────
              oceanDepth 기반으로 해안가에 깊이 레이어 효과 부여 (Azgaar 스타일 착안)
          ─────────────────────────────────────────────────────────────────── */}
          {allCells.filter(c => c.isOcean).map(cell => {
            const depth = Math.max(1, oceanDepth[cell.idx] || 5);
            // 육지에 가까운 1~2는 투명하게 하여 패턴이 보이게 하고, 깊은 바다는 진하게
            const alpha = 0.2 + depth * 0.15; 
            return (
              <path key={cell.idx} d={cell.path} fill={`rgba(102, 169, 219, ${alpha})`} stroke="none" />
            );
          })}

          {/* 날카로운 프랙탈 해안선 라인 오버레이 레이어 (Goo 필터 제거 후 폴리곤 stroke 시각화) */}
          <g>
            {allCells.filter(c => !c.isOcean).map(c => (
              <path key={`out${c.idx}`} d={c.path} fill="#2f4961" stroke="#2f4961" strokeWidth={1.8} strokeLinejoin="round" />
            ))}
          </g>

          {/* SVG 마스크/필터 없는 순수(Crisp) 육지 렌더링 컨테이너 */}
          <g>
              {/* 육지 셀 그림자 레이어 (비 그룹 렌더링, 정적) */}
              {allCells.filter(c => !c.isOcean && c.province).map(cell => (
                <path key={`s${cell.idx}`} d={cell.path}
                  fill="#00000022" stroke="none" transform="translate(1.5,2.5)" style={{ pointerEvents: 'none' }} />
              ))}

              {/* Province 단위 그룹 렌더링 (호버 성능 최적화: g.smap-province-group 으로 래핑) */}
              {Object.entries(cellsByProvince).map(([provId, cells]) => {
                const prov = provinces[provId];
                if (!prov) return null;
                const isSel = selectedProvinceId === provId;
                const baseColor = mapMode === 'faction' ? getFactionColor(prov.owner) : '';

                return (
                  <g 
                    key={provId}
                    className={`smap-province-group ${isSel ? 'selected' : ''}`}
                    onClick={() => selectProvince(provId)}
                    filter={isSel ? 'url(#sel-glow)' : undefined}
                    style={{ cursor: 'pointer' }}
                  >
                    {cells.map(cell => {
                      const fill = mapMode === 'faction' ? baseColor : (TERRAIN_FILL[cell.terrain] ?? '#aaa');
                      return (
                        <path
                          key={cell.idx}
                          className="smap-land-cell"
                          d={cell.path}
                          fill={fill}
                          stroke={fill}
                          strokeWidth={0.8}
                          style={{ transition: 'filter 0.1s ease-out' }}
                        />
                      );
                    })}
                  </g>
                );
              })}

              {/* 강(River) 레이어 - 육지 셀 위, 아이콘 아래에 등재 */}
              {rivers.map((r, i) => {
                // 하류로 갈수록 flux가 커짐에 따라 강이 넓어짐 (최대 두께 4.0 픽셀 제한)
                const width = Math.min(0.5 + Math.sqrt(r.flux) * 0.15, 4.0);
                return (
                  <line 
                    key={`river-${i}`}
                    x1={r.x1} y1={r.y1}
                    x2={r.x2} y2={r.y2}
                    stroke="#6aadcb" // 연안(coastal) 바다 색상과 동일하게
                    strokeWidth={width}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                );
              })}

              {/* 세력도 전용: 지형 음영 오버레이 */}
              {mapMode === 'faction' && allCells.filter(c => !c.isOcean && c.province).map(cell => {
                const shade = ({
                  peak:      0.42,
                  mountain:  0.27,
                  highland:  0.13,
                  forest:    0.08,
                  plains:    0,
                  wasteland: 0,
                  coastal:   -0.08,
                  ocean:     0,
                } as Record<string, number>)[cell.terrain] ?? 0;
                if (shade === 0) return null;
                return (
                  <path key={`sh${cell.idx}`} d={cell.path}
                    fill={shade > 0 ? `rgba(0,0,0,${shade})` : `rgba(255,255,255,${-shade})`}
                    stroke="none" style={{ pointerEvents: 'none' }}
                  />
                );
              })}

              {/* Province 경계선 — 내부 엣지 스무딩 유지 */}
              {boundaryEdges
                .filter(e => e.provIdA !== selectedProvinceId && e.provIdB !== selectedProvinceId)
                .map((edge, i) => (
                  <line key={i}
                    x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
                    stroke={edge.isFactionBoundary ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)'}
                    strokeWidth={edge.isFactionBoundary ? 1.8 : 0.9}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                ))}

              {/* Province 경계선 — 선택된 Province 흰 하이라이트 */}
              {selectedProvinceId && boundaryEdges
                .filter(e => e.provIdA === selectedProvinceId || e.provIdB === selectedProvinceId)
                .map((edge, i) => (
                  <line key={`sel-${i}`}
                    x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                ))}
          </g> {/* ==== 육지 렌더링 컨테이너 끝 ==== */}

          {/* 지형 아이콘 (Poisson 기반 정점 배치) 
              왜곡 필터 및 마스크의 영향을 받지 않도록 상위 컨텍스트에 렌더링 */}
          {mapMode === 'terrain' && terrainIcons.map((icon, i) => {
            // scale: 기준 s값을 16으로 보고 단순 스케일링
            const scale = (icon.s / 16).toFixed(2);
            return (
              <use 
                key={`icon-${i}`} 
                href={`#icon-${icon.type}`} 
                x={icon.x} 
                y={icon.y} 
                transform={`translate(${icon.x}, ${icon.y}) scale(${scale}) translate(${-icon.x}, ${-icon.y})`}
                style={{ pointerEvents: 'none' }}
              />
            );
          })}

          {/* Province 라벨 (중심점에) */}
          {Object.entries(centers).map(([provId, { cx, cy }]) => {
            const prov = provinces[provId];
            if (!prov) return null;
            return (
              <g key={`label-${provId}`} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {prov.isCapital && (
                  <text x={cx} y={cy - 10} textAnchor="middle" fontSize={12} fill="#ffd700">
                    🏰
                  </text>
                )}
                <text
                  x={cx} y={cy + (prov.isCapital ? 7 : 3)}
                  textAnchor="middle"
                  fontSize={8}
                  fill="rgba(255,255,255,0.9)"
                  style={{ fontWeight: 700, textShadow: '0 1px 2px #00000080' }}
                >
                  {prov.name}
                </text>
              </g>
            );
          })}

          {/* 지도 테두리 */}
          <rect x={0} y={0} width={SVG_W} height={SVG_H}
            fill="none" stroke="#334155" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
        </svg>
        </TransformComponent>
        </TransformWrapper>

        {/* Province 상세 패널 */}
        {selectedProvince && (
          <ProvincePanel province={selectedProvince} onClose={() => selectProvince(null)} />
        )}
      </div>

      <Legend counts={counts} />
    </div>
  );
}
