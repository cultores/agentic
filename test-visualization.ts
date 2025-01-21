import { Test } from '@nestjs/testing';
import { AgenticVisualizer } from './lib/visualization/visualizer';
import { BaseAgent } from './lib/core/base.agent';
import { AgentGraph, AgentNode, AgentEdge } from './lib/decorators/agent.decorators';
import { NodeInput, NodeOutput, AgentState } from './lib/interfaces/agent.interfaces';

@AgentGraph({
  name: 'test-agent',
  description: 'Test agent implementation',
})
class TestAgent extends BaseAgent {
  @AgentNode({
    name: 'start',
    description: 'Start node',
    type: 'llm',
  })
  async start(input: NodeInput): Promise<NodeOutput> {
    console.log('🟢 Executing start node');
    return { state: input.state };
  }

  @AgentNode({
    name: 'process',
    description: 'Process node',
    type: 'tool',
  })
  async process(input: NodeInput): Promise<NodeOutput> {
    console.log('🔵 Executing process node');
    return { state: input.state };
  }

  @AgentNode({
    name: 'decide',
    description: 'Decision node',
    type: 'llm',
  })
  async decide(input: NodeInput): Promise<NodeOutput> {
    console.log('🟣 Executing decide node');
    return { state: input.state };
  }

  @AgentEdge({
    from: 'start',
    to: 'process',
  })
  startToProcess(state: AgentState): AgentState {
    console.log('➡️ Transitioning from start to process');
    return state;
  }

  @AgentEdge({
    from: 'process',
    to: 'decide',
  })
  processToDecide(state: AgentState): AgentState {
    console.log('➡️ Transitioning from process to decide');
    return state;
  }
}

async function main() {
  const moduleRef = await Test.createTestingModule({
    providers: [TestAgent],
  }).compile();

  const agent = moduleRef.get<TestAgent>(TestAgent);
  console.log('\nVisualizando Agente de Prueba:');
  console.log(AgenticVisualizer.visualize(agent));

  console.log('\nEjecutando el agente:');
  await agent.run({
    messages: [],
    context: {},
    metadata: {}
  });
}

main().catch(console.error); 