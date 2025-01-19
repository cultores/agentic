import { Test, TestingModule } from '@nestjs/testing';
import { BaseAgent } from './base.agent';
import { AgentState } from '../interfaces/agent.interfaces';
import { HumanMessage } from '@langchain/core/messages';

class TestAgent extends BaseAgent {
  async run(input: any): Promise<AgentState> {
    return {
      messages: [new HumanMessage(input)],
      context: { input },
      metadata: { status: 'success' }
    };
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestAgent],
    }).compile();

    agent = module.get<TestAgent>(TestAgent);
  });

  it('should be defined', () => {
    expect(agent).toBeDefined();
  });

  it('should have empty tools, nodes and edges arrays by default', () => {
    expect(agent['tools']).toEqual([]);
    expect(agent['nodes']).toEqual([]);
    expect(agent['edges']).toEqual([]);
  });

  it('should process input and return agent state', async () => {
    const input = 'test message';
    const result = await agent.run(input);
    
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe(input);
    expect(result.context).toEqual({ input });
    expect(result.metadata).toEqual({ status: 'success' });
  });
}); 