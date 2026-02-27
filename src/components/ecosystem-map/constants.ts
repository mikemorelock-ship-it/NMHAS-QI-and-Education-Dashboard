// ---------------------------------------------------------------------------
// Ecosystem Map — node & edge type configuration
// ---------------------------------------------------------------------------

export const NODE_TYPES = {
  org_unit: {
    label: "Org Unit",
    description: "Division, department, team, or committee",
    color: "#0d9488", // teal-600
    bgColor: "#ccfbf1", // teal-100
    borderColor: "#14b8a6", // teal-500
    icon: "Building2",
  },
  individual: {
    label: "Individual",
    description: "Named person or titled role",
    color: "#16a34a", // green-600
    bgColor: "#dcfce7", // green-100
    borderColor: "#22c55e", // green-500
    icon: "User",
  },
  external: {
    label: "External",
    description: "Partner agency, regulator, or customer",
    color: "#ea580c", // orange-600
    bgColor: "#ffedd5", // orange-100
    borderColor: "#f97316", // orange-500
    icon: "Globe",
  },
  process: {
    label: "Process",
    description: "QI campaign, protocol, or workflow",
    color: "#9333ea", // purple-600
    bgColor: "#f3e8ff", // purple-100
    borderColor: "#a855f7", // purple-500
    icon: "Workflow",
  },
} as const;

export type NodeType = keyof typeof NODE_TYPES;

export const RELATIONSHIP_TYPES = {
  reporting: {
    label: "Reporting / Hierarchy",
    description: "Reports to, supervisory chain",
    color: "#475569", // slate-600
    strokeDasharray: undefined, // solid
    animated: false,
    markerEnd: "arrow",
  },
  collaboration: {
    label: "Collaboration",
    description: "Partnership, shared project, mutual aid",
    color: "#3b82f6", // blue-500
    strokeDasharray: "8 4",
    animated: false,
    markerEnd: "arrowBoth",
  },
  process_flow: {
    label: "Process / Data Flow",
    description: "Information, patient, or data flow",
    color: "#10b981", // emerald-500
    strokeDasharray: "8 4",
    animated: true,
    markerEnd: "arrow",
  },
  influence: {
    label: "Influence / Advisory",
    description: "Consultative, regulatory, mentorship",
    color: "#f59e0b", // amber-500
    strokeDasharray: "3 3",
    animated: false,
    markerEnd: "diamond",
  },
} as const;

export type RelationshipType = keyof typeof RELATIONSHIP_TYPES;
