"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  type OnNodeDrag,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "@/components/ecosystem-map/nodes";
import { edgeTypes } from "@/components/ecosystem-map/edges";
import { EcosystemToolbar } from "@/components/ecosystem-map/EcosystemToolbar";
import { MapSelectorBar, type MapSummary } from "@/components/ecosystem-map/MapSelectorBar";
import { NodePropertiesPanel } from "@/components/ecosystem-map/NodePropertiesPanel";
import { EdgePropertiesPanel } from "@/components/ecosystem-map/EdgePropertiesPanel";
import { ImportOrgDataDialog } from "@/components/ecosystem-map/ImportOrgDataDialog";
import { ConnectionTypeDialog } from "@/components/ecosystem-map/ConnectionTypeDialog";
import {
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  type NodeType,
  type RelationshipType,
} from "@/components/ecosystem-map/constants";
import {
  createEcosystemMap,
  updateEcosystemMap,
  deleteEcosystemMap,
  getEcosystemMap,
  createEcosystemNode,
  updateEcosystemNode,
  updateNodePositions,
  deleteEcosystemNode,
  createEcosystemEdge,
  updateEcosystemEdge,
  deleteEcosystemEdge,
  importOrgData,
} from "@/actions/ecosystem-maps";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DbNode {
  id: string;
  mapId: string;
  nodeType: string;
  label: string;
  description: string | null;
  positionX: number;
  positionY: number;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  color: string | null;
}

interface DbEdge {
  id: string;
  mapId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  label: string | null;
  description: string | null;
}

interface OrgData {
  divisions: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  users: { id: string; firstName: string; lastName: string }[];
}

