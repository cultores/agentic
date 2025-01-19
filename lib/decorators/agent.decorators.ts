import { Injectable } from '@nestjs/common';
import {
  AgentGraphOptions,
  AgentNodeOptions,
  AgentEdgeOptions,
} from '../interfaces/agent.interfaces';

export function AgentGraph(options: AgentGraphOptions) {
  return function (target: any) {
    Reflect.defineMetadata('agent:graph', options, target);
    Injectable()(target);
  };
}

export function AgentNode(options: AgentNodeOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const nodes = Reflect.getMetadata('agent:nodes', target.constructor) || [];
    nodes.push({
      ...options,
      methodName: propertyKey,
      method: descriptor.value,
    });
    Reflect.defineMetadata('agent:nodes', nodes, target.constructor);
    return descriptor;
  };
}

export function AgentEdge(options: AgentEdgeOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const edges = Reflect.getMetadata('agent:edges', target.constructor) || [];
    edges.push({
      ...options,
      methodName: propertyKey,
      method: descriptor.value,
    });
    Reflect.defineMetadata('agent:edges', edges, target.constructor);
    return descriptor;
  };
}

export function Agency(config: any) {
  return function (target: any) {
    Reflect.defineMetadata('agency:config', config, target);
    Injectable()(target);
  };
}
