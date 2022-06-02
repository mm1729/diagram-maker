import classnames from 'classnames';
import * as Preact from 'preact';

import { DiagramMakerComponentsType } from 'diagramMaker/service/ui/types';
import { Position } from 'diagramMaker/state/types';

import EdgeCurve, { EdgeStyle } from './EdgeCurve';

import './Edge.scss';

export interface PotentialEdgeProps {
  src: Position;
  dest: Position;
  edgeStyle: EdgeStyle;
  className?: string;
  showArrowhead?: boolean;
  vertices?: Position[];
}

const getCurve = ({
  src,
  dest,
  edgeStyle,
  className,
  showArrowhead,
  vertices,
}: PotentialEdgeProps) => (
  <EdgeCurve
    src={src}
    dest={dest}
    edgeStyle={edgeStyle}
    className={className}
    showArrowhead={showArrowhead}
    vertices={vertices}
  />
);

function PotentialEdge(props: Preact.RenderableProps<PotentialEdgeProps>): JSX.Element {
  const {
    src, dest, className, edgeStyle, showArrowhead, vertices
  } = props;

  const classNames = classnames('dm-edge', className);

  const curvePath = getCurve({
    src, dest, edgeStyle, className: 'dm-path-inner', showArrowhead, vertices
  });

  return (
    <g
      className={classNames}
      data-type={DiagramMakerComponentsType.POTENTIAL_EDGE}
    >
      {curvePath}
    </g>
  );
}

export default PotentialEdge;
