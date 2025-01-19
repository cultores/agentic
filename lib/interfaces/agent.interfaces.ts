import { BaseMessage } from '@langchain/core/messages';

export interface AgentState {
  messages: BaseMessage[];
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AgentGraphOptions {
  name: string;
  description?: string;
}

export interface AgentNodeOptions {
  name: string;
  description?: string;
  type?: 'tool' | 'llm' | 'chain';
}

export interface AgentEdgeOptions {
  from: string;
  to: string;
  condition?: (state: AgentState) => string;
}

export interface AgencyConfig {
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface AgencyExecutionConfig {
  sequential?: boolean;
  stopOnError?: boolean;
  maxRetries?: number;
}
