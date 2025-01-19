import { Injectable } from '@nestjs/common';
import { Agency } from '../decorators/agent.decorators';
import { BaseAgent } from './base.agent';
import {
  AgentState,
  AgencyConfig,
  AgencyExecutionConfig,
} from '../interfaces/agent.interfaces';

@Agency({
  name: 'base-agency',
  description: 'Base agency implementation',
})
@Injectable()
export abstract class BaseAgency {
  protected agents: BaseAgent[] = [];
  protected config: AgencyConfig;

  constructor() {
    this.config = this.getConfig();
  }

  registerAgent(agent: BaseAgent) {
    this.agents.push(agent);
  }

  getAgents(): BaseAgent[] {
    return this.agents;
  }

  async execute(
    input: Partial<AgentState>,
    config: AgencyExecutionConfig = {},
  ): Promise<AgentState> {
    const { sequential = true, stopOnError = true, maxRetries = 3 } = config;

    let currentState: AgentState = {
      messages: [],
      context: {},
      metadata: {},
      ...input,
    };

    if (sequential) {
      for (const agent of this.agents) {
        let retries = 0;
        let success = false;

        while (!success && retries < maxRetries) {
          try {
            currentState = await agent.run(currentState);
            success = true;
          } catch (error) {
            retries++;
            if (stopOnError && retries >= maxRetries) {
              throw error;
            }
          }
        }
      }
    } else {
      // Parallel execution
      const results = await Promise.allSettled(
        this.agents.map((agent) => agent.run(currentState)),
      );

      // Merge results from successful executions
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          currentState = {
            ...currentState,
            ...result.value,
            messages: [...currentState.messages, ...result.value.messages],
          };
        } else if (stopOnError) {
          throw result.reason;
        }
      });
    }

    return currentState;
  }

  protected getConfig(): AgencyConfig {
    return (
      Reflect.getMetadata('agency:config', this.constructor) || {
        name: 'unnamed-agency',
      }
    );
  }
}
