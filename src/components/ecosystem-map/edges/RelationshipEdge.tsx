import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { RELATIONSHIP_TYPES, type RelationshipType } from "../constants";

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as {
    relationshipType: RelationshipType;
    label?: string;
  };
  const relType = edgeData?.relationshipType || "reporting";
  const config = RELATIONSHIP_TYPES[relType];

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: config.color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: config.strokeDasharray,
          filter: selected ? `drop-shadow(0 0 3px ${config.color}80)` : undefined,
        }}
        className={config.animated ? "react-flow__edge-animated" : undefined}
      />
      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute rounded bg-white px-2 py-0.5 text-xs font-medium shadow-sm border"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              color: config.color,
              borderColor: `${config.color}40`,
            }}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
