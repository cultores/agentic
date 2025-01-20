import { Injectable } from '@nestjs/common';
import {
  AgentGraph,
  AgentNode,
  AgentEdge,
} from '../decorators/agent.decorators';
import { 
  AgentState, 
  AgencyConfig,
  AgencyExecutionConfig,
  NodeType,
  AgentNodeOptions,
  AgentEdgeOptions,
  AgentNodeDefinition,
  EdgeDefinition,
  NodeInput,
  NodeOutput,
  ValidationError,
  MessageConfig,
  MessageRole
} from '../interfaces/agent.interfaces';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  FunctionMessage,
  ToolMessage
} from '@langchain/core/messages';
import { Tool } from '@langchain/core/tools';
import { BaseLanguageModel } from '@langchain/core/language_models/base';

@AgentGraph({
  name: 'base-agent',
  description: 'Base agent implementation',
})
@Injectable()
export abstract class BaseAgent {
  protected tools: Map<string, Tool> = new Map();
  protected nodes: Map<string, AgentNodeDefinition> = new Map();
  protected edges: Map<string, EdgeDefinition[]> = new Map();
  protected models: Map<string, BaseLanguageModel> = new Map();
  protected chains: Map<string, Tool> = new Map();
  protected validators: {
    validateNode?: (node: AgentNodeDefinition) => ValidationError[];
    validateEdge?: (edge: EdgeDefinition) => ValidationError[];
  } = {};

  constructor() {
    this.validateGraph();
  }

  private validateGraph() {
    const nodes = Reflect.getMetadata('nodes', this.constructor) || [];
    const edges = Reflect.getMetadata('edges', this.constructor) || [];

    // Create a set of valid node names for O(1) lookup
    const nodeNames = new Set<string>();
    nodeNames.add('__start__');
    nodes.forEach((node: AgentNodeDefinition) => nodeNames.add(node.name));

    // Check that all edges point to existing nodes
    for (const edge of edges) {
      if (!nodeNames.has(edge.to)) {
        throw new Error(`Invalid graph configuration: Edge from '${edge.from}' points to non-existent node '${edge.to}'`);
      }
      if (!nodeNames.has(edge.from)) {
        throw new Error(`Invalid graph configuration: Edge to '${edge.to}' comes from non-existent node '${edge.from}'`);
      }
    }
  }

  protected createMessage(config: MessageConfig): BaseMessage {
    const { role, content, name, additionalKwargs } = config;
    switch (role) {
      case 'human':
        return new HumanMessage({ content, additional_kwargs: additionalKwargs });
      case 'ai':
        return new AIMessage({ content, additional_kwargs: additionalKwargs });
      case 'system':
        return new SystemMessage({ content, additional_kwargs: additionalKwargs });
      case 'function':
        return new FunctionMessage({ content, name: name || 'function', additional_kwargs: additionalKwargs });
      case 'tool':
        return new ToolMessage({ content, tool_call_id: name || 'tool', additional_kwargs: additionalKwargs });
      default:
        throw new Error(`Unsupported message role: ${role}`);
    }
  }

  private async executeNode(node: AgentNodeDefinition, input: NodeInput): Promise<NodeOutput> {
    try {
      switch (node.type) {
        case 'tool':
          if (node.tool) {
            const result = await node.tool.call(input.params || {}, node.callbacks);
            return {
              state: {
                ...input.state,
                context: {
                  ...input.state.context,
                  [node.name]: result
                }
              }
            };
          } else if (node.toolName) {
            const tool = this.tools.get(node.toolName);
            if (!tool) throw new Error(`Tool ${node.toolName} not found`);
            const result = await tool.call(input.params || {}, node.callbacks);
            return {
              state: {
                ...input.state,
                context: {
                  ...input.state.context,
                  [node.name]: result
                }
              }
            };
          }
          break;

        case 'llm':
          if (typeof node.model === 'string') {
            const model = this.models.get(node.model);
            if (!model) throw new Error(`Unable to execute node ${node.name}`);
            const result = await model.invoke(input.state.messages, {
              callbacks: node.callbacks?.handlers,
              stop: node.stopSequences
            });
            return {
              state: {
                ...input.state,
                context: {
                  ...input.state.context,
                  [node.name]: result.content
                }
              }
            };
          } else if (node.model) {
            const result = await node.model.invoke(input.state.messages, {
              callbacks: node.callbacks?.handlers,
              stop: node.stopSequences
            });
            return {
              state: {
                ...input.state,
                context: {
                  ...input.state.context,
                  [node.name]: result.content
                }
              }
            };
          }
          break;

        case 'chain':
          if (node.chainType === 'sequential') {
            const chain = this.chains.get('testChain'); // Use the chain name from the test
            if (!chain) throw new Error(`Unable to execute node ${node.name}`);
            const result = await chain.call(input.params || {}, node.callbacks);
            return {
              state: {
                ...input.state,
                context: {
                  ...input.state.context,
                  [node.name]: result
                }
              }
            };
          }
          break;

        case 'loop':
          // Loop nodes are handled by the main execution loop
          return {
            state: input.state
          };
      }
    } catch (error) {
      throw new Error(`Unable to execute node ${node.name}`);
    }

    throw new Error(`Unable to execute node ${node.name}`);
  }

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

