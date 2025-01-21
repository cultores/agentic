# @cultores/agentic

[![NPM Version](https://img.shields.io/npm/v/@cultores/agentic)](https://www.npmjs.com/package/@cultores/agentic)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful NestJS framework for building LLM-powered agents with ease and flexibility.

## 🚀 Features

- 🤖 Simple and intuitive API for creating LLM-powered agents
- 🔌 Seamless integration with NestJS
- 🎯 Type-safe agent development
- 🔄 Support for sequential and parallel agent execution
- 🛠️ Extensible architecture
- 📦 Built on top of LangChain.js

## 📦 Installation

```bash
npm install @cultores/agentic
```

## 🔧 Quick Start

1. Create an Agency:

```typescript
import { Agency, BaseAgency, AgencyConfig } from '@cultores/agentic';

@Agency({
  name: 'my-agency',
  description: 'My custom agency implementation',
})
export class MyAgency extends BaseAgency {
  protected getConfig(): AgencyConfig {
    return {
      name: 'my-agency',
      description: 'My custom agency implementation',
      metadata: { /* your metadata */ }
    };
  }
}
```

2. Create an Agent:

```typescript
import { BaseAgent, AgentState, AgentGraph, AgentNode, AgentEdge } from '@cultores/agentic';

@AgentGraph({
  name: 'my-agent',
  description: 'My custom agent implementation'
})
export class MyAgent extends BaseAgent {
  @AgentNode({
    name: 'start',
    description: 'Initial processing',
    type: 'llm'
  })
  async start(input: NodeInput): Promise<NodeOutput> {
    return {
      state: {
        ...input.state,
        context: { start: true }
      }
    };
  }

  @AgentNode({
    name: 'process',
    description: 'Main processing',
    type: 'tool'
  })
  async process(input: NodeInput): Promise<NodeOutput> {
    return {
      state: {
        ...input.state,
        context: { processed: true }
      }
    };
  }

  @AgentEdge({
    from: 'start',
    to: 'process',
    condition: (state) => state.context.start ? 'process' : undefined
  })
  startToProcess(state: AgentState): AgentState {
    return state;
  }
}
```

3. Register and Use:

```typescript
import { Module } from '@nestjs/common';

@Module({
  providers: [MyAgency, MyAgent],
})
export class AppModule {}
```

## 🌟 Key Concepts

### Agency

An Agency is the top-level orchestrator that manages multiple agents. It handles:
- Agent registration and lifecycle management
- Sequential or parallel execution of agents
- Error handling and retries
- State management across agent executions

```typescript
// Register multiple agents
agency.registerAgent(agent1);
agency.registerAgent(agent2);

// Execute sequentially with error handling
const result = await agency.execute(
  { 
    messages: [initialMessage], 
    context: {}, 
    metadata: {} 
  },
  { 
    sequential: true, 
    stopOnError: true,
    maxRetries: 3
  }
);

// Execute in parallel
const parallelResult = await agency.execute(
  initialState,
  { 
    sequential: false,
    stopOnError: false
  }
);
```

### Agents

Agents are the core processing units that can:
- Process messages using LLMs
- Execute tools and functions
- Chain multiple operations
- Maintain state and memory
- Handle loops and conditions

### Node Types

1. **LLM Nodes**: Process text using language models
```typescript
@AgentNode({
  name: 'generate',
  type: 'llm',
  model: 'gpt-4',  // Can be string identifier or model instance
  temperature: 0.7,
  maxTokens: 1000
})
async generate(input: NodeInput): Promise<NodeOutput> {
  // The model will be automatically loaded and used
  return {
    state: {
      ...input.state,
      context: { generated: true }
    }
  };
}
```

2. **Tool Nodes**: Execute specific functions or tools
```typescript
@AgentNode({
  name: 'calculate',
  type: 'tool',
  toolName: 'calculator',
  callbacks: new CallbackManager()  // Optional callbacks
})
async calculate(input: NodeInput): Promise<NodeOutput> {
  // The tool will be automatically executed with input.params
  return {
    state: {
      ...input.state,
      context: { calculated: true }
    }
  };
}
```

3. **Chain Nodes**: Combine multiple operations
```typescript
@AgentNode({
  name: 'process',
  type: 'chain',
  chainType: 'sequential',
  steps: ['parse', 'validate', 'transform'],
  memory: true  // Enable memory for the chain
})
async process(input: NodeInput): Promise<NodeOutput> {
  return {
    state: {
      ...input.state,
      context: { chained: true },
      memory: {
        chatHistory: [...(input.state.memory?.chatHistory || [])],
        variables: { processed: true }
      }
    }
  };
}
```

4. **Loop Nodes**: Handle repetitive operations
```typescript
@AgentNode({
  name: 'retry',
  type: 'loop',
  maxIterations: 3,
  loopCondition: (state) => {
    const counter = state.context?.counter || 0;
    const target = state.metadata?.targetCount || 0;
    return counter < target;
  }
})
async retry(input: NodeInput): Promise<NodeOutput> {
  const counter = (input.state.context?.counter || 0) + 1;
  return {
    state: {
      ...input.state,
      context: { 
        ...input.state.context,
        counter,
        retried: true
      }
    }
  };
}
```

### Complex Flow Control

Example of an agent with conditional branching and loops:

```typescript
@AgentGraph({
  name: 'workflow-agent',
  description: 'Agent with complex workflow'
})
class WorkflowAgent extends BaseAgent {
  @AgentNode({
    name: 'start',
    type: 'llm'
  })
  async start(input: NodeInput): Promise<NodeOutput> {
    return {
      state: {
        ...input.state,
        context: { start: true }
      }
    };
  }

  @AgentNode({
    name: 'conditional',
    type: 'llm'
  })
  async conditional(input: NodeInput): Promise<NodeOutput> {
    const route = input.state.metadata?.route || 'A';
    return {
      state: {
        ...input.state,
        context: { 
          ...input.state.context,
          conditional: true,
          route
        }
      }
    };
  }

  @AgentNode({
    name: 'processA',
    type: 'tool'
  })
  async processA(input: NodeInput): Promise<NodeOutput> {
    return {
      state: {
        ...input.state,
        context: { ...input.state.context, processA: true }
      }
    };
  }

  @AgentNode({
    name: 'processB',
    type: 'tool'
  })
  async processB(input: NodeInput): Promise<NodeOutput> {
    return {
      state: {
        ...input.state,
        context: { ...input.state.context, processB: true }
      }
    };
  }

  @AgentEdge({
    from: 'start',
    to: 'conditional'
  })
  startToConditional(state: AgentState): AgentState {
    return state;
  }

  @AgentEdge({
    from: 'conditional',
    to: 'processA',
    condition: (state) => state.context?.route === 'A' ? 'processA' : undefined
  })
  conditionalToA(state: AgentState): AgentState {
    return state;
  }

  @AgentEdge({
    from: 'conditional',
    to: 'processB',
    condition: (state) => state.context?.route === 'B' ? 'processB' : undefined
  })
  conditionalToB(state: AgentState): AgentState {
    return state;
  }
}
```

### 📊 Visualization

Agentic provides a built-in visualization tool to help you understand and debug your agent's flow. You can use it in three ways:

1. **CLI Command**: After installing the package globally or in your project:
```bash
# Using npx
npx @cultores/agentic visualize

# Or if installed globally
agentic visualize
```

2. **Package Script**: Add to your `package.json`:
```json
{
  "scripts": {
    "visualize": "@cultores/agentic visualize"
  }
}
```

3. **Programmatically**: Import and use in your TypeScript code:
```typescript
import { AgenticVisualizer } from '@cultores/agentic';

// Create an instance of your agent
const myAgent = new MyAgent();

// Generate the visualization
const visualization = AgenticVisualizer.visualize(myAgent);
console.log(visualization);
```

The visualizer will scan your project for agent instances and generate an ASCII representation of each agent's nodes and their connections:

```
┌──────────────┐
│  __start__   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    start     │
│    (llm)     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   process    │
│   (tool)     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    decide    │
│    (llm)     │
└──────────────┘
```

This visualization helps you:
- Verify the structure of your agent's flow
- Debug connection issues
- Understand the execution path
- Document your agent's architecture

### Error Handling

The framework provides robust error handling:

```typescript
// Handle node execution errors
try {
  const result = await agent.run({
    messages: [],
    context: {},
    metadata: { route: 'invalid' }
  });
} catch (error) {
  console.error('Node execution failed:', error.message);
}

// Handle parallel execution errors
const result = await agency.execute(
  initialState,
  { 
    sequential: false,
    stopOnError: false  // Continue even if some agents fail
  }
);

// Retry logic
const result = await agency.execute(
  initialState,
  { 
    maxRetries: 3,  // Retry failed operations
    sequential: true
  }
);
```

### Message Handling

The framework supports different message types:

```typescript
// Human message
const humanMessage = {
  role: 'human',
  content: 'Hello agent',
  additionalKwargs: { key: 'value' }
};

// AI message
const aiMessage = {
  role: 'ai',
  content: 'Hello human',
  additionalKwargs: { confidence: 0.9 }
};

// System message
const systemMessage = {
  role: 'system',
  content: 'You are a helpful assistant',
  additionalKwargs: { priority: 'high' }
};
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Format code
npm run format

# Lint code
npm run lint
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

Frederick Bejarano Sanchez

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/cultores/agentic/issues).

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for more information on what has changed recently. 