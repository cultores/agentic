import { Test } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AgentNode, AgentEdge, AgentGraph } from '../decorators/agent.decorators';
import { 
  AgentState, 
  NodeInput, 
  NodeOutput,
  NodeType,
  AgentNodeDefinition,
  ToolNodeDefinition,
  LLMNodeDefinition,
  ChainNodeDefinition,
  AgentNodeOptions,
  MessageRole,
  MessageConfig
} from '../interfaces/agent.interfaces';
import { 
  HumanMessage, 
  AIMessage, 
  SystemMessage, 
  FunctionMessage, 
  ToolMessage,
  BaseMessage
} from '@langchain/core/messages';
import { Tool } from '@langchain/core/tools';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { CallbackManager } from '@langchain/core/callbacks/manager';

// Test implementation of BaseAgent
@AgentGraph({
  name: 'test-agent',
  description: 'Test agent implementation',
})
@Injectable()
class TestAgent extends BaseAgent {
  executionOrder: string[] = [];

  // Make protected members accessible for testing
  public override tools = new Map<string, Tool>();
  public override models = new Map<string, BaseLanguageModel>();
  public override chains = new Map<string, Tool>();

  @AgentNode({
    name: 'start',
    description: 'Start node',
    type: 'llm',
  })
  async start(input: NodeInput): Promise<NodeOutput> {
    const state = input?.state || { messages: [], context: {}, metadata: {} };
    // console.log('\n🚀 [Node: start] Starting agent execution');
    // console.log('Input state:', state);
    this.executionOrder.push('start');
    return {
      state: {
        ...state,
        context: { ...state.context, start: true },
      }
    };
  }

  @AgentNode({
    name: 'processA',
    description: 'Process A node',
    type: 'tool',
  })
  async processA(input: NodeInput): Promise<NodeOutput> {
    const state = input?.state || { messages: [], context: {}, metadata: {} };
    // console.log('\n🔧 [Node: processA] Processing route A');
    // console.log('Current state:', state);
    this.executionOrder.push('processA');
    return {
      state: {
        ...state,
        context: { ...state.context, processA: true },
      }
    };
  }

  @AgentNode({
    name: 'processB',
    description: 'Process B node',
    type: 'tool',
  })
  async processB(input: NodeInput): Promise<NodeOutput> {
    const state = input?.state || { messages: [], context: {}, metadata: {} };
    // console.log('\n🛠️ [Node: processB] Processing route B');
    // console.log('Current state:', state);
    this.executionOrder.push('processB');
    return {
      state: {
        ...state,
        context: { ...state.context, processB: true },
      }
    };
  }

  @AgentNode({
    name: 'conditional',
    description: 'Conditional node',
    type: 'llm',
  })
  async conditional(input: NodeInput): Promise<NodeOutput> {
    const state = input?.state || { messages: [], context: {}, metadata: {} };
    const route = state.metadata?.route || 'A';
    // console.log('\n🔄 [Node: conditional] Evaluating route');
    // console.log('Selected route:', route);
    // console.log('Current state:', state);
    this.executionOrder.push('conditional');
    return {
      state: {
        ...state,
        context: { 
          ...state.context, 
          conditional: true,
          route
        },
      }
    };
  }

  @AgentNode({
    name: 'loop',
    description: 'Loop node',
    type: 'loop',
    maxIterations: 3,
    loopCondition: (state: AgentState) => 
      ((state.context?.counter as number) || 0) < ((state.metadata?.targetCount as number) || 0)
  })
  async loop(input: NodeInput): Promise<NodeOutput> {
    const state = input?.state || { messages: [], context: {}, metadata: {} };
    // console.log('\n🔁 [Node: loop] Processing loop iteration');
    // console.log('Current state:', state);
    const counter = ((state.context?.counter as number) || 0) + 1;
    this.executionOrder.push('loop');
    return {
      state: {
        ...state,
        context: { 
          ...state.context, 
          counter,
          loop: true 
        },
      }
    };
  }

  @AgentEdge({
    from: 'start',
    to: 'conditional',
  })
  startToConditional(state: AgentState): AgentState {
    // console.log('\n➡️ [Edge: start->conditional] Transitioning to conditional node');
    this.executionOrder.push('edge:start->conditional');
    return { ...state, metadata: { ...state.metadata } };
  }

  @AgentEdge({
    from: 'conditional',
    to: 'processA',
    condition: (state: AgentState) => state.context?.route === 'A' ? 'processA' : undefined,
  })
  conditionalToA(state: AgentState): AgentState {
    // console.log('\n➡️ [Edge: conditional->processA] Taking route A');
    this.executionOrder.push('edge:conditional->processA');
    return { ...state, metadata: { ...state.metadata } };
  }

  @AgentEdge({
    from: 'conditional',
    to: 'processB',
    condition: (state: AgentState) => state.context?.route === 'B' ? 'processB' : undefined,
  })
  conditionalToB(state: AgentState): AgentState {
    // console.log('\n➡️ [Edge: conditional->processB] Taking route B');
    this.executionOrder.push('edge:conditional->processB');
    return { ...state, metadata: { ...state.metadata } };
  }

