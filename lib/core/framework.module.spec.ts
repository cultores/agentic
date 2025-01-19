import { Test, TestingModule } from '@nestjs/testing';
import { FrameworkModule } from './framework.module';
import { BaseAgent } from './base.agent';
import { BaseAgency } from './base.agency';
import { Injectable } from '@nestjs/common';

@Injectable()
class TestAgent extends BaseAgent {
  async run(input: any) {
    return {
      messages: [],
      context: {},
      metadata: {}
    };
  }
}

@Injectable()
class TestAgency extends BaseAgency {
  async execute(input: any) {
    return {
      messages: [],
      context: {},
      metadata: {}
    };
  }
}

describe('FrameworkModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        FrameworkModule.forRoot({
          agents: [TestAgent],
          agencies: [TestAgency],
          providers: [],
          exports: [TestAgent, TestAgency]
        })
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide TestAgent', () => {
    const agent = module.get(TestAgent);
    expect(agent).toBeDefined();
    expect(agent).toBeInstanceOf(TestAgent);
  });

  it('should provide TestAgency', () => {
    const agency = module.get(TestAgency);
    expect(agency).toBeDefined();
    expect(agency).toBeInstanceOf(TestAgency);
  });

  it('should create empty module when no options provided', async () => {
    const emptyModule = await Test.createTestingModule({
      imports: [FrameworkModule.forRoot()]
    }).compile();

    expect(emptyModule).toBeDefined();
  });
}); 