"use client";

import { Building2, User, Globe, Workflow, Maximize, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NODE_TYPES, type NodeType } from "./constants";

const nodeButtons: { type: NodeType; icon: typeof Building2 }[] = [
  { type: "org_unit", icon: Building2 },
  { type: "individual", icon: User },
  { type: "external", icon: Globe },
  { type: "process", icon: Workflow },
];

interface EcosystemToolbarProps {
  onAddNode: (type: NodeType) => void;
  onFitView: () => void;
  onImport: () => void;
}

export function EcosystemToolbar({ onAddNode, onFitView, onImport }: EcosystemToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-lg border bg-white/95 backdrop-blur-sm p-1.5 shadow-md">
        {nodeButtons.map(({ type, icon: Icon }) => {
          const config = NODE_TYPES[type];
          return (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onAddNode(type)}
                >
                  <Icon className="h-4 w-4" style={{ color: config.color }} />
                  <span className="sr-only">Add {config.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">{config.label}</p>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="mx-1 h-6 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onFitView}>
              <Maximize className="h-4 w-4" />
              <span className="sr-only">Fit View</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Fit to View</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onImport}>
              <Download className="h-4 w-4" />
              <span className="sr-only">Import Org Data</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Import from Org Data</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