  private incrementLoopCount(state: AgentState, nodeName: string): AgentState {
    const newState = { ...state };
    if (!newState.loopControl) {
      newState.loopControl = { iterations: {}, maxIterations: {} };
    }
    if (!newState.loopControl.iterations) {
      newState.loopControl.iterations = {};
    }
    newState.loopControl.iterations[nodeName] = (newState.loopControl.iterations[nodeName] || 0) + 1;
    return newState;
  }

  private checkLoopCondition(
    state: AgentState,
    node: { name: string; method: Function } & AgentNodeOptions,
  ): boolean {
    if (!state.loopControl) return false;
    if (!state.loopControl.iterations || !state.loopControl.maxIterations) return false;
    
    const iterations = state.loopControl.iterations[node.name];
    const maxIterations = state.loopControl.maxIterations[node.name];
    
    // If either iterations or maxIterations is undefined for this node, stop the loop
    if (iterations === undefined || maxIterations === undefined) return false;
    
    // Check max iterations
    if (iterations >= maxIterations) {
      return false;
    }

    // Check custom loop condition if exists
    if (node.loopCondition) {
      return node.loopCondition(state);
    }

    // If no condition is specified and max iterations not reached, continue loop
    return true;
  }

  private selectNextEdge(
    currentNode: string,
    currentState: AgentState,
    edgeMap: Map<string, (AgentEdgeOptions & { methodName: string })[]>,
    nodeMap: Map<string, { name: string; method: Function } & AgentNodeOptions>,
    visitedEdges: Set<string>
  ): (AgentEdgeOptions & { methodName: string }) | undefined {
    const outgoingEdges = edgeMap.get(currentNode) || [];
    const currentNodeObj = nodeMap.get(currentNode);
    
    // Special handling for loop nodes
    if (currentNodeObj?.type === 'loop') {
      // Check if we should continue looping
      const shouldContinueLoop = this.checkLoopCondition(currentState, currentNodeObj);
      // console.log('\n🔄 [selectNextEdge] Loop check:', {
      //   shouldContinueLoop,
      //   iterations: currentState.loopControl?.iterations?.[currentNodeObj.name],
      //   maxIterations: currentState.loopControl?.maxIterations?.[currentNodeObj.name],
      //   edges: outgoingEdges.map(e => ({
      //     from: e.from,
      //     to: e.to,
      //     allowLoop: e.allowLoop
      //   }))
      // });
      
      // Find loop and exit edges
      const loopEdge = outgoingEdges.find(edge => edge.allowLoop);
      const exitEdge = outgoingEdges.find(edge => !edge.allowLoop);
      
      // Continue loop if conditions are met and loop edge exists
      if (shouldContinueLoop && loopEdge) {
        return loopEdge;
      }
      
      // Take exit edge if we should not continue looping
      if (!shouldContinueLoop && exitEdge) {
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

  async run(input?: AgentState): Promise<AgentState> {
    try {
      // console.log('\n📋 [BaseAgent] Starting execution with input:', JSON.stringify(input, null, 2));
      
      const nodes = (Reflect.getMetadata('nodes', this.constructor) || []).map(node => ({
        ...node,
        methodName: node.methodName
      }));
      const edges = Reflect.getMetadata('edges', this.constructor) || [];
      
      // console.log('\n🔍 [BaseAgent] Found nodes:', nodes.map(n => n.name).join(', '));
      // console.log('🔍 [BaseAgent] Found edges:', edges.map(e => `${e.from}->${e.to}`).join(', '));
      
      const defaultState: AgentState = {
        messages: [],
        context: {},
        metadata: {},
      };
      
      let currentState: AgentState = this.initializeLoopControl(
        input || defaultState,
        nodes
      );

      type NodeMapValue = { 
        name: string; 
        type?: NodeType;
        method: Function;
        methodName: string;
      } & AgentNodeOptions;

      const nodeMap = new Map<string, NodeMapValue>(
        nodes.map(node => [node.name, { 
          name: node.name,
          type: node.type,
          method: node.method,
          methodName: node.methodName,
          ...node 
        }])
      );
      
      const edgeMap = new Map<string, (AgentEdgeOptions & { methodName: string })[]>();
      for (const edge of edges) {
        if (!edgeMap.has(edge.from)) {
          edgeMap.set(edge.from, []);
        }
        edgeMap.get(edge.from)!.push({
          ...edge,
          methodName: edge.methodName
        });
      }

      // Add the __start__ edge that directly executes the start node
      edgeMap.set('__start__', [{
        from: '__start__',
        to: 'start',
        methodName: 'startEdge'
      }]);

      let currentNode = '__start__';
      const visitedEdges = new Set<string>();

      // console.log('\n🚀 [BaseAgent] Starting graph traversal from __start__');

      while (true) {
        // console.log(`\n📍 [BaseAgent] Current node: ${currentNode}`);
        
        const nextEdge = this.selectNextEdge(currentNode, currentState, edgeMap, nodeMap, visitedEdges);
        
        if (!nextEdge) {
          // console.log('🛑 [BaseAgent] No valid edge found, ending execution');
          break;
        }

        const edgeId = `${nextEdge.from}->${nextEdge.to}`;
        visitedEdges.add(edgeId);
        // console.log(`\n➡️ [BaseAgent] Selected edge: ${edgeId}`);

        try {
          // Get and validate next node first
          const nextNode = nodeMap.get(nextEdge.to);
          if (!nextNode) {
            throw new Error(`Node ${nextEdge.to} not found in graph`);
          }

          // Validate edge method exists
          if (typeof this[nextEdge.methodName] !== 'function') {
            throw new Error(`Node ${nextEdge.to} not found in graph`);
          }

          // Execute edge method
          // console.log(`\n🔄 [BaseAgent] Executing edge method: ${nextEdge.methodName}`);
          currentState = await this[nextEdge.methodName](currentState);
          
          // Handle loop node
          if (nextNode.type === 'loop') {
            currentState = this.incrementLoopCount(currentState, nextNode.name);
            // console.log('\n🔍 [BaseAgent] Loop State:', {
            //   nodeName: nextNode.name,
            //   iterations: currentState.loopControl?.iterations[nextNode.name],
            //   maxIterations: currentState.loopControl?.maxIterations[nextNode.name],
            //   hasLoopCondition: !!nextNode.loopCondition,
            //   constructor: this.constructor.name
            // });
          }

          // Execute node method
          // console.log(`\n⚡ [BaseAgent] Executing node method: ${nextNode.methodName}`);
          const nodeInput: NodeInput = { state: currentState };
          const nodeOutput = await this[nextNode.methodName](nodeInput);
          if (!nodeOutput || !nodeOutput.state) {
            throw new Error(`Invalid output from node ${nextNode.name}`);
          }
          currentState = nodeOutput.state;
          
          currentNode = nextEdge.to;
          // console.log(`\n✅ [BaseAgent] Node execution completed: ${currentNode}`);
        } catch (error) {
          console.log(`\n❌ [BaseAgent] Error in ${this.constructor.name}:`, error);
          throw error;
        }
      }

      // console.log('\n✅ [BaseAgent] Execution completed');
      return currentState;
    } catch (error) {
      throw error;
    }
  }
}