interface EcosystemMapClientProps {
  initialMaps: MapSummary[];
  orgData: OrgData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dbNodeToFlowNode(n: DbNode): Node {
  return {
    id: n.id,
    type: n.nodeType,
    position: { x: n.positionX, y: n.positionY },
    data: {
      label: n.label,
      description: n.description ?? undefined,
      nodeType: n.nodeType,
      linkedEntityType: n.linkedEntityType,
      linkedEntityId: n.linkedEntityId,
    },
  };
}

function dbEdgeToFlowEdge(e: DbEdge): Edge {
  const relType = e.relationshipType as RelationshipType;
  const config = RELATIONSHIP_TYPES[relType] || RELATIONSHIP_TYPES.reporting;
  return {
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    type: "relationship",
    animated: config.animated,
    markerEnd: { type: MarkerType.ArrowClosed, color: config.color },
    data: {
      relationshipType: relType,
      label: e.label ?? undefined,
      description: e.description ?? undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Inner component (needs ReactFlow context)
// ---------------------------------------------------------------------------

function EcosystemMapInner({ initialMaps, orgData }: EcosystemMapClientProps) {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [maps, setMaps] = useState<MapSummary[]>(initialMaps);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(initialMaps[0]?.id ?? null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [showConnectionType, setShowConnectionType] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Track position changes for batch save
  const positionUpdatesRef = useRef<Map<string, { positionX: number; positionY: number }>>(
    new Map()
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computed selected objects
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const n = nodes.find((n) => n.id === selectedNodeId);
    if (!n) return null;
    return {
      id: n.id,
      label: (n.data as Record<string, unknown>).label as string,
      description: (n.data as Record<string, unknown>).description as string | undefined,
      nodeType: (n.data as Record<string, unknown>).nodeType as NodeType,
      linkedEntityType: (n.data as Record<string, unknown>).linkedEntityType as string | null,
      linkedEntityId: (n.data as Record<string, unknown>).linkedEntityId as string | null,
    };
  }, [selectedNodeId, nodes]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId) return null;
    const e = edges.find((e) => e.id === selectedEdgeId);
    if (!e) return null;
    const sourceNode = nodes.find((n) => n.id === e.source);
    const targetNode = nodes.find((n) => n.id === e.target);
    return {
      id: e.id,
      relationshipType: (e.data as Record<string, unknown>).relationshipType as RelationshipType,
      label: (e.data as Record<string, unknown>).label as string | undefined,
      description: (e.data as Record<string, unknown>).description as string | undefined,
      sourceName: sourceNode
        ? ((sourceNode.data as Record<string, unknown>).label as string)
        : undefined,
      targetName: targetNode
        ? ((targetNode.data as Record<string, unknown>).label as string)
        : undefined,
    };
  }, [selectedEdgeId, edges, nodes]);

  // Connection source/target names for the dialog
  const pendingConnectionNames = useMemo(() => {
    if (!pendingConnection) return { source: "", target: "" };
    const src = nodes.find((n) => n.id === pendingConnection.source);
    const tgt = nodes.find((n) => n.id === pendingConnection.target);
    return {
      source: src ? ((src.data as Record<string, unknown>).label as string) : "",
      target: tgt ? ((tgt.data as Record<string, unknown>).label as string) : "",
    };
  }, [pendingConnection, nodes]);

  // ---------------------------------------------------------------------------
  // Load map data
  // ---------------------------------------------------------------------------

  const loadMap = useCallback(
    async (mapId: string) => {
      const map = await getEcosystemMap(mapId);
      if (!map) return;

      const flowNodes = map.nodes.map(dbNodeToFlowNode);
      const flowEdges = map.edges.map(dbEdgeToFlowEdge);

      setNodes(flowNodes);
      setEdges(flowEdges);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setMapLoaded(true);

      // Fit view after a brief delay to let React render
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    },
    [setNodes, setEdges, fitView]
  );

  // Load initial map on mount
  const initialMapId = useRef(selectedMapId);
  useEffect(() => {
    if (initialMapId.current) {
      loadMap(initialMapId.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Map CRUD handlers
  // ---------------------------------------------------------------------------

  const handleSelectMap = useCallback(
    (mapId: string) => {
      setSelectedMapId(mapId);
      loadMap(mapId);
    },
    [loadMap]
  );

  const handleCreateMap = useCallback(
    async (name: string, description: string) => {
      const result = await createEcosystemMap({
        name,
        description: description || null,
      });
      if (result.success && result.data) {
        const newMap: MapSummary = {
          id: result.data.id,
          name,
          slug: "",
          description: description || null,
          _count: { nodes: 0, edges: 0 },
        };
        setMaps((prev) => [newMap, ...prev]);
        setSelectedMapId(result.data.id);
        setNodes([]);
        setEdges([]);
        setMapLoaded(true);
      }
    },
    [setNodes, setEdges]
  );

  const handleUpdateMap = useCallback(async (id: string, name: string, description: string) => {
    const result = await updateEcosystemMap(id, {
      name,
      description: description || null,
    });
    if (result.success) {
      setMaps((prev) =>
        prev.map((m) => (m.id === id ? { ...m, name, description: description || null } : m))
      );
    }
  }, []);

  const handleDeleteMap = useCallback(
    async (id: string) => {
      const result = await deleteEcosystemMap(id);
      if (result.success) {
        const remaining = maps.filter((m) => m.id !== id);
        setMaps(remaining);
        if (remaining.length > 0) {
          handleSelectMap(remaining[0].id);
        } else {
          setSelectedMapId(null);
          setNodes([]);
          setEdges([]);
          setMapLoaded(false);
        }
      }
    },
    [maps, handleSelectMap, setNodes, setEdges]
  );

  // ---------------------------------------------------------------------------
  // Node operations
  // ---------------------------------------------------------------------------

  const handleAddNode = useCallback(
    async (type: NodeType) => {
      if (!selectedMapId) return;

      const config = NODE_TYPES[type];
      // Place at center of viewport
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const result = await createEcosystemNode({
        mapId: selectedMapId,
        nodeType: type,
        label: `New ${config.label}`,
        positionX: position.x,
        positionY: position.y,
      });

      if (result.success && result.data) {
        const newNode: Node = {
          id: result.data.id,
          type,
          position,
          data: {
            label: `New ${config.label}`,
            nodeType: type,
          },
        };
        setNodes((prev) => [...prev, newNode]);
        setSelectedNodeId(result.data.id);
        setSelectedEdgeId(null);

        // Update map counts
        setMaps((prev) =>
          prev.map((m) =>
            m.id === selectedMapId
              ? { ...m, _count: { ...m._count, nodes: m._count.nodes + 1 } }
              : m
          )
        );
      }
    },
    [selectedMapId, setNodes, screenToFlowPosition]
  );

  const handleUpdateNode = useCallback(
    async (id: string, data: { label?: string; description?: string; nodeType?: NodeType }) => {
      const result = await updateEcosystemNode(id, data);
      if (result.success) {
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== id) return n;
            const newData = { ...(n.data as Record<string, unknown>) };
            if (data.label !== undefined) newData.label = data.label;
            if (data.description !== undefined) newData.description = data.description;
            if (data.nodeType !== undefined) {
              newData.nodeType = data.nodeType;
              return { ...n, type: data.nodeType, data: newData };
            }
            return { ...n, data: newData };
          })
        );
      }
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    async (id: string) => {
      const result = await deleteEcosystemNode(id);
      if (result.success) {
        setNodes((prev) => prev.filter((n) => n.id !== id));
        setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
        setSelectedNodeId(null);

        setMaps((prev) =>
          prev.map((m) =>
            m.id === selectedMapId
              ? { ...m, _count: { ...m._count, nodes: Math.max(0, m._count.nodes - 1) } }
              : m
          )
        );
      }
    },
    [setNodes, setEdges, selectedMapId]
  );

  // Position save (debounced batch)
  const flushPositionUpdates = useCallback(async () => {
    const updates = Array.from(positionUpdatesRef.current.entries()).map(([id, pos]) => ({
      id,
      ...pos,
    }));
    positionUpdatesRef.current.clear();
    if (updates.length > 0) {
      await updateNodePositions(updates);
    }
  }, []);

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      positionUpdatesRef.current.set(node.id, {
        positionX: node.position.x,
        positionY: node.position.y,
      });

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(flushPositionUpdates, 500);
    },
    [flushPositionUpdates]
  );

  // ---------------------------------------------------------------------------
  // Edge operations
  // ---------------------------------------------------------------------------

  const onConnect: OnConnect = useCallback((connection) => {
    // Store pending connection and show type picker
    setPendingConnection(connection);
    setShowConnectionType(true);
  }, []);

  const handleConnectionTypeSelect = useCallback(
    async (relType: RelationshipType) => {
      if (!pendingConnection || !selectedMapId) return;

      const result = await createEcosystemEdge({
        mapId: selectedMapId,
        sourceNodeId: pendingConnection.source!,
        targetNodeId: pendingConnection.target!,
        relationshipType: relType,
      });

      if (result.success && result.data) {
        const config = RELATIONSHIP_TYPES[relType];
        const newEdge: Edge = {
          id: result.data.id,
          source: pendingConnection.source!,
          target: pendingConnection.target!,
          sourceHandle: pendingConnection.sourceHandle,
          targetHandle: pendingConnection.targetHandle,
          type: "relationship",
          animated: config.animated,
          markerEnd: { type: MarkerType.ArrowClosed, color: config.color },
          data: { relationshipType: relType },
        };
        setEdges((prev) => addEdge(newEdge, prev));

        setMaps((prev) =>
          prev.map((m) =>
            m.id === selectedMapId
              ? { ...m, _count: { ...m._count, edges: m._count.edges + 1 } }
              : m
          )
        );
      }

      setPendingConnection(null);
    },
    [pendingConnection, selectedMapId, setEdges]
  );

  const handleUpdateEdge = useCallback(
    async (
      id: string,
      data: {
        relationshipType?: RelationshipType;
        label?: string;
        description?: string;
      }
    ) => {
      const result = await updateEcosystemEdge(id, data);
      if (result.success) {
        setEdges((prev) =>
          prev.map((e) => {
            if (e.id !== id) return e;
            const newData = { ...(e.data as Record<string, unknown>) };
            if (data.relationshipType !== undefined) {
              newData.relationshipType = data.relationshipType;
              const config = RELATIONSHIP_TYPES[data.relationshipType];
              return {
                ...e,
                animated: config.animated,
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: config.color,
                },
                data: newData,
              };
            }
            if (data.label !== undefined) newData.label = data.label;
            if (data.description !== undefined) newData.description = data.description;
            return { ...e, data: newData };
          })
        );
      }
    },
    [setEdges]
  );

