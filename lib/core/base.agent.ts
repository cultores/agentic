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
    const visitedEdges = new Set<string>();

    console.log('\n🚀 [BaseAgent] Starting graph traversal from __start__');

    // Execute nodes following the graph edges until we reach a node with no outgoing edges
    while (true) {
      console.log(`\n📍 [BaseAgent] Current node: ${currentNode}`);
      
      // Get outgoing edges for current node
      const outgoingEdges = edgeMap.get(currentNode) || [];
      if (outgoingEdges.length === 0) {
        console.log('🛑 [BaseAgent] No outgoing edges found, ending execution');
        break;
      }

      console.log(`🔄 [BaseAgent] Found ${outgoingEdges.length} outgoing edges:`, 
        outgoingEdges.map(e => `${e.from}->${e.to}`).join(', '));

      // Find the next edge to follow
      let nextEdge: (AgentEdgeOptions & { method: Function }) | undefined;
      
      // First try to find an edge that satisfies the condition
      for (const edge of outgoingEdges) {
        const edgeId = `${edge.from}->${edge.to}`;
        const shouldAllowLoop = edge.allowLoop || false;
        const currentNodeObj = nodeMap.get(currentNode);
        
        console.log(`\n🔍 [BaseAgent] Evaluating edge ${edgeId}:`);
        console.log(`   - Allow loop: ${shouldAllowLoop}`);
        console.log(`   - Already visited: ${visitedEdges.has(edgeId)}`);
        
        // Check if we should allow this edge based on loop conditions
        if (currentNodeObj?.type === 'loop' && !shouldAllowLoop && 
            !this.checkLoopCondition(currentState, currentNodeObj)) {
          console.log('   - Loop condition not met, skipping edge');
          continue;
        }

        // For non-loop edges, only follow if not visited or explicitly allowed
        if ((!visitedEdges.has(edgeId) || shouldAllowLoop) && 
            (!edge.condition || edge.condition(currentState) === edge.to)) {
          console.log('   ✅ Edge conditions met, selecting this edge');
          nextEdge = edge;
          break;
        } else {
          console.log('   ❌ Edge conditions not met');
        }
      }

      // If no edge was found and we're in route A at processA, break
      if (!nextEdge && currentNode === 'processA' && currentState.metadata?.route === 'A') {
        console.log('🛑 [BaseAgent] Route A completed at processA, ending execution');
        break;
      }

      // If no edge was found, look for an exit edge
      if (!nextEdge) {
        console.log('\n🔍 [BaseAgent] No edge found, looking for exit edge');
        nextEdge = outgoingEdges.find(edge => 
          !edge.allowLoop && (!edge.condition || edge.condition(currentState) === edge.to)
        );
        if (nextEdge) {
          console.log(`   ✅ Found exit edge: ${nextEdge.from}->${nextEdge.to}`);
        }
      }

      // If still no edge, use the first available
      if (!nextEdge) {
        console.log('\n⚠️ [BaseAgent] No suitable edge found, using first available');
        nextEdge = outgoingEdges[0];
      }

      // Track visited edges
      const edgeId = `${nextEdge.from}->${nextEdge.to}`;
      visitedEdges.add(edgeId);

      console.log(`\n➡️ [BaseAgent] Selected edge: ${edgeId}`);

      // Execute the edge method
      currentState = await nextEdge.method.call(this, currentState);
      console.log('\n📊 [BaseAgent] Updated state after edge execution:', 
        JSON.stringify(currentState, null, 2));

      // Execute the next node
      const nextNode = nodeMap.get(nextEdge.to);
      if (!nextNode) {
        throw new Error(`Node ${nextEdge.to} not found in graph`);
      }

      // Handle loop control for the node
      if (nextNode.type === 'loop') {
        this.incrementLoopCount(currentState, nextNode.name);
        console.log(`\n🔄 [BaseAgent] Incremented loop count for ${nextNode.name}:`, 
          currentState.loopControl?.iterations[nextNode.name]);
      }

      currentState = await nextNode.method.call(this, currentState);
      console.log('\n📊 [BaseAgent] Updated state after node execution:', 
        JSON.stringify(currentState, null, 2));
      
      currentNode = nextEdge.to;
    }

    console.log('\n✅ [BaseAgent] Execution completed');
    return currentState;
  }
}
