import { Test, TestingModule } from '@nestjs/testing';
import { BaseAgency } from './base.agency';
import { BaseAgent } from './base.agent';
import { Agency } from '../decorators/agent.decorators';
import { AgentState, AgencyConfig } from '../interfaces/agent.interfaces';
import { HumanMessage } from '@langchain/core/messages';

@Agency({
  name: 'test-agency',
  description: 'Test agency implementation',
})
class TestAgency extends BaseAgency {
  protected getConfig(): AgencyConfig {
    return {
      name: 'test-agency',
      description: 'Test agency implementation',
      metadata: { test: true }
    };
  }
}

class TestAgent extends BaseAgent {
  async run(input: AgentState): Promise<AgentState> {
    return {
      messages: [new HumanMessage(input.messages[0].content as string)],
      context: { processed: true },
      metadata: { agentName: 'test-agent' }
    };
  }
}

class UnnamedAgency extends BaseAgency {}

describe('BaseAgency', () => {
  let agency: TestAgency;
  let agent: TestAgent;
  let unnamedAgency: UnnamedAgency;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestAgency, TestAgent, UnnamedAgency],
    }).compile();

    agency = module.get<TestAgency>(TestAgency);
    agent = module.get<TestAgent>(TestAgent);
    unnamedAgency = module.get<UnnamedAgency>(UnnamedAgency);
  });

  it('should be defined', () => {
    expect(agency).toBeDefined();
  });

  it('should register and retrieve agents', () => {
    agency.registerAgent(agent);
    const agents = agency.getAgents();
    
    expect(agents).toHaveLength(1);
    expect(agents[0]).toBe(agent);
  });

  it('should execute with single agent', async () => {
    agency.registerAgent(agent);
    
    const input = 'test input';
    const initialMessage = new HumanMessage(input);
    const result = await agency.execute({ 
      messages: [initialMessage],
      context: {},
      metadata: {}
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe(input);
    expect(result.context).toHaveProperty('processed', true);
    expect(result.metadata).toHaveProperty('agentName', 'test-agent');
  });

  it('should execute with custom config', async () => {
    agency.registerAgent(agent);
    const input = 'test';
    const initialMessage = new HumanMessage(input);
    
    const result = await agency.execute(
      { messages: [initialMessage], context: {}, metadata: {} },
      { sequential: true, stopOnError: true }
    );

    expect(result).toBeDefined();
    expect(result.messages).toBeDefined();
    expect(result.context).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it('should handle errors during execution', async () => {
    const errorAgent = new class extends TestAgent {
      async run(): Promise<AgentState> {
        throw new Error('Test error');
      }
    };
    
    agency.registerAgent(errorAgent);
    const input = 'test input';
    const initialMessage = new HumanMessage(input);
    
    await expect(agency.execute({ 
      messages: [initialMessage],
      context: {},
      metadata: {}
    })).rejects.toThrow('Test error');
  });

  it('should handle parallel execution', async () => {
    const agent1 = new TestAgent();
    const agent2 = new TestAgent();
    
    agency.registerAgent(agent1);
    agency.registerAgent(agent2);
    
    const input = 'test input';
    const initialMessage = new HumanMessage(input);
    const result = await agency.execute(
      { messages: [initialMessage], context: {}, metadata: {} },
      { sequential: false }
    );

    expect(result.messages).toHaveLength(1);
    expect(result.context).toHaveProperty('processed', true);
  });

  it('should handle empty agent list', async () => {
    const input = 'test input';
    const initialMessage = new HumanMessage(input);
    
    const result = await agency.execute({ 
      messages: [initialMessage],
      context: {},
      metadata: {}
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe(input);
  });

  it('should validate execution config', async () => {
    agency.registerAgent(agent);
    const input = 'test input';
    const initialMessage = new HumanMessage(input);
    
    const result = await agency.execute(
      { messages: [initialMessage], context: {}, metadata: {} },
      { sequential: true, stopOnError: true }
    );

    expect(result).toBeDefined();
    expect(result.messages).toBeDefined();
  });

  it('should handle parallel execution with no successful results', async () => {
    const errorAgent1 = new class extends TestAgent {
      async run(): Promise<AgentState> {
        throw new Error('Error 1');
      }
    };
    const errorAgent2 = new class extends TestAgent {
      async run(): Promise<AgentState> {
        throw new Error('Error 2');
      }
    };
    
    agency.registerAgent(errorAgent1);
    agency.registerAgent(errorAgent2);
    
    const input = 'test input';
    const initialMessage = new HumanMessage(input);
    
    const result = await agency.execute(
      { messages: [initialMessage], context: {}, metadata: {} },
      { sequential: false, stopOnError: false }
    );

    // Should maintain initial state when no successful results
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe(input);
  });

  it('should handle parallel execution errors with stopOnError', async () => {
    const errorAgent = new class extends TestAgent {
      async run(): Promise<AgentState> {
        throw new Error('Test parallel error');
      }
    };
    
    agency.registerAgent(errorAgent);
    const input = 'test input';
    const initialMessage = new HumanMessage(input);
    
    await expect(agency.execute(
      { messages: [initialMessage], context: {}, metadata: {} },
      { sequential: false, stopOnError: true }
    )).rejects.toThrow('Test parallel error');
  });

  it('should handle sequential execution with retries', async () => {
    let attempts = 0;
    const retryAgent = new class extends TestAgent {
      async run(state: AgentState): Promise<AgentState> {
        attempts++;
        if (attempts < 2) {
          throw new Error('Retry error');
        }
        return {
          messages: [new HumanMessage('success')],
          context: { success: true },
          metadata: {}
        };
      }
    };
    
    agency.registerAgent(retryAgent);
    const result = await agency.execute(
      { messages: [], context: {}, metadata: {} },
      { maxRetries: 3 }
    );

    expect(attempts).toBe(2);
    expect(result.context).toHaveProperty('success', true);
  });

  it('should use default config from base Agency decorator', () => {
    const config = unnamedAgency['getConfig']();
    expect(config).toEqual({
      name: 'base-agency',
      description: 'Base agency implementation'
    });
  });
}); 