  const handleDeleteEdge = useCallback(
    async (id: string) => {
      const result = await deleteEcosystemEdge(id);
      if (result.success) {
        setEdges((prev) => prev.filter((e) => e.id !== id));
        setSelectedEdgeId(null);

        setMaps((prev) =>
          prev.map((m) =>
            m.id === selectedMapId
              ? { ...m, _count: { ...m._count, edges: Math.max(0, m._count.edges - 1) } }
              : m
          )
        );
      }
    },
    [setEdges, selectedMapId]
  );

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  const handleImport = useCallback(
    async (options: { divisions: boolean; departments: boolean; users: boolean }) => {
      if (!selectedMapId) return;
      const result = await importOrgData(selectedMapId, options);
      if (result.success) {
        // Reload the map to get the new nodes
        await loadMap(selectedMapId);
      }
    },
    [selectedMapId, loadMap]
  );

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!mapLoaded && maps.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Ecosystem Map</h1>
        <MapSelectorBar
          maps={maps}
          selectedMapId={null}
          onSelectMap={handleSelectMap}
          onCreateMap={handleCreateMap}
          onUpdateMap={handleUpdateMap}
          onDeleteMap={handleDeleteMap}
        />
        <div className="flex items-center justify-center h-[60vh] border rounded-lg bg-muted/20">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">
              No ecosystem maps yet. Create one to get started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Ecosystem Map</h1>
      <MapSelectorBar
        maps={maps}
        selectedMapId={selectedMapId}
        onSelectMap={handleSelectMap}
        onCreateMap={handleCreateMap}
        onUpdateMap={handleUpdateMap}
        onDeleteMap={handleDeleteMap}
      />

