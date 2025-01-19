import { Test } from '@nestjs/testing';
import { BaseAgent } from './base.agent';
import { AgentNode, AgentEdge } from '../decorators/agent.decorators';
import { AgentState } from '../interfaces/agent.interfaces';

// Test implementation of BaseAgent
class TestAgent extends BaseAgent {
  executionOrder: string[] = [];

  @AgentNode({
    name: 'start',
    description: 'Start node',
    type: 'llm',
  })
  async start(state: AgentState) {
    console.log('\n🚀 [Node: start] Starting agent execution');
    console.log('Input state:', state);
    this.executionOrder.push('start');
    return {
      ...state,
      context: { ...state.context, start: true },
    };
  }

  @AgentNode({
    name: 'processA',
    description: 'Process A node',
    type: 'tool',
  })
  async processA(state: AgentState) {
    console.log('\n🔧 [Node: processA] Processing route A');
    console.log('Current state:', state);
    this.executionOrder.push('processA');
    return {
      ...state,
      context: { ...state.context, processA: true },
    };
  }

  @AgentNode({
    name: 'processB',
    description: 'Process B node',
    type: 'tool',
  })
  async processB(state: AgentState) {
    console.log('\n🛠️ [Node: processB] Processing route B');
    console.log('Current state:', state);
    this.executionOrder.push('processB');
    return {
      ...state,
      context: { ...state.context, processB: true },
    };
  }

  @AgentNode({
    name: 'conditional',
    description: 'Conditional node',
    type: 'llm',
  })
  async conditional(state: AgentState) {
    const route = state.metadata?.route || 'A';
    console.log('\n🔄 [Node: conditional] Evaluating route');
    console.log('Selected route:', route);
    console.log('Current state:', state);
    this.executionOrder.push('conditional');
    return {
      ...state,
      context: { 
        ...state.context, 
        conditional: true,
        route
      },
    };
  }

  @AgentNode({
    name: 'loop',
    description: 'Loop node',
    type: 'loop',
    maxIterations: 3,
    loopCondition: (state: AgentState) => 
      (state.context?.counter || 0) < (state.metadata?.targetCount || 0)
  })
  async loop(state: AgentState) {
    console.log('\n🔁 [Node: loop] Processing loop iteration');
    console.log('Current state:', state);
    const counter = (state.context?.counter || 0) + 1;
    this.executionOrder.push('loop');
    return {
      ...state,
      context: { 
        ...state.context, 
        counter,
        loop: true 
      },
    };
  }

  @AgentEdge({
    from: 'start',
    to: 'conditional',
  })
  startToConditional(state: AgentState) {
    console.log('\n➡️ [Edge: start->conditional] Transitioning to conditional node');
    this.executionOrder.push('edge:start->conditional');
    return state;
  }

  @AgentEdge({
    from: 'conditional',
    to: 'processA',
    condition: (state: AgentState) => state.context?.route === 'A' ? 'processA' : undefined,
  })
  conditionalToA(state: AgentState) {
    console.log('\n➡️ [Edge: conditional->processA] Taking route A');
    this.executionOrder.push('edge:conditional->processA');
    return state;
  }

  @AgentEdge({
    from: 'conditional',
    to: 'processB',
    condition: (state: AgentState) => state.context?.route === 'B' ? 'processB' : undefined,
  })
  conditionalToB(state: AgentState) {
    console.log('\n➡️ [Edge: conditional->processB] Taking route B');
    this.executionOrder.push('edge:conditional->processB');
    return state;
  }

  @AgentEdge({
    from: 'processA',
    to: 'loop',
    condition: (state: AgentState) => state.metadata?.targetCount !== undefined ? 'loop' : undefined,
  })
  processAToLoop(state: AgentState) {
    console.log('\n➡️ [Edge: processA->loop] Entering loop');
    this.executionOrder.push('edge:processA->loop');
    return state;
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
  loopToSelf(state: AgentState) {
    console.log('\n🔄 [Edge: loop->loop] Continuing loop');
    this.executionOrder.push('edge:loop->loop');
    return state;
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
  loopToProcessB(state: AgentState) {
    console.log('\n➡️ [Edge: loop->processB] Loop complete, moving to process B');
    this.executionOrder.push('edge:loop->processB');
    return state;
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
  });
}); 