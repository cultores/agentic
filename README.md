# @agentic

[![NPM Version](https://img.shields.io/npm/v/@agentic)](https://www.npmjs.com/package/@agentic)
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
npm install @agentic
```

## 🔧 Quick Start

1. Create an Agency:

```typescript
import { Agency, BaseAgency, AgencyConfig } from '@agentic';

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
import { BaseAgent, AgentState } from '@agentic';

export class MyAgent extends BaseAgent {
  async run(input: AgentState): Promise<AgentState> {
    // Implement your agent logic here
    return {
      messages: [...input.messages],
      context: { /* processed context */ },
      metadata: { /* agent metadata */ }
    };
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

- **Agency**: Orchestrates multiple agents and manages their execution flow
- **Agent**: Individual units that process messages and perform specific tasks
- **AgentState**: The data structure that flows between agents, containing messages, context, and metadata

## 🔍 Advanced Usage

### Custom Configuration

```typescript
const result = await agency.execute(
  { 
    messages: [initialMessage], 
    context: {}, 
    metadata: {} 
  },
  { 
    sequential: true, 
    stopOnError: true 
  }
);
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

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/nestjs/agentic/issues).

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for more information on what has changed recently. 