interface Props {
  values: number[];
  width?: number;
  height?: number;
  ariaLabel: string;
}

export function Sparkline({ values, width = 320, height = 80, ariaLabel }: Props) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * innerW;
    const y = padY + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPath = `${path} L${points[points.length - 1]![0].toFixed(2)},${(padY + innerH).toFixed(2)} L${points[0]![0].toFixed(2)},${(padY + innerH).toFixed(2)} Z`;
  const lastX = points[points.length - 1]![0];
  const lastY = points[points.length - 1]![1];
  const trendUp = values[values.length - 1]! >= values[0]!;
  const stroke = trendUp ? 'oklch(0.65 0.15 145)' : 'oklch(0.6 0.2 25)';

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-20 w-full"
    >
      <path d={areaPath} fill={stroke} fillOpacity="0.12" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={stroke} />
    </svg>
  );
}