      <div
        className="relative border rounded-lg bg-white overflow-hidden"
        style={{ height: "calc(100vh - 220px)" }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: "relationship",
          }}
          deleteKeyCode={null}
          className="ecosystem-flow"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <MiniMap nodeStrokeWidth={3} pannable zoomable className="!bottom-3 !right-3" />
        </ReactFlow>

        <EcosystemToolbar
          onAddNode={handleAddNode}
          onFitView={() => fitView({ padding: 0.2 })}
          onImport={() => setShowImport(true)}
        />

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 rounded-lg border bg-white/95 backdrop-blur-sm p-3 shadow-sm">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Relationships</p>
          <div className="space-y-1">
            {(
              Object.entries(RELATIONSHIP_TYPES) as [
                RelationshipType,
                (typeof RELATIONSHIP_TYPES)[RelationshipType],
              ][]
            ).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="h-0.5 w-5"
                  style={{
                    backgroundColor: config.color,
                    borderStyle:
                      config.strokeDasharray === "3 3"
                        ? "dotted"
                        : config.strokeDasharray
                          ? "dashed"
                          : "solid",
                    borderWidth: config.strokeDasharray ? "1px 0 0 0" : undefined,
                    borderColor: config.strokeDasharray ? config.color : undefined,
                    height: config.strokeDasharray ? 0 : 2,
                  }}
                />
                <span className="text-[10px] text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Properties Panels — key forces remount on selection change */}
        {selectedNode && (
          <NodePropertiesPanel
            key={selectedNode.id}
            node={selectedNode}
            onUpdate={handleUpdateNode}
            onDelete={handleDeleteNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}

        {selectedEdge && (
          <EdgePropertiesPanel
            key={selectedEdge.id}
            edge={selectedEdge}
            onUpdate={handleUpdateEdge}
            onDelete={handleDeleteEdge}
            onClose={() => setSelectedEdgeId(null)}
          />
        )}
      </div>

      {/* Dialogs */}
      <ImportOrgDataDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={handleImport}
        divisionCount={orgData.divisions.length}
        departmentCount={orgData.departments.length}
        userCount={orgData.users.length}
      />

      <ConnectionTypeDialog
        open={showConnectionType}
        onOpenChange={(open) => {
          setShowConnectionType(open);
          if (!open) setPendingConnection(null);
        }}
        onSelect={handleConnectionTypeSelect}
        sourceName={pendingConnectionNames.source}
        targetName={pendingConnectionNames.target}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wrapped export with ReactFlowProvider
// ---------------------------------------------------------------------------

export function EcosystemMapClient(props: EcosystemMapClientProps) {
  return (
    <ReactFlowProvider>
      <EcosystemMapInner {...props} />
    </ReactFlowProvider>
  );
}
