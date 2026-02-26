import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Globe } from "lucide-react";
import { NODE_TYPES } from "../constants";

const config = NODE_TYPES.external;

function ExternalNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as { label: string; description?: string };
  return (
    <div className="relative" style={{ minWidth: 130 }}>
      <div
        className="px-4 py-3 shadow-sm border-2 transition-shadow"
        style={{
          backgroundColor: config.bgColor,
          borderColor: selected ? config.color : config.borderColor,
          boxShadow: selected
            ? `0 0 0 2px ${config.color}40`
            : "0 1px 3px rgba(0,0,0,0.1)",
          clipPath:
            "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
          padding: "16px 28px",
        }}
      >
        <div className="flex items-center gap-2 justify-center">
          <Globe
            className="h-4 w-4 shrink-0"
            style={{ color: config.color }}
          />
          <span
            className="text-xs font-semibold truncate max-w-[100px]"
            style={{ color: config.color }}
          >
            {nodeData.label}
          </span>
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !border-2"
        style={{ borderColor: config.borderColor, backgroundColor: "white" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-2"
        style={{ borderColor: config.borderColor, backgroundColor: "white" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2 !h-2 !border-2"
        style={{ borderColor: config.borderColor, backgroundColor: "white" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2 !h-2 !border-2"
        style={{ borderColor: config.borderColor, backgroundColor: "white" }}
      />
    </div>
  );
}

export const ExternalNode = memo(ExternalNodeComponent);
