import { BaseMessage } from '@langchain/core/messages';

export interface AgentState {
  messages: BaseMessage[];
  context?: Record<string, any>;
  metadata?: Record<string, any>;
  loopControl?: {
    iterations: Record<string, number>;
    maxIterations?: Record<string, number>;
  };
}

export interface AgentGraphOptions {
  name: string;
  description?: string;
}

export interface AgentNodeOptions {
  name: string;
  description?: string;
  type?: 'tool' | 'llm' | 'chain' | 'loop';
  maxIterations?: number;
  loopCondition?: (state: AgentState) => boolean;
}

export interface AgentEdgeOptions {
  from: string;
  to: string;
  condition?: (state: AgentState) => string | undefined;
  allowLoop?: boolean;
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
