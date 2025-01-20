import { AgentGraph, AgentNode, AgentEdge, Agency } from './agent.decorators';
import { BaseAgent } from '../core/base.agent';
import { AgentState, ChainNodeDefinition, ToolNodeDefinition, LLMNodeDefinition } from '../interfaces/agent.interfaces';

describe('Agent Decorators', () => {
  describe('AgentGraph', () => {
    it('should decorate class with graph metadata', () => {
      @AgentGraph({
        name: 'test-graph',
        description: 'Test graph'
      })
      class TestAgent extends BaseAgent {}

      const metadata = Reflect.getMetadata('agent:graph', TestAgent);
      expect(metadata).toEqual({
        name: 'test-graph',
        description: 'Test graph'
      });
    });
  });

  describe('AgentNode', () => {
    it('should handle all node types', () => {
      class TestAgent extends BaseAgent {
        @AgentNode({
          name: 'tool-node',
          description: 'Tool node',
          type: 'tool',
          toolName: 'test-tool'
        } as ToolNodeDefinition)
        toolNode() {}

        @AgentNode({
          name: 'llm-node',
          description: 'LLM node',
          type: 'llm',
          model: 'test-model'
        } as LLMNodeDefinition)
        llmNode() {}

        @AgentNode({
          name: 'chain-node',
          description: 'Chain node',
          type: 'chain',
          chainType: 'sequential'
        } as ChainNodeDefinition)
        chainNode() {}

        @AgentNode({
          name: 'loop-node',
          description: 'Loop node',
          type: 'loop',
          maxIterations: 5
        })
        loopNode() {}
      }

      const nodes = Reflect.getMetadata('nodes', TestAgent);
      expect(nodes).toHaveLength(5);
      expect(nodes.map(n => n.type)).toEqual(['llm', 'tool', 'llm', 'chain', 'loop']);
    });

    it('should handle all node types with full options', () => {
      class TestAgent extends BaseAgent {
        @AgentNode({
          name: 'chain-node',
          description: 'Chain node',
          type: 'chain',
          steps: ['step1', 'step2'],
          inputVariables: ['input1'],
          outputVariables: ['output1'],
          memory: true,
          callbacks: {}
        } as ChainNodeDefinition)
        chainNode() {}

        @AgentNode({
          name: 'loop-node',
          description: 'Loop node',
          type: 'loop',
          maxIterations: 5,
          loopCondition: (state: AgentState) => (state.loopControl?.iterations?.['loop-node'] || 0) < 5
        })
        loopNode() {}
      }

      const nodes = Reflect.getMetadata('nodes', TestAgent);
      const chainNode = nodes.find(n => n.methodName === 'chainNode');
      const loopNode = nodes.find(n => n.methodName === 'loopNode');

      expect(chainNode).toMatchObject({
        type: 'chain',
        steps: ['step1', 'step2'],
        inputVariables: ['input1'],
        outputVariables: ['output1'],
        memory: true,
        callbacks: {}
      });

      expect(loopNode).toMatchObject({
        type: 'loop',
        maxIterations: 5
      });
      expect(typeof loopNode.loopCondition).toBe('function');
    });

    it('should use default values for loop node', () => {
      class TestAgent extends BaseAgent {
        @AgentNode({
          name: 'default-loop',
          description: 'Default loop node',
          type: 'loop'
        })
        defaultLoop() {}
      }

      const nodes = Reflect.getMetadata('nodes', TestAgent);
      const loopNode = nodes.find(n => n.methodName === 'defaultLoop');

      expect(loopNode.maxIterations).toBe(1);
      expect(typeof loopNode.loopCondition).toBe('function');
      expect(loopNode.loopCondition({} as AgentState)).toBe(false);
    });

    it('should throw error for invalid node type', () => {
      expect(() => {
        class TestAgent extends BaseAgent {
          @AgentNode({
            name: 'invalid-node',
            description: 'Invalid node',
            type: 'invalid' as any
          })
          invalidNode() {}
        }
      }).toThrow('Invalid node type: invalid');
    });
  });

  describe('AgentEdge', () => {
    it('should decorate method with edge metadata', () => {
      class TestAgent extends BaseAgent {
        @AgentEdge({
          from: 'start',
          to: 'end',
          condition: (state: AgentState) => 'end',
          allowLoop: true
        })
        testEdge() {}
      }

      const edges = Reflect.getMetadata('edges', TestAgent);
      expect(edges).toHaveLength(2);
      expect(edges[1]).toMatchObject({
        from: 'start',
        to: 'end',
        allowLoop: true
      });
    });
  });

  describe('Agency', () => {
    it('should decorate class with agency metadata', () => {
      @Agency({
        name: 'test-agency',
        description: 'Test agency'
      })
      class TestAgency {}

      const metadata = Reflect.getMetadata('agency:config', TestAgency);
      expect(metadata).toEqual({
        name: 'test-agency',
        description: 'Test agency'
      });
    });
  });
}); 