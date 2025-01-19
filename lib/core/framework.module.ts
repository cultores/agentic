import { DynamicModule, Module } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { BaseAgency } from './base.agency';

export interface FrameworkModuleOptions {
  agents?: (typeof BaseAgent)[];
  agencies?: (typeof BaseAgency)[];
  providers?: any[];
  exports?: any[];
}

@Module({})
export class FrameworkModule {
  static forRoot(options: FrameworkModuleOptions = {}): DynamicModule {
    const providers = [
      ...(options.agents || []),
      ...(options.agencies || []),
      ...(options.providers || []),
    ];

    return {
      module: FrameworkModule,
      providers,
      exports: [...providers, ...(options.exports || [])],
      global: true,
    };
  }
}