  @AgentEdge({
    from: 'processA',
    to: 'loop',
    condition: (state: AgentState) => state.metadata?.targetCount !== undefined ? 'loop' : undefined,
  })
  processAToLoop(state: AgentState): AgentState {
    // console.log('\n➡️ [Edge: processA->loop] Entering loop');
    this.executionOrder.push('edge:processA->loop');
    return { ...state, metadata: { ...state.metadata } };
  }

  @AgentEdge({
    from: 'loop',
    to: 'loop',
    allowLoop: true,
    condition: (state: AgentState) => {
      const iterations = state.loopControl?.iterations?.loop || 0;
      const maxIterations = state.loopControl?.maxIterations?.loop || Infinity;
      const targetCount = state.metadata?.targetCount || 0;
      const counter = state.context?.counter || 0;
      
      return iterations < maxIterations && counter < targetCount ? 'loop' : undefined;
    }
  })
  loopToSelf(state: AgentState): AgentState {
    // console.log('\n🔄 [Edge: loop->loop] Continuing loop');
    this.executionOrder.push('edge:loop->loop');
    return { ...state, metadata: { ...state.metadata } };
  }

  @AgentEdge({
    from: 'loop',
    to: 'processB',
    condition: (state: AgentState) => {
      const iterations = state.loopControl?.iterations?.loop || 0;
      const maxIterations = state.loopControl?.maxIterations?.loop || Infinity;
      const targetCount = state.metadata?.targetCount || 0;
      const counter = state.context?.counter || 0;
      
      return (iterations >= maxIterations || counter >= targetCount) ? 'processB' : undefined;
    }
  })
  loopToProcessB(state: AgentState): AgentState {
    // console.log('\n➡️ [Edge: loop->processB] Loop complete, moving to process B');
    this.executionOrder.push('edge:loop->processB');
    return { ...state, metadata: { ...state.metadata } };
  }

