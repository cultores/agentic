import { Injectable } from '@nestjs/common';
import {
  AgentGraphOptions,
  AgentNodeOptions,
  AgentEdgeOptions,
  AgentNodeDefinition,
  AgentEdgeDefinition,
  ToolNodeDefinition,
  LLMNodeDefinition,
  ChainNodeDefinition,
  LoopNodeDefinition
} from '../interfaces/agent.interfaces';
import { AgenticVisualizer } from '../visualization/visualizer';

type ClassMethodDecoratorContext<T = any, V = any> = {
  kind: 'method';
  name: string | symbol;
  static: boolean;
  private: boolean;
  access: { has(object: T): boolean; get(object: T): V };
  addInitializer?(initializer: () => void): void;
};

export function AgentGraph(options: AgentGraphOptions) {
  return function (target: any) {
    Reflect.defineMetadata('agent:graph', options, target);
    Injectable()(target);
  };
}

export function AgentNode(options: AgentNodeOptions) {
  return function (
    target: any,
    context: ClassMethodDecoratorContext | PropertyKey
  ) {
    const propertyKey = typeof context === 'object' ? context.name : context;
    const nodes = Reflect.getMetadata('nodes', target.constructor || target) || [];
    const methodName = propertyKey.toString();

    let node: AgentNodeDefinition;
    switch (options.type) {
      case 'tool':
        node = {
          ...options,
          type: 'tool',
          methodName,
          toolName: (options as any).toolName,
          tool: (options as any).tool,
          inputSchema: (options as any).inputSchema,
          outputSchema: (options as any).outputSchema,
          returnDirect: (options as any).returnDirect,
          callbacks: (options as any).callbacks
        } as ToolNodeDefinition & { methodName: string };
        break;
      case 'llm':
        node = {
          ...options,
          type: 'llm',
          methodName,
          model: (options as any).model,
          temperature: (options as any).temperature,
          maxTokens: (options as any).maxTokens,
          stopSequences: (options as any).stopSequences,
          callbacks: (options as any).callbacks
        } as LLMNodeDefinition & { methodName: string };
        break;
      case 'chain':
        node = {
          ...options,
          type: 'chain',
          methodName,
          chainType: (options as any).chainType || 'sequential',
          steps: (options as any).steps,
          inputVariables: (options as any).inputVariables,
          outputVariables: (options as any).outputVariables,
          memory: (options as any).memory,
          callbacks: (options as any).callbacks
        } as ChainNodeDefinition & { methodName: string };
        break;
      case 'loop':
        node = {
          ...options,
          type: 'loop',
          methodName,
          maxIterations: options.maxIterations || 1,
          loopCondition: options.loopCondition || (() => false)
        } as LoopNodeDefinition & { methodName: string };
        break;
      default:
        throw new Error(`Invalid node type: ${options.type}`);
    }

    Reflect.defineMetadata('nodes', [...nodes, node], target.constructor || target);
  };
}

export function AgentEdge(options: AgentEdgeOptions) {
  return function (
    target: any,
    context: ClassMethodDecoratorContext | PropertyKey
  ) {
    const propertyKey = typeof context === 'object' ? context.name : context;
    const edges = Reflect.getMetadata('edges', target.constructor || target) || [];
    const edge: AgentEdgeDefinition = {
      ...options,
      methodName: propertyKey.toString()
    };
    Reflect.defineMetadata('edges', [...edges, edge], target.constructor || target);
  };
}

export function Agency(config: any) {
  return function (target: any) {
    Reflect.defineMetadata('agency:config', config, target);
    Injectable()(target);
  };
}

export function VisualizeOnBoot(): ClassDecorator {
  return function (target: any) {
    const originalOnModuleInit = target.prototype.onModuleInit;
    
    target.prototype.onModuleInit = async function() {
      if (originalOnModuleInit) {
        await originalOnModuleInit.call(this);
      }
      
      console.log('\nAgentic Agency Visualization:');
      console.log(AgenticVisualizer.visualize(this));
    };
    
    return target;
  };
}
