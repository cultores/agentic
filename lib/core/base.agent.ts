import { Injectable } from '@nestjs/common';
import {
  AgentGraph,
  AgentNode,
  AgentEdge,
} from '../decorators/agent.decorators';
import { 
  AgentState, 
  AgentEdgeOptions,
  AgentNodeOptions 
} from '../interfaces/agent.interfaces';

@AgentGraph({
  name: 'base-agent',
  description: 'Base agent implementation',
})
@Injectable()
export abstract class BaseAgent {
  protected tools: any[] = [];
  protected nodes: any[] = [];
  protected edges: any[] = [];

  @AgentNode({
    name: 'start',
    description: 'Start node',
    type: 'llm',
  })
  async start(state: AgentState) {
    return { messages: state.messages };
  }

  @AgentEdge({
    from: '__start__',
    to: 'start',
  })
  startEdge(state: AgentState) {
    return state;
  }

  async run(input: any): Promise<AgentState> {
    const nodes = Reflect.getMetadata('agent:nodes', this.constructor) || [];
    const edges = Reflect.getMetadata('agent:edges', this.constructor) || [];
    let currentState: AgentState = {
      messages: [],
      context: {},
      metadata: {},
      ...input,
    };

    // Create a map of nodes by name for quick lookup
    const nodeMap = new Map<string, { name: string; method: Function } & AgentNodeOptions>(
      nodes.map(node => [node.name, node])
    );
    
    // Create an adjacency list of edges with their methods
    const edgeMap = new Map<string, (AgentEdgeOptions & { method: Function })[]>();
    for (const edge of edges) {
      if (!edgeMap.has(edge.from)) {
        edgeMap.set(edge.from, []);
      }
      edgeMap.get(edge.from)!.push(edge);
    }

    // Start from __start__ node
    let currentNode = '__start__';

    // Execute nodes following the graph edges until we reach a node with no outgoing edges
    while (true) {
      // Get outgoing edges for current node
      const outgoingEdges = edgeMap.get(currentNode) || [];
      if (outgoingEdges.length === 0) {
        break; // No more edges to follow, we're done
      }

      // Find the next edge to follow
      let nextEdge: (AgentEdgeOptions & { method: Function }) | undefined;
      if (outgoingEdges.length === 1) {
        nextEdge = outgoingEdges[0];
      } else {
        // If multiple edges, evaluate conditions to find the right one
        for (const edge of outgoingEdges) {
          if (!edge.condition || edge.condition(currentState) === edge.to) {
            nextEdge = edge;
            break;
          }
        }
        if (!nextEdge) {
          nextEdge = outgoingEdges[0]; // Default to first edge if no conditions match
        }
      }

      // Execute the edge method
      currentState = await nextEdge.method.call(this, currentState);

      // Execute the next node
      const nextNode = nodeMap.get(nextEdge.to);
      if (!nextNode) {
        throw new Error(`Node ${nextEdge.to} not found in graph`);
      }

      currentState = await nextNode.method.call(this, currentState);
      currentNode = nextEdge.to;
    }

    return currentState;
  }
}
