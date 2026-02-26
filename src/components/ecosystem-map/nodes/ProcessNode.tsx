import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Workflow } from "lucide-react";
import { NODE_TYPES } from "../constants";

const config = NODE_TYPES.process;

function ProcessNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as { label: string; description?: string };
  return (
    <div className="relative" style={{ minWidth: 140 }}>
      <div
        className="rounded-[24px] px-5 py-3 shadow-sm border-2 transition-shadow"
        style={{
          backgroundColor: config.bgColor,
          borderColor: selected ? config.color : config.borderColor,
          boxShadow: selected
            ? `0 0 0 2px ${config.color}40`
            : "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div className="flex items-center gap-2 justify-center">
          <Workflow
            className="h-4 w-4 shrink-0"
            style={{ color: config.color }}
          />
          <span
            className="text-sm font-semibold truncate max-w-[140px]"
            style={{ color: config.color }}
          >
            {nodeData.label}
          </span>
        </div>
        {nodeData.description && (
          <p className="text-xs text-slate-500 mt-1 truncate max-w-[160px] text-center">
            {nodeData.description}
          </p>
        )}
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

export const ProcessNode = memo(ProcessNodeComponent);
