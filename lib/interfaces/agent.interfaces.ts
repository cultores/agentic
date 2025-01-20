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

export type NodeInput = {
  state: AgentState;
  params?: Record<string, unknown>;
};

export type NodeOutput = {
  state: AgentState;
  result?: unknown;
};

export type NodeType = 'tool' | 'llm' | 'chain' | 'loop';

export interface BaseNodeDefinition {
  name: string;
  description?: string;
  type: NodeType;
  validate?: (input: NodeInput) => boolean | Promise<boolean>;
  transform?: (output: NodeOutput) => NodeOutput | Promise<NodeOutput>;
}

export interface ToolNodeDefinition extends BaseNodeDefinition {
  type: 'tool';
  toolName: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface LLMNodeDefinition extends BaseNodeDefinition {
  type: 'llm';
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChainNodeDefinition extends BaseNodeDefinition {
  type: 'chain';
  steps: string[];
}

export interface LoopNodeDefinition extends BaseNodeDefinition {
  type: 'loop';
  maxIterations: number;
  loopCondition: (state: AgentState) => boolean;
}

export type AgentNodeDefinition = 
  | ToolNodeDefinition 
  | LLMNodeDefinition 
  | ChainNodeDefinition 
  | LoopNodeDefinition;

export interface AgentNodeOptions extends Omit<BaseNodeDefinition, 'type'> {
  type?: NodeType;
  maxIterations?: number;
  loopCondition?: (state: AgentState) => boolean;
}

export type EdgeConditionResult = {
  proceed: boolean;
  nextNode?: string;
  error?: string;
};

export interface EdgeDefinition {
  from: string;
  to: string;
  name?: string;
  description?: string;
  condition?: (state: AgentState) => EdgeConditionResult | Promise<EdgeConditionResult>;
  transform?: (state: AgentState) => AgentState | Promise<AgentState>;
  allowLoop?: boolean;
  priority?: number;
  metadata?: {
    requiredCapabilities?: string[];
    timeout?: number;
    retryStrategy?: {
      maxRetries: number;
      backoff: 'linear' | 'exponential';
    };
  };
}

export interface AgentEdgeOptions extends Omit<EdgeDefinition, 'condition'> {
  condition?: (state: AgentState) => string | undefined;
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string[];
  details?: Record<string, unknown>;
}

export interface GraphValidation {
  validateNode: (node: AgentNodeDefinition) => ValidationError[];
  validateEdge: (edge: EdgeDefinition, nodes: Map<string, AgentNodeDefinition>) => ValidationError[];
  validateGraph: (nodes: AgentNodeDefinition[], edges: EdgeDefinition[]) => ValidationError[];
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
