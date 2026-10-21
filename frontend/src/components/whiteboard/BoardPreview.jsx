import { memo, useMemo } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import ElementShape from './ElementShape';
import { bbox, sortByZ } from './geometry';

export function contentBounds(list) {
  if (!list.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of list) {
    const b = bbox(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Rendu miniature non interactif d'un ensemble d'éléments (minimap, historique). */
function BoardPreviewBase({ elements, width, height, viewport, onNavigate, padding = 20 }) {
  const list = useMemo(() => sortByZ(Object.values(elements)), [elements]);
  const map = elements;
  const { scale, ox, oy } = useMemo(() => {
    let b = contentBounds(list) || { x: 0, y: 0, width: 400, height: 300 };
    if (viewport) {
      const x = Math.min(b.x, viewport.x);
      const y = Math.min(b.y, viewport.y);
      b = { x, y, width: Math.max(b.x + b.width, viewport.x + viewport.width) - x, height: Math.max(b.y + b.height, viewport.y + viewport.height) - y };
    }
    const s = Math.min((width - padding * 2) / Math.max(b.width, 1), (height - padding * 2) / Math.max(b.height, 1), 1);
    return { scale: s, ox: (width - b.width * s) / 2 - b.x * s, oy: (height - b.height * s) / 2 - b.y * s };
  }, [list, viewport, width, height, padding]);

  const onClick = (e) => {
    if (!onNavigate) return;
    const p = e.target.getStage().getPointerPosition();
    onNavigate({ x: (p.x - ox) / scale, y: (p.y - oy) / scale });
  };

  return (
    <Stage width={width} height={height} onPointerDown={onClick} style={{ cursor: onNavigate ? 'pointer' : 'default' }}>
      <Layer x={ox} y={oy} scaleX={scale} scaleY={scale} listening={!!onNavigate}>
        <Rect x={-1e5} y={-1e5} width={2e5} height={2e5} fill="#ffffff" />
        {list.map((el) => (
          <ElementShape key={el.id} el={el} interactive={false} elements={el.type === 'arrow' ? map : undefined} />
        ))}
        {viewport && (
          <Rect x={viewport.x} y={viewport.y} width={viewport.width} height={viewport.height} stroke="#5865F2" strokeWidth={2 / scale} fill="rgba(88,101,242,0.10)" listening={false} />
        )}
      </Layer>
    </Stage>
  );
}

export default memo(BoardPreviewBase);
