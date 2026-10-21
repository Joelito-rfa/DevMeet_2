import { memo } from 'react';
import { Arrow, Ellipse, Group, Line, Rect, Text } from 'react-konva';
import { arrowPoints } from './geometry';

const FONT = { hand: 'Caveat', sans: 'Inter' };
export const fontFamily = (f) => (f === 'Inter' || f === 'sans' ? FONT.sans : f === 'mono' ? 'JetBrains Mono' : FONT.hand);

function Label({ el, w, h, hidden, padding = 10, align = 'center', valign = 'middle', color }) {
  if (!el.text) return null;
  return (
    <Text
      x={0}
      y={0}
      width={w}
      height={h}
      padding={padding}
      text={el.text}
      align={align}
      verticalAlign={valign}
      fontSize={el.fontSize || 22}
      fontFamily={fontFamily(el.fontFamily)}
      fill={color || el.textColor || '#111827'}
      lineHeight={1.15}
      visible={!hidden}
      listening={false}
      wrap="word"
    />
  );
}

function ElementShapeBase({ el, elements, interactive = true, draggable, editing, handlers = {}, textSize }) {
  const dash = el.dash ? [Math.max(6, (el.strokeWidth || 2) * 3), Math.max(5, (el.strokeWidth || 2) * 2.2)] : undefined;
  const common = {
    id: el.id,
    name: 'element',
    x: el.x || 0,
    y: el.y || 0,
    rotation: el.rotation || 0,
    scaleX: el.scaleX || 1,
    scaleY: el.scaleY || 1,
    opacity: el.opacity ?? 1,
    listening: interactive,
    draggable: interactive && draggable,
    perfectDrawEnabled: false,
    ...(interactive ? handlers : {}),
  };
  const w = el.width || 0;
  const h = el.height || 0;
  const stroke = el.stroke || '#111827';
  const sw = el.strokeWidth ?? 3;

  switch (el.type) {
    case 'path':
      return (
        <Line
          {...common}
          points={el.points}
          stroke={stroke}
          strokeWidth={sw}
          tension={0.45}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(16, sw)}
          globalCompositeOperation={el.tool === 'highlighter' ? 'multiply' : 'source-over'}
          shadowForStrokeEnabled={false}
        />
      );
    case 'line':
      return <Line {...common} points={el.points} stroke={stroke} strokeWidth={sw} dash={dash} lineCap="round" hitStrokeWidth={Math.max(16, sw)} />;
    case 'arrow': {
      const bound = el.fromId || el.toId;
      const pts = elements ? arrowPoints(el, elements, textSize) : el.points;
      return (
        <Arrow
          {...common}
          draggable={common.draggable && !bound}
          points={pts}
          stroke={stroke}
          fill={stroke}
          strokeWidth={sw}
          dash={dash}
          pointerLength={8 + sw * 2}
          pointerWidth={8 + sw * 2}
          pointerAtBeginning={!!el.doubleHead}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(16, sw)}
        />
      );
    }
    case 'rect':
      return (
        <Group {...common}>
          <Rect width={w} height={h} cornerRadius={el.radius ?? 8} stroke={stroke} strokeWidth={sw} fill={el.fill || 'transparent'} dash={dash} />
          <Label el={el} w={w} h={h} hidden={editing} />
        </Group>
      );
    case 'ellipse':
      return (
        <Group {...common}>
          <Ellipse x={w / 2} y={h / 2} radiusX={Math.abs(w / 2)} radiusY={Math.abs(h / 2)} stroke={stroke} strokeWidth={sw} fill={el.fill || 'transparent'} dash={dash} />
          <Label el={el} w={w} h={h} hidden={editing} />
        </Group>
      );
    case 'diamond':
      return (
        <Group {...common}>
          <Line points={[w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]} closed stroke={stroke} strokeWidth={sw} fill={el.fill || 'transparent'} dash={dash} lineJoin="round" />
          <Label el={el} w={w} h={h} hidden={editing} padding={w * 0.18} />
        </Group>
      );
    case 'triangle':
      return (
        <Group {...common}>
          <Line points={[w / 2, 0, w, h, 0, h]} closed stroke={stroke} strokeWidth={sw} fill={el.fill || 'transparent'} dash={dash} lineJoin="round" />
          <Label el={el} w={w} h={h} hidden={editing} padding={w * 0.2} valign="bottom" />
        </Group>
      );
    case 'text':
      return (
        <Text
          {...common}
          text={el.text || ' '}
          fontSize={el.fontSize || 28}
          fontFamily={fontFamily(el.fontFamily)}
          fontStyle={el.bold ? 'bold' : 'normal'}
          fill={el.fill || '#111827'}
          lineHeight={1.15}
          visible={!editing}
          hitStrokeWidth={0}
        />
      );
    case 'sticky':
      return (
        <Group {...common}>
          <Rect width={w} height={h} fill={el.fill || '#fde68a'} cornerRadius={3} shadowColor="#000" shadowOpacity={0.22} shadowBlur={14} shadowOffsetY={6} />
          <Rect x={w / 2 - 34} y={-8} width={68} height={18} fill="rgba(255,255,255,0.55)" rotation={-2} listening={false} />
          <Label el={el} w={w} h={h} hidden={editing} padding={16} align="left" valign="top" color="#1f2937" />
        </Group>
      );
    default:
      return null;
  }
}

export default memo(ElementShapeBase);
