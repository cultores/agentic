import { Test } from '@nestjs/testing';
import { BaseAgent } from './base.agent';
import { AgentNode, AgentEdge, AgentGraph } from '../decorators/agent.decorators';
import { AgentState, NodeInput, NodeOutput } from '../interfaces/agent.interfaces';

// Test implementation of BaseAgent
@AgentGraph({
  name: 'testGraph',
  description: 'Test graph',
})
class TestAgent extends BaseAgent {
  executionOrder: string[] = [];

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

    it('should handle missing loop control state', async () => {
      class NoLoopControlAgent extends TestAgent {
        override async loop(input: NodeInput): Promise<NodeOutput> {
          const state = input?.state || { messages: [], context: {}, metadata: {} };
          return {
            state: {
              ...state,
              context: { ...state.context, loop: true },
              loopControl: undefined
            }
          };
        }
      }

      const noLoopAgent = new NoLoopControlAgent();
      const result = await noLoopAgent.run({
        messages: [],
        context: {},
        metadata: { route: 'A', targetCount: 1 },
      });

      expect(result.context).toHaveProperty('loop', true);
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
  });
}); 