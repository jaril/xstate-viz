import { StateNode } from 'xstate';

export class DirectedGraphNode {
  public id: string;
  public data: StateNode;
}

export function toDirectedGraph(stateNode: StateNode): DirectedGraphNode {
  const edges: DirectedGraphEdge[] = flatten(
    stateNode.transitions.map((t, transitionIndex) => {
      const targets = t.target ? t.target : [stateNode];

      return targets.map((target, targetIndex) => {
        const edge = new DirectedGraphEdge({
          id: `${stateNode.id}:${transitionIndex}:${targetIndex}`,
          source: stateNode,
          target,
          transition: t,
          label: {
            text: t.eventType,
            x: 0,
            y: 0,
          },
          sections: [],
        });

        return edge;
      });
    }),
  );

  const graph = new DirectedGraphNode({
    id: stateNode.id,
    stateNode,
    children: getChildren(stateNode).map((sn) => toDirectedGraph(sn)),
    edges,
    ports: [],
  });

  return graph;
}
