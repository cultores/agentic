import { Injectable } from '@nestjs/common';
import {
  AgentGraph,
  AgentNode,
  AgentEdge,
} from '../decorators/agent.decorators';
import { 
  AgentState, 
  AgentEdgeOptions,
  AgentNodeOptions,
  AgentNodeDefinition,
  EdgeDefinition,
  NodeInput,
  NodeOutput,
  ValidationError
} from '../interfaces/agent.interfaces';

@AgentGraph({
  name: 'base-agent',
  description: 'Base agent implementation',
})
@Injectable()
export abstract class BaseAgent {
  protected tools: Map<string, any> = new Map();
  protected nodes: Map<string, AgentNodeDefinition> = new Map();
  protected edges: Map<string, EdgeDefinition[]> = new Map();
  protected validators: {
    validateNode?: (node: AgentNodeDefinition) => ValidationError[];
    validateEdge?: (edge: EdgeDefinition) => ValidationError[];
  } = {};

  @AgentNode({
    name: 'start',
    description: 'Start node',
    type: 'llm',
  })
  async start(input: NodeInput): Promise<NodeOutput> {
    return { state: input.state };
  }

  @AgentEdge({
    from: '__start__',
    to: 'start',
  })
  startEdge(state: AgentState): AgentState {
    return state;
  }

  private initializeLoopControl(state: AgentState, nodes: any[]): AgentState {
    const maxIterations: Record<string, number> = {};
    nodes.forEach(node => {
      if (node.type === 'loop' && node.maxIterations) {
        maxIterations[node.name] = node.maxIterations;
      }
    });

    return {
      ...state,
      loopControl: {
        iterations: {},
        maxIterations,
      },
    };
  }

  private incrementLoopCount(state: AgentState, nodeName: string): void {
    if (!state.loopControl) {
      state.loopControl = { iterations: {}, maxIterations: {} };
    }
    state.loopControl.iterations[nodeName] = (state.loopControl.iterations[nodeName] || 0) + 1;
  }

  private checkLoopCondition(
    state: AgentState,
    node: { name: string; method: Function } & AgentNodeOptions,
  ): boolean {
    if (!state.loopControl) return false;
    
    const iterations = state.loopControl.iterations[node.name] || 0;
    const maxIterations = state.loopControl.maxIterations[node.name];
    
    // Check max iterations
    if (maxIterations && iterations >= maxIterations) {
      return false;
    }

    // Check custom loop condition if exists
    if (node.loopCondition) {
      return node.loopCondition(state);
    }

    return true;
  }

  private selectNextEdge(
    currentNode: string,
    currentState: AgentState,
    edgeMap: Map<string, (AgentEdgeOptions & { method: Function })[]>,
    nodeMap: Map<string, { name: string; method: Function } & AgentNodeOptions>,
    visitedEdges: Set<string>
  ): (AgentEdgeOptions & { method: Function }) | undefined {
    const outgoingEdges = edgeMap.get(currentNode) || [];
    const currentNodeObj = nodeMap.get(currentNode);
    
    // Fast path for single edge without conditions
    if (outgoingEdges.length === 1 && !outgoingEdges[0].condition) {
      const edge = outgoingEdges[0];
      const edgeId = `${edge.from}->${edge.to}`;
      if (edge.allowLoop || !visitedEdges.has(edgeId)) {
        return edge;
      }
    }

    // Special handling for loop nodes
    if (currentNodeObj?.type === 'loop') {
      // Check if we should continue looping
      const shouldContinueLoop = this.checkLoopCondition(currentState, currentNodeObj);
      
      // Find loop and exit edges
      const loopEdge = outgoingEdges.find(edge => edge.allowLoop);
      const exitEdge = outgoingEdges.find(edge => !edge.allowLoop);
      
      // Continue loop if conditions are met and loop edge exists
      if (shouldContinueLoop && loopEdge) {
        return loopEdge;
      }
      
      // Take exit edge if available
      if (exitEdge) {
        return exitEdge;
      }
    }

    // Standard path for multiple edges or conditional edges
    for (const edge of outgoingEdges) {
      const edgeId = `${edge.from}->${edge.to}`;
      
      // Skip if edge was visited and loops are not allowed
      if (visitedEdges.has(edgeId) && !edge.allowLoop) {
        continue;
      }

      // Check edge condition if present
      if (edge.condition && edge.condition(currentState) !== edge.to) {
        continue;
      }

      return edge;
    }

    return undefined;
  }

  async run(input: any): Promise<AgentState> {
    console.log('\n📋 [BaseAgent] Starting execution with input:', JSON.stringify(input, null, 2));
    
    const nodes = Reflect.getMetadata('agent:nodes', this.constructor) || [];
    const edges = Reflect.getMetadata('agent:edges', this.constructor) || [];
    
    console.log('\n🔍 [BaseAgent] Found nodes:', nodes.map(n => n.name).join(', '));
    console.log('🔍 [BaseAgent] Found edges:', edges.map(e => `${e.from}->${e.to}`).join(', '));
    
    let currentState: AgentState = this.initializeLoopControl({
      messages: [],
      context: {},
      metadata: {},
      ...input,
    }, nodes);

    const nodeMap = new Map<string, { name: string; method: Function } & AgentNodeOptions>(
      nodes.map(node => [node.name, node])
    );
    
    const edgeMap = new Map<string, (AgentEdgeOptions & { method: Function })[]>();
    for (const edge of edges) {
      if (!edgeMap.has(edge.from)) {
        edgeMap.set(edge.from, []);
      }
      edgeMap.get(edge.from)!.push(edge);
    }

    let currentNode = '__start__';
    const visitedEdges = new Set<string>();

    console.log('\n🚀 [BaseAgent] Starting graph traversal from __start__');

    while (true) {
      console.log(`\n📍 [BaseAgent] Current node: ${currentNode}`);
      
      const nextEdge = this.selectNextEdge(currentNode, currentState, edgeMap, nodeMap, visitedEdges);
      
      if (!nextEdge) {
        console.log('🛑 [BaseAgent] No valid edge found, ending execution');
        break;
      }

      const edgeId = `${nextEdge.from}->${nextEdge.to}`;
      visitedEdges.add(edgeId);
      console.log(`\n➡️ [BaseAgent] Selected edge: ${edgeId}`);

      currentState = await nextEdge.method.call(this, currentState);
      
      const nextNode = nodeMap.get(nextEdge.to);
      if (!nextNode) {
        throw new Error(`Node ${nextEdge.to} not found in graph`);
      }

      if (nextNode.type === 'loop') {
        this.incrementLoopCount(currentState, nextNode.name);
      }

      currentState = await nextNode.method.call(this, currentState);
      currentNode = nextEdge.to;
    }

    console.log('\n✅ [BaseAgent] Execution completed');
    return currentState;
  }
}
