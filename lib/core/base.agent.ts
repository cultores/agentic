import { Injectable } from '@nestjs/common';
import {
  AgentGraph,
  AgentNode,
  AgentEdge,
} from '../decorators/agent.decorators';
import { AgentState } from '../interfaces/agent.interfaces';

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

  async run(input: any): Promise<AgentState> {
    const nodes = Reflect.getMetadata('agent:nodes', this.constructor) || [];
    let currentState: AgentState = {
      messages: [],
      context: {},
      metadata: {},
      ...input,
    };

    // Simple sequential execution for now
    for (const node of nodes) {
      currentState = await node.method.call(this, currentState);
    }

    return currentState;
  }
}
