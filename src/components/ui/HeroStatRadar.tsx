
import type { CharacterBaseStats } from '../../types/characterTypes';

interface Props {
  stats: CharacterBaseStats;
  color?: string; // e.g. '#3b82f6'
  size?: number;  // px size
  maxStat?: number;
  textColor?: string;
  gridColor?: string;
}

// 5대 스탯으로 통합되어 내부 연산을 수행하므로 정적 METRICS 리스트는 제거되었습니다.

export default function HeroStatRadar({
  stats,
  color = '#0ea5e9', // default sky-500
  size = 280,
  maxStat = 100,
  textColor = '#ffffff',
  gridColor = 'rgba(255, 255, 255, 0.15)'
}: Props) {
  const center = size / 2;
  const radius = (size / 2) * 0.60; // 텍스트 영역을 위해 반지름을 60%로 축소 (여백 40% 확보)

  // 1차 스탯(9종)을 5대 통합 스탯(무력, 통솔, 지략, 정치, 매력)으로 연산
  const compositeStats = [
    { label: '통솔', val: Math.round(stats.command * 0.6 + stats.leadership * 0.4) },
    { label: '무력', val: Math.round(stats.power * 0.5 + stats.agility * 0.2 + stats.toughness * 0.15 + stats.constitution * 0.15) },
    { label: '지략', val: stats.intelligence },
    { label: '정치', val: stats.politics },
    { label: '매력', val: stats.charm },
  ];

  const total = compositeStats.length;
  const angleSlice = (Math.PI * 2) / total;

  // 1. 거미줄 백그라운드 선 그리기
  const levels = 5;
  const gridLines = [];
  for (let level = 1; level <= levels; level++) {
    const levelRadius = radius * (level / levels);
    const points = [];
    for (let i = 0; i < total; i++) {
      const angle = i * angleSlice - Math.PI / 2;
      const x = center + Math.cos(angle) * levelRadius;
      const y = center + Math.sin(angle) * levelRadius;
      points.push(`${x},${y}`);
    }
    // 닫힌 다각형 만들기
    gridLines.push(points.join(' '));
  }

  // 방사형 축(축선) 그리기
  const axes = [];
  for (let i = 0; i < total; i++) {
    const angle = i * angleSlice - Math.PI / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    axes.push({ x1: center, y1: center, x2: x, y2: y });
  }

  // 2. 실제 데이터 기준 다각형 그리기
  const dataPoints = [];
  for (let i = 0; i < total; i++) {
    const metric = compositeStats[i];
    const val = Math.round(metric.val); // 소수점 방지
    // 최대 maxStat에 클램핑 (100 초과 보너스도 테두리에 맞춤)
    const ratio = Math.min(val / maxStat, 1);
    const angle = i * angleSlice - Math.PI / 2;
    const x = center + Math.cos(angle) * radius * ratio;
    const y = center + Math.sin(angle) * radius * ratio;
    dataPoints.push({ x, y, val });
  }
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  // 3. 외곽 라벨 위치 계산
  const labels = compositeStats.map((metric, i) => {
    const val = metric.val;
    const labelRadius = radius * 1.25; // 라벨은 촘촘히 겉에 배치
    const angle = i * angleSlice - Math.PI / 2;
    const x = center + Math.cos(angle) * labelRadius;
    const y = center + Math.sin(angle) * labelRadius;
    
    // 텍스트 정렬 보정
    const isTopOrBottom = Math.abs(Math.sin(angle)) > 0.8;
    const isLeft = Math.cos(angle) < -0.1;
    let textAnchor: "middle" | "start" | "end" = "middle";
    if (!isTopOrBottom) {
      if (isLeft) textAnchor = 'end';
      else textAnchor = 'start';
    }

    return { x, y, label: metric.label, val, textAnchor, isTopOrBottom };
  });

  // text opacity parsing
  const isDarkText = textColor !== '#ffffff';
  const labelOpacity = isDarkText ? 0.7 : 0.7;
  const valOpacity = isDarkText ? 1 : 1;

  // grid inner color
  const gridFill = isDarkText ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.02)';
  const gridAltFill = isDarkText ? 'transparent' : 'rgba(0, 0, 0, 0.02)';

  return (
    <div className="relative font-bold flex items-center justify-center pointer-events-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <defs>
          <filter id="glow-neon">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 그리드 외곽 라인 */}
        {gridLines.map((pts, i) => (
          <polygon
            key={`grid-${i}`}
            points={pts}
            fill={i % 2 === 0 ? gridFill : gridAltFill}
            stroke={gridColor}
            strokeWidth="1"
          />
        ))}

        {/* 축 선 */}
        {axes.map((axis, i) => (
          <line
            key={`axis-${i}`}
            x1={axis.x1} y1={axis.y1}
            x2={axis.x2} y2={axis.y2}
            stroke={gridColor}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        ))}

        {/* 데이터 폴리곤 면적 */}
        <polygon
          points={polygonPoints}
          fill={color}
          fillOpacity="0.4"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="transition-all duration-300 ease-out"
        />

        {/* 폴리곤 스탯 데이터 꼭지점 */}
        {dataPoints.map((p, i) => (
          <circle
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={color}
            stroke={textColor}
            strokeWidth="1"
            className="transition-all duration-300 ease-out"
          />
        ))}

        {/* 라벨 & 텍스트 */}
        {labels.map((L, i) => (
          <g key={`label-${i}`} transform={`translate(${L.x}, ${L.y})`} className="opacity-90">
            <text
              textAnchor={L.textAnchor}
              y={L.isTopOrBottom ? -6 : -2}
              fill={textColor}
              opacity={labelOpacity}
              fontSize="12"
              fontWeight="bold"
            >
              {L.label}
            </text>
            <text
              textAnchor={L.textAnchor}
              y={L.isTopOrBottom ? 10 : 12}
              fill={textColor}
              opacity={valOpacity}
              fontSize="14"
              fontWeight="bold"
            >
              {L.val}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
