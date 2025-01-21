#!/usr/bin/env node

import { resolve } from 'path';
import { globby } from 'globby';
import { AgenticVisualizer } from './visualizer';
import { BaseAgent } from '../core/base.agent';
import { BaseAgency } from '../core/base.agency';

async function findAgentsAndAgencies() {
  try {
    const cwd = process.cwd();
    const files = await globby(['**/*.ts', '!**/*.d.ts', '!**/node_modules/**', '!**/dist/**']);
    const instances: (BaseAgent | BaseAgency)[] = [];

    for (const file of files) {
      try {
        const module = await import(resolve(cwd, file));
        Object.values(module).forEach((value: any) => {
          if (typeof value === 'function' && 
              (value.prototype instanceof BaseAgent || value.prototype instanceof BaseAgency)) {
            try {
              const Constructor = value as new () => (BaseAgent | BaseAgency);
              instances.push(new Constructor());
            } catch (error) {
              // Ignorar errores de instanciación
            }
          }
        });
      } catch (error) {
        // Ignorar errores de importación
      }
    }

    return instances;
  } catch (error) {
    console.error('Error scanning for agents:', error);
    process.exit(1);
  }
}

async function main() {
  try {
    console.log('🔍 Scanning for Agentic instances...\n');
    const instances = await findAgentsAndAgencies();

    if (instances.length === 0) {
      console.log('No Agentic instances found in the project.');
      return;
    }

    console.log('Found Agentic instances:\n');
    instances.forEach(instance => {
      console.log(AgenticVisualizer.visualize(instance));
      console.log(''); // Empty line between instances
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Solo ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} 