  // Helper method to reset execution order
  resetExecutionOrder() {
    this.executionOrder = [];
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TestAgent],
    }).compile();

    agent = moduleRef.get<TestAgent>(TestAgent);
    agent.resetExecutionOrder();
  });

  describe('Graph Flow Verification', () => {
    it('should execute nodes in correct order for route A', async () => {
      const result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'A' },
      });

      // Verify state
      expect(result.context).toHaveProperty('start', true);
      expect(result.context).toHaveProperty('conditional', true);
      expect(result.context).toHaveProperty('processA', true);

      // Verify execution order
      expect(agent.executionOrder).toEqual([
        'start',
        'edge:start->conditional',
        'conditional',
        'edge:conditional->processA',
        'processA'
      ]);
    });

    it('should execute nodes in correct order for route B', async () => {
      const result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'B' },
      });

      // Verify state
      expect(result.context).toHaveProperty('start', true);
      expect(result.context).toHaveProperty('conditional', true);
      expect(result.context).toHaveProperty('processB', true);
      expect(result.context).not.toHaveProperty('processA');

      // Verify execution order
      expect(agent.executionOrder).toEqual([
        'start',
        'edge:start->conditional',
        'conditional',
        'edge:conditional->processB',
        'processB'
      ]);
    });

    it('should evaluate conditions correctly when multiple edges exist', async () => {
      // First run with route A
      let result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'A' },
      });
      
      expect(agent.executionOrder).toContain('edge:conditional->processA');
      expect(agent.executionOrder).not.toContain('edge:conditional->processB');
      
      // Reset and run with route B
      agent.resetExecutionOrder();
      result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'B' },
      });
      
      expect(agent.executionOrder).toContain('edge:conditional->processB');
      expect(agent.executionOrder).not.toContain('edge:conditional->processA');
    });

    it('should maintain state throughout execution', async () => {
      const result = await agent.run({
        messages: [],
        context: { initial: true },
        metadata: { route: 'A' },
      });

      // Verify initial state is preserved
      expect(result.context).toHaveProperty('initial', true);
      // Verify state accumulation
      expect(result.context).toHaveProperty('start', true);
      expect(result.context).toHaveProperty('conditional', true);
      expect(result.context).toHaveProperty('processA', true);
    });

    describe('Loop Control', () => {
      it('should execute loop for specified number of iterations', async () => {
        const targetCount = 3;
        const result = await agent.run({
          messages: [],
          context: {},
          metadata: { route: 'A', targetCount },
        });

        // Verify loop executed correct number of times
        expect(result.context.counter).toBe(targetCount);
        
        // Verify state
        expect(result.context).toHaveProperty('start', true);
        expect(result.context).toHaveProperty('conditional', true);
        expect(result.context).toHaveProperty('processA', true);
        expect(result.context).toHaveProperty('loop', true);
        expect(result.context).toHaveProperty('processB', true);

        // Verify execution includes loop iterations
        const loopCount = agent.executionOrder.filter(step => step === 'loop').length;
        expect(loopCount).toBe(targetCount);

        // Verify the complete flow
        expect(agent.executionOrder).toEqual([
          'start',
          'edge:start->conditional',
          'conditional',
          'edge:conditional->processA',
          'processA',
          'edge:processA->loop',
          'loop',
          'edge:loop->loop',
          'loop',
          'edge:loop->loop',
          'loop',
          'edge:loop->processB',
          'processB'
        ]);
      });

      it('should respect maxIterations even if condition is still true', async () => {
        const targetCount = 5; // More than maxIterations
        const result = await agent.run({
          messages: [],
          context: {},
          metadata: { route: 'A', targetCount },
        });

        // Verify loop respected maxIterations
        const loopCount = agent.executionOrder.filter(step => step === 'loop').length;
        expect(loopCount).toBe(3); // maxIterations is 3
        
        // Verify final state
        expect(result.context.counter).toBe(3);
        expect(result.context).toHaveProperty('processB', true);
      });

      it('should exit loop when condition becomes false', async () => {
        const targetCount = 2; // Less than maxIterations
        const result = await agent.run({
          messages: [],
          context: {},
          metadata: { route: 'A', targetCount },
        });

        // Verify loop exited early
        const loopCount = agent.executionOrder.filter(step => step === 'loop').length;
        expect(loopCount).toBe(targetCount);
        
        // Verify final state
        expect(result.context.counter).toBe(targetCount);
        expect(result.context).toHaveProperty('processB', true);
      });
    });

    it('should handle loop execution with max iterations', async () => {
      const result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'A', targetCount: 5 },
      });

      expect(result.context).toHaveProperty('counter', 3); // maxIterations is 3
      expect(result.context).toHaveProperty('processB', true);
      
      const loopSteps = agent.executionOrder.filter(step => step === 'loop');
      expect(loopSteps).toHaveLength(3);
    });

    it('should handle loop execution with target count reached', async () => {
      const result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'A', targetCount: 2 },
      });

      expect(result.context).toHaveProperty('counter', 2);
      expect(result.context).toHaveProperty('processB', true);
      
      const loopSteps = agent.executionOrder.filter(step => step === 'loop');
      expect(loopSteps).toHaveLength(2);
    });

    it('should handle undefined condition results', async () => {
      const result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'invalid' }, // Use invalid route in metadata
      });

      expect(result.context).toHaveProperty('start', true);
      expect(result.context).toHaveProperty('conditional', true);
      expect(result.context).not.toHaveProperty('processA');
      expect(result.context).not.toHaveProperty('processB');
    });

    it('should handle errors in node execution', async () => {
      @AgentGraph({
        name: 'errorGraph',
        description: 'Error graph',
      })
      class ErrorTestAgent extends TestAgent {
        override async start(input: NodeInput): Promise<NodeOutput> {
          console.log('🛑 [ErrorTestAgent] Error in start node');
          throw new Error('Test error');
        }
      }

      const errorAgent = new ErrorTestAgent();
      await expect(errorAgent.run({
        messages: [],
        context: {},
        metadata: {},
      })).rejects.toThrow('Test error');
    });

    it('should handle edge validation errors', async () => {
      class InvalidEdgeAgent extends TestAgent {
        override startToConditional(state: AgentState): AgentState {
          return { ...state, context: { ...state.context, invalidTransition: true } };
        }
      }

      const invalidAgent = new InvalidEdgeAgent();
      const result = await invalidAgent.run({
        messages: [],
        context: {},
        metadata: {},
      });

      expect(result.context).toHaveProperty('start', true);
    });

    it('should handle missing edge conditions', async () => {
      const result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'missing' },
      });

      expect(result.context).toHaveProperty('start', true);
      expect(result.context).toHaveProperty('conditional', true);
    });

    it('should handle loop control validation', async () => {
      const result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'A', targetCount: -1 },
      });

      expect(result.context).toHaveProperty('start', true);
      expect(result.context).toHaveProperty('conditional', true);
      expect(result.context).toHaveProperty('processA', true);
    });

    it('should handle invalid node transitions', async () => {
      class InvalidTransitionAgent extends TestAgent {
        override async start(): Promise<NodeOutput> {
          return {
            state: {
              messages: [],
              context: { start: true },
              metadata: {},
              loopControl: { iterations: {}, maxIterations: {} }
            }
          };
        }

        override startToConditional(state: AgentState): AgentState {
          return { ...state, context: { ...state.context, invalidTransition: true } };
        }
      }

      const invalidAgent = new InvalidTransitionAgent();
      const result = await invalidAgent.run({
        messages: [],
        context: {},
        metadata: {},
      });

      expect(result.context).toHaveProperty('start', true);
    });

    it('should handle undefined node conditions', async () => {
      class UndefinedConditionAgent extends TestAgent {
        override async conditional(): Promise<NodeOutput> {
          return {
            state: {
              messages: [],
              context: { start: true, conditional: true },
              metadata: {},
              loopControl: { iterations: {}, maxIterations: {} }
            }
          };
        }
      }

      const undefinedAgent = new UndefinedConditionAgent();
      const result = await undefinedAgent.run({
        messages: [],
        context: {},
        metadata: {},
      });

      expect(result.context).toHaveProperty('start', true);
      expect(result.context).toHaveProperty('conditional', true);
    });

    it('should handle invalid loop conditions', async () => {
      class InvalidLoopAgent extends TestAgent {
        override async loop(): Promise<NodeOutput> {
          return {
            state: {
              messages: [],
              context: { start: true, loop: true },
              metadata: {},
              loopControl: { iterations: { loop: 999 }, maxIterations: { loop: 1 } }
            }
          };
        }
      }

      const invalidAgent = new InvalidLoopAgent();
      const result = await invalidAgent.run({
        messages: [],
        context: {},
        metadata: { route: 'A', targetCount: 1 },
      });

      expect(result.context).toHaveProperty('start', true);
      expect(result.context).toHaveProperty('loop', true);
    });

    it('should handle edge conditions in loop transitions', async () => {
      class EdgeLoopAgent extends TestAgent {
        override async loop(input: NodeInput): Promise<NodeOutput> {
          const state = input?.state || { messages: [], context: {}, metadata: {} };
          const iterations = state.loopControl?.iterations?.loop || 0;
          return {
            state: {
              ...state,
              context: { ...state.context, loop: true },
              loopControl: {
                iterations: { loop: iterations },
                maxIterations: { loop: 1 }
              }
            }
          };
        }
      }

      const edgeAgent = new EdgeLoopAgent();
      const result = await edgeAgent.run({
        messages: [],
        context: {},
        metadata: { route: 'A', targetCount: 1 },
      });

      expect(result.context).toHaveProperty('loop', true);
    });

    it('should handle missing loop control state', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {},
        loopControl: {
          iterations: {},
          maxIterations: {}
        }
      };

      const result = agent['incrementLoopCount'](state, 'testLoop');
      expect(result.loopControl.iterations).toBeDefined();
      expect(result.loopControl.iterations.testLoop).toBe(1);
    });

    it('should handle missing metadata in loop conditions', async () => {
      const result = await agent.run({
        messages: [],
        context: {},
        metadata: { route: 'A' }, // Missing targetCount
      });

      expect(result.context).toHaveProperty('start', true);
      expect(result.context).toHaveProperty('conditional', true);
      expect(result.context).toHaveProperty('processA', true);
    });

    it('should handle invalid loop control state', async () => {
      class InvalidLoopControlAgent extends TestAgent {
        override async loop(input: NodeInput): Promise<NodeOutput> {
          const state = input?.state || { messages: [], context: {}, metadata: {} };
          return {
            state: {
              ...state,
              context: { ...state.context, loop: true },
              loopControl: { iterations: null, maxIterations: null }
            }
          };
        }
      }

      const invalidAgent = new InvalidLoopControlAgent();
      const result = await invalidAgent.run({
        messages: [],
        context: {},
        metadata: { route: 'A', targetCount: 1 },
      });

      expect(result.context).toHaveProperty('loop', true);
    });

    it('should handle undefined input state', async () => {
      class UndefinedStateAgent extends TestAgent {
        override async start(input: NodeInput): Promise<NodeOutput> {
          return {
            state: {
              messages: [],
              context: { start: true },
              metadata: {},
              loopControl: { iterations: {}, maxIterations: {} }
            }
          };
        }
      }

      const undefinedAgent = new UndefinedStateAgent();
      const result = await undefinedAgent.run(undefined as any);

      expect(result.context).toHaveProperty('start', true);
    });

    it('should handle invalid node output', async () => {
      class InvalidOutputAgent extends TestAgent {
        override async start(): Promise<NodeOutput> {
          return {} as NodeOutput; // Invalid output without state
        }
      }

      const invalidAgent = new InvalidOutputAgent();
      await expect(invalidAgent.run()).rejects.toThrow('Invalid output from node start');
    });

    it('should handle missing tool in tool node', async () => {
      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'tool',
        tool: undefined,
        toolName: undefined,
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      await expect(agent['executeNode'](node, input))
        .rejects
        .toThrow('Unable to execute node testNode');
    });

    it('should handle chain node without registered tool', async () => {
      const node: AgentNodeDefinition = {
        name: 'missingChain',
        type: 'chain',
        chainType: 'sequential',
        methodName: 'missingChainMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      await expect(agent['executeNode'](node, input))
        .rejects
        .toThrow('Unable to execute node missingChain');
    });

    it('should handle node not found error', async () => {
      @AgentGraph({
        name: 'missing-node-agent',
        description: 'Agent with missing node',
      })
      class MissingNodeAgent extends BaseAgent {
        @AgentNode({
          name: 'start',
          description: 'Start node',
          type: 'llm',
        })
        async start(input: NodeInput): Promise<NodeOutput> {
          return {
            state: {
              messages: [],
              context: { start: true },
              metadata: {},
            }
          };
        }

        @AgentEdge({
          from: 'start',
          to: 'nonexistent'
        })
        startToNonexistent(state: AgentState): AgentState {
          return state;
        }

        @AgentEdge({
          from: '__start__',
          to: 'start',
        })
        startEdge(state: AgentState): AgentState {
          return state;
        }
      }

      const moduleRef = Test.createTestingModule({
        providers: [MissingNodeAgent],
      });

      await expect(moduleRef.compile())
        .rejects
        .toThrow('Invalid graph configuration: Edge from \'start\' points to non-existent node \'nonexistent\'');
    });

    it('should validate graph configuration', async () => {
      @AgentGraph({
        name: 'missing-node-agent',
        description: 'Agent with missing node',
      })
      class MissingNodeAgent extends BaseAgent {
        @AgentNode({
          name: 'start',
          description: 'Start node',
          type: 'llm',
        })
        async start(input: NodeInput): Promise<NodeOutput> {
          return {
            state: {
              messages: [],
              context: { start: true },
              metadata: {},
            }
          };
        }

        @AgentEdge({
          from: 'start',
          to: 'nonexistent'
        })
        startToNonexistent(state: AgentState): AgentState {
          return state;
        }
      }

      const moduleRef = Test.createTestingModule({
        providers: [MissingNodeAgent],
      });

      await expect(moduleRef.compile())
        .rejects
        .toThrow('Invalid graph configuration: Edge from \'start\' points to non-existent node \'nonexistent\'');
    });

    it('should handle edge from non-existent node', async () => {
      @AgentGraph({
        name: 'invalid-edge-agent',
        description: 'Agent with invalid edge'
      })
      class InvalidEdgeAgent extends BaseAgent {
        @AgentNode({
          name: 'start',
          description: 'Start node',
          type: 'llm'
        })
        async start(input: NodeInput): Promise<NodeOutput> {
          return { state: input.state };
        }

        @AgentEdge({
          from: 'nonexistent',
          to: 'start'
        })
        invalidEdge(state: AgentState): AgentState {
          return state;
        }
      }

      const moduleRef = Test.createTestingModule({
        providers: [InvalidEdgeAgent]
      });

      await expect(moduleRef.compile())
        .rejects
        .toThrow('Invalid graph configuration: Edge to \'start\' comes from non-existent node \'nonexistent\'');
    });

    it('should handle tool execution with callbacks', async () => {
      const tool = {
        name: 'testTool',
        description: 'Test tool',
        call: jest.fn().mockResolvedValue('test result')
      } as unknown as Tool;

      const callbacks = new CallbackManager();
      agent.tools.set('testTool', tool);

      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'tool',
        toolName: 'testTool',
        callbacks,
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        },
        params: { test: true }
      };

      const result = await agent['executeNode'](node, input);
      expect(result.state.context).toHaveProperty('testNode', 'test result');
      expect(tool.call).toHaveBeenCalledWith({ test: true }, callbacks);
    });

    it('should handle sequential chain execution', async () => {
      const chain = {
        name: 'testChain',
        description: 'Test chain',
        call: jest.fn().mockResolvedValue('chain result')
      } as unknown as Tool;

      agent.chains.set('testChain', chain);

      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'chain',
        chainType: 'sequential',
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      const result = await agent['executeNode'](node, input);
      expect(result.state.context).toHaveProperty('testNode', 'chain result');
    });

    it('should handle edge method validation', async () => {
      @AgentGraph({
        name: 'invalid-method-agent',
        description: 'Agent with invalid edge method'
      })
      class InvalidMethodAgent extends BaseAgent {
        @AgentNode({
          name: 'start',
          description: 'Start node',
          type: 'llm'
        })
        async start(input: NodeInput): Promise<NodeOutput> {
          return { state: input.state };
        }

        @AgentNode({
          name: 'target',
          description: 'Target node',
          type: 'llm'
        })
        async target(input: NodeInput): Promise<NodeOutput> {
          return { state: input.state };
        }

        @AgentEdge({
          from: '__start__',
          to: 'start'
        })
        startEdge(state: AgentState): AgentState {
          return state;
        }

        @AgentEdge({
          from: 'start',
          to: 'target'
        })
        startToTarget(state: AgentState): AgentState {
          // Intencionalmente no implementamos la lógica del método
          // El error debería ocurrir cuando intente ejecutar este edge
          throw new Error('Not implemented');
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [InvalidMethodAgent]
      }).compile();

      const invalidAgent = moduleRef.get<InvalidMethodAgent>(InvalidMethodAgent);
      await expect(invalidAgent.run({
        messages: [],
        context: {},
        metadata: {}
      })).rejects.toThrow('Not implemented');
    });
  });

  describe('Message Creation', () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent();
    });

    it('should create human message', () => {
      const config: MessageConfig = { 
        role: 'human', 
        content: 'test',
        additionalKwargs: { key: 'value' }
      };
      const message = agent['createMessage'](config);
      expect(message).toBeInstanceOf(HumanMessage);
      expect(message.content).toBe('test');
      expect((message as any).additional_kwargs).toEqual({ key: 'value' });
    });

    it('should create AI message', () => {
      const config: MessageConfig = { 
        role: 'ai', 
        content: 'test',
        additionalKwargs: { key: 'value' }
      };
      const message = agent['createMessage'](config);
      expect(message).toBeInstanceOf(AIMessage);
      expect(message.content).toBe('test');
      expect((message as any).additional_kwargs).toEqual({ key: 'value' });
    });

    it('should create system message', () => {
      const config: MessageConfig = { 
        role: 'system', 
        content: 'test',
        additionalKwargs: { key: 'value' }
      };
      const message = agent['createMessage'](config);
      expect(message).toBeInstanceOf(SystemMessage);
      expect(message.content).toBe('test');
      expect((message as any).additional_kwargs).toEqual({ key: 'value' });
    });

    it('should create function message', () => {
      const config: MessageConfig = { 
        role: 'function', 
        content: 'test',
        name: 'testFunction',
        additionalKwargs: { key: 'value' }
      };
      const message = agent['createMessage'](config);
      expect(message).toBeInstanceOf(FunctionMessage);
      expect(message.content).toBe('test');
      expect(message.name).toBe('testFunction');
      expect((message as any).additional_kwargs).toEqual({ key: 'value' });
    });

    it('should create tool message', () => {
      const config: MessageConfig = { 
        role: 'tool', 
        content: 'test',
        name: 'testTool',
        additionalKwargs: { key: 'value' }
      };
      const message = agent['createMessage'](config) as ToolMessage;
      expect(message).toBeInstanceOf(ToolMessage);
      expect(message.content).toBe('test');
      expect(message.tool_call_id).toBe('testTool');
      expect(message.additional_kwargs).toEqual({ key: 'value' });
    });

    it('should throw error for unsupported role', () => {
      const config = { 
        role: 'unsupported' as MessageRole, 
        content: 'test' 
      };
      expect(() => agent['createMessage'](config)).toThrow('Unsupported message role: unsupported');
    });
  });

  describe('Node Execution', () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent();
    });

    it('should execute tool node', async () => {
      const tool = {
        name: 'testTool',
        description: 'Test tool',
        call: jest.fn().mockResolvedValue('test result')
      } as unknown as Tool;
      agent.tools.set('testTool', tool);

      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'tool',
        tool,
        toolName: 'testTool',
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      const result = await agent['executeNode'](node, input);
      expect(result.state.context).toHaveProperty('testNode', 'test result');
    });

    it('should execute llm node with model string', async () => {
      const model = {
        invoke: jest.fn().mockResolvedValue({ content: 'test response' })
      } as unknown as BaseLanguageModel;
      agent.models.set('testModel', model);

      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'llm',
        model: 'testModel',
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      const result = await agent['executeNode'](node, input);
      expect(result.state.context).toHaveProperty('testNode', 'test response');
    });

    it('should execute chain node', async () => {
      const chain = {
        name: 'testChain',
        description: 'Test chain',
        call: jest.fn().mockResolvedValue('chain result')
      } as unknown as Tool;
      agent.chains.set('testChain', chain);

      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'chain',
        chainType: 'sequential',
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      const result = await agent['executeNode'](node, input);
      expect(result.state.context).toHaveProperty('testNode', 'chain result');
    });

    it('should throw error for unsupported node type', async () => {
      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'tool',
        tool: undefined,
        toolName: undefined,
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      await expect(agent['executeNode'](node, input))
        .rejects
        .toThrow('Unable to execute node testNode');
    });

    it('should throw error for missing model in llm node', async () => {
      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'llm',
        model: 'nonexistentModel',
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      await expect(agent['executeNode'](node, input))
        .rejects
        .toThrow('Unable to execute node testNode');
    });

    it('should handle llm node with model instance', async () => {
      const model = {
        invoke: jest.fn().mockResolvedValue({ content: 'test response' })
      } as unknown as BaseLanguageModel;

      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'llm',
        model,
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      const result = await agent['executeNode'](node, input);
      expect(result.state.context).toHaveProperty('testNode', 'test response');
    });

    it('should handle tool node with callbacks', async () => {
      const tool = {
        name: 'testTool',
        description: 'Test tool',
        call: jest.fn().mockResolvedValue('test result')
      } as unknown as Tool;
      agent.tools.set('testTool', tool);

      const callbacks = {
        handlers: {
          handleToolStart: jest.fn().mockResolvedValue(undefined),
          handleToolEnd: jest.fn().mockResolvedValue(undefined),
          handleToolError: jest.fn().mockResolvedValue(undefined)
        },
        inheritableHandlers: {},
        tags: [],
        inheritableTags: [],
        metadata: {},
        inheritableMetadata: {},
        name: 'test',
        addHandler: jest.fn(),
        removeHandler: jest.fn(),
        addMetadata: jest.fn(),
        addTag: jest.fn(),
        copy: jest.fn(),
        getChild: jest.fn(),
        handleChainStart: jest.fn(),
        handleChainEnd: jest.fn(),
        handleChainError: jest.fn(),
        handleAgentAction: jest.fn(),
        handleAgentEnd: jest.fn(),
        handleText: jest.fn(),
        handleLLMNewToken: jest.fn(),
        handleLLMError: jest.fn(),
        handleLLMEnd: jest.fn(),
        handleRetrieverStart: jest.fn(),
        handleRetrieverEnd: jest.fn(),
        handleRetrieverError: jest.fn()
      } as unknown as CallbackManager;

      const node: AgentNodeDefinition = {
        name: 'testNode',
        type: 'tool',
        tool,
        toolName: 'testTool',
        callbacks,
        methodName: 'testMethod'
      };

      const input = {
        state: {
          messages: [],
          context: {},
          metadata: {}
        }
      };

      const result = await agent['executeNode'](node, input);
      expect(result.state.context).toHaveProperty('testNode', 'test result');
    });
  });

  describe('Loop and Condition Handling', () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent();
    });

    it('should initialize loop control', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {}
      };

      const nodes = [
        {
          name: 'loop1',
          type: 'loop' as NodeType,
          maxIterations: 3
        },
        {
          name: 'loop2',
          type: 'loop' as NodeType,
          maxIterations: 5
        }
      ];

      const result = agent['initializeLoopControl'](state, nodes);
      expect(result.loopControl).toBeDefined();
      expect(result.loopControl.iterations).toEqual({});
      expect(result.loopControl.maxIterations).toEqual({
        loop1: 3,
        loop2: 5
      });
    });

    it('should increment loop count', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {},
        loopControl: {
          iterations: { loop1: 1 },
          maxIterations: { loop1: 3 }
        }
      };

      const result = agent['incrementLoopCount'](state, 'loop1');
      expect(result.loopControl.iterations.loop1).toBe(2);
    });

    it('should initialize loop control when missing', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {}
      };

      const result = agent['incrementLoopCount'](state, 'loop1');
      expect(result.loopControl).toBeDefined();
      expect(result.loopControl.iterations.loop1).toBe(1);
    });

    it('should check loop condition with max iterations', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {},
        loopControl: {
          iterations: { loop1: 2 },
          maxIterations: { loop1: 3 }
        }
      };

      const node = {
        name: 'loop1',
        type: 'loop' as NodeType,
        method: jest.fn()
      } as AgentNodeOptions & { name: string; method: Function };

      const result = agent['checkLoopCondition'](state, node);
      expect(result).toBe(true);
    });

    it('should stop loop when max iterations reached', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {},
        loopControl: {
          iterations: { loop1: 3 },
          maxIterations: { loop1: 3 }
        }
      };

      const node = {
        name: 'loop1',
        type: 'loop' as NodeType,
        method: jest.fn()
      } as AgentNodeOptions & { name: string; method: Function };

      const result = agent['checkLoopCondition'](state, node);
      expect(result).toBe(false);
    });

    it('should use custom loop condition when provided', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {},
        loopControl: {
          iterations: { loop1: 1 },
          maxIterations: { loop1: 3 }
        }
      };

      const node = {
        name: 'loop1',
        type: 'loop' as NodeType,
        method: jest.fn(),
        loopCondition: (state: AgentState) => state.loopControl.iterations.loop1 < 2
      } as AgentNodeOptions & { name: string; method: Function };

      const result = agent['checkLoopCondition'](state, node);
      expect(result).toBe(true);

      state.loopControl.iterations.loop1 = 2;
      const result2 = agent['checkLoopCondition'](state, node);
      expect(result2).toBe(false);
    });

    it('should handle missing loop control', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {}
      };

      const node = {
        name: 'loop1',
        type: 'loop' as NodeType,
        method: jest.fn()
      } as AgentNodeOptions & { name: string; method: Function };

      const result = agent['checkLoopCondition'](state, node);
      expect(result).toBe(false);
    });

    it('should handle missing iterations or maxIterations', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {},
        loopControl: {
          iterations: {},
          maxIterations: {}
        }
      };

      const node = {
        name: 'loop1',
        type: 'loop' as NodeType,
        method: jest.fn()
      } as AgentNodeOptions & { name: string; method: Function };

      const result = agent['checkLoopCondition'](state, node);
      expect(result).toBe(false);
    });
  });

  describe('Edge Selection', () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent();
    });

    it('should select next edge for standard node', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {}
      };

      const edgeMap = new Map([
        ['node1', [
          {
            from: 'node1',
            to: 'node2',
            methodName: 'edge1'
          }
        ]]
      ]);

      const nodeMap = new Map([
        ['node1', {
          name: 'node1',
          type: 'tool' as NodeType,
          method: jest.fn()
        }]
      ]);

      const visitedEdges = new Set<string>();

      const result = agent['selectNextEdge']('node1', state, edgeMap, nodeMap, visitedEdges);
      expect(result).toBeDefined();
      expect(result?.to).toBe('node2');
    });

    it('should handle loop node with continue condition', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {},
        loopControl: {
          iterations: { loop1: 1 },
          maxIterations: { loop1: 3 }
        }
      };

      const edgeMap = new Map([
        ['loop1', [
          {
            from: 'loop1',
            to: 'node2',
            methodName: 'edge1',
            allowLoop: true
          },
          {
            from: 'loop1',
            to: 'node3',
            methodName: 'edge2',
            allowLoop: false
          }
        ]]
      ]);

      const nodeMap = new Map([
        ['loop1', {
          name: 'loop1',
          type: 'loop' as NodeType,
          method: jest.fn()
        }]
      ]);

      const visitedEdges = new Set<string>();

      const result = agent['selectNextEdge']('loop1', state, edgeMap, nodeMap, visitedEdges);
      expect(result).toBeDefined();
      expect(result?.to).toBe('node2');
      expect(result?.allowLoop).toBe(true);
    });

    it('should handle loop node with exit condition', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {},
        loopControl: {
          iterations: { loop1: 3 },
          maxIterations: { loop1: 3 }
        }
      };

      const edgeMap = new Map([
        ['loop1', [
          {
            from: 'loop1',
            to: 'node2',
            methodName: 'edge1',
            allowLoop: true
          },
          {
            from: 'loop1',
            to: 'node3',
            methodName: 'edge2',
            allowLoop: false
          }
        ]]
      ]);

      const nodeMap = new Map([
        ['loop1', {
          name: 'loop1',
          type: 'loop' as NodeType,
          method: jest.fn()
        }]
      ]);

      const visitedEdges = new Set<string>();

      const result = agent['selectNextEdge']('loop1', state, edgeMap, nodeMap, visitedEdges);
      expect(result).toBeDefined();
      expect(result?.to).toBe('node3');
      expect(result?.allowLoop).toBe(false);
    });

    it('should handle conditional edges', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {}
      };

      const edgeMap = new Map([
        ['node1', [
          {
            from: 'node1',
            to: 'node2',
            methodName: 'edge1',
            condition: (state: AgentState) => 'node2'
          },
          {
            from: 'node1',
            to: 'node3',
            methodName: 'edge2',
            condition: (state: AgentState) => undefined
          }
        ]]
      ]);

      const nodeMap = new Map([
        ['node1', {
          name: 'node1',
          type: 'tool' as NodeType,
          method: jest.fn()
        }]
      ]);

      const visitedEdges = new Set<string>();

      const result = agent['selectNextEdge']('node1', state, edgeMap, nodeMap, visitedEdges);
      expect(result).toBeDefined();
      expect(result?.to).toBe('node2');
    });

    it('should skip visited edges unless loop allowed', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {}
      };

      const edgeMap = new Map([
        ['node1', [
          {
            from: 'node1',
            to: 'node2',
            methodName: 'edge1',
            allowLoop: false
          },
          {
            from: 'node1',
            to: 'node3',
            methodName: 'edge2',
            allowLoop: true
          }
        ]]
      ]);

      const nodeMap = new Map([
        ['node1', {
          name: 'node1',
          type: 'tool' as NodeType,
          method: jest.fn()
        }]
      ]);

      const visitedEdges = new Set<string>(['node1->node2']);

      const result = agent['selectNextEdge']('node1', state, edgeMap, nodeMap, visitedEdges);
      expect(result).toBeDefined();
      expect(result?.to).toBe('node3');
    });

    it('should return undefined when no valid edge found', () => {
      const state: AgentState = {
        messages: [],
        context: {},
        metadata: {}
      };

      const edgeMap = new Map([
        ['node1', [
          {
            from: 'node1',
            to: 'node2',
            methodName: 'edge1',
            condition: (state: AgentState) => undefined
          }
        ]]
      ]);

      const nodeMap = new Map([
        ['node1', {
          name: 'node1',
          type: 'tool' as NodeType,
          method: jest.fn()
        }]
      ]);

      const visitedEdges = new Set<string>();

      const result = agent['selectNextEdge']('node1', state, edgeMap, nodeMap, visitedEdges);
      expect(result).toBeUndefined();
    });
  });

  describe('Base methods', () => {
    it('should have a default start method that returns unmodified state', async () => {
      @AgentGraph({
        name: 'base-test',
        description: 'Test base implementation'
      })
      class BaseTestAgent extends BaseAgent {}

      const module = await Test.createTestingModule({
        providers: [BaseTestAgent],
      }).compile();

      const agent = module.get<BaseTestAgent>(BaseTestAgent);
      const initialState = { messages: [], context: { test: true }, metadata: {} };
      const result = await agent['start']({ state: initialState });
      
      expect(result).toEqual({ state: initialState });
    });
  });
}); 