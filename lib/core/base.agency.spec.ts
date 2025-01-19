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

describe('BaseAgency', () => {
  let agency: TestAgency;
  let agent: TestAgent;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestAgency, TestAgent],
    }).compile();

    agency = module.get<TestAgency>(TestAgency);
    agent = module.get<TestAgent>(TestAgent);
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
}); 