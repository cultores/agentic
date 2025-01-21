import { BaseAgent } from '../core/base.agent';
import { BaseAgency } from '../core/base.agency';

export class AgenticVisualizer {
  private static createNodeBox(name: string, type: string): string {
    // Calcular ancho basado en el contenido más largo
    const minWidth = 20;
    const width = Math.max(minWidth, name.length + 4, (type.length + 2) + 4);
    
    // Centrar el contenido
    const nameSpaces = width - name.length;
    const typeSpaces = width - (type.length + 2); // +2 por los paréntesis
    
    const leftNamePad = ' '.repeat(Math.floor(nameSpaces / 2));
    const rightNamePad = ' '.repeat(Math.ceil(nameSpaces / 2));
    const leftTypePad = ' '.repeat(Math.floor(typeSpaces / 2));
    const rightTypePad = ' '.repeat(Math.ceil(typeSpaces / 2));

    const border = '─'.repeat(width);
    
    return [
      `    ╭${border}╮`,
      `    │${leftNamePad}${name}${rightNamePad}│`,
      `    ├${border}┤`,
      `    │${leftTypePad}(${type})${rightTypePad}│`,
      `    ╰${border}╯`
    ].join('\n');
  }

  private static createStartNode(): string {
    const name = '__start__';
    const minWidth = 20;
    const width = Math.max(minWidth, name.length + 4);
    const border = '─'.repeat(width);
    const spaces = width - name.length;
    const leftPad = ' '.repeat(Math.floor(spaces / 2));
    const rightPad = ' '.repeat(Math.ceil(spaces / 2));
    
    return [
      `    ╭${border}╮`,
      `    │${leftPad}${name}${rightPad}│`,
      `    ╰${border}╯`
    ].join('\n');
  }

  private static getAgentTree(agent: BaseAgent): string {
    const name = agent.constructor.name;
    const nodes = Reflect.getMetadata('nodes', agent.constructor) || [];
    const edges = Reflect.getMetadata('edges', agent.constructor) || [];
    
    const uniqueNodes = nodes.filter((node, index, self) => 
      index === self.findIndex(n => n.name === node.name)
    );

    let result = '';
    const nodeMap = new Map<string, string>();
    const renderedNodes = new Set<string>();

    // Crear el nodo inicial
    result += this.createStartNode() + '\n';
    result += '         │         \n';
    result += '         ▼         \n';
    
    // Crear representación de nodos
    uniqueNodes.forEach(node => {
      const box = this.createNodeBox(node.name, node.type);
      nodeMap.set(node.name, box);
    });

    // Organizar conexiones
    edges.forEach(edge => {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      
      if (fromNode && toNode) {
        if (!renderedNodes.has(edge.from)) {
          result += fromNode + '\n';
          renderedNodes.add(edge.from);
        }
        
        if (edge.condition) {
          result += '         │         \n';
          result += `    [${edge.condition.toString().slice(0, 10)}]    \n`;
        }
        
        result += '         │         \n';
        result += '         ▼         \n';
        
        if (!renderedNodes.has(edge.to)) {
          result += toNode + '\n';
          renderedNodes.add(edge.to);
        }
      }
    });

    return result;
  }

  private static getAgencyTree(agency: BaseAgency): string {
    const name = agency.constructor.name;
    const agents = agency.getAgents();
    
    let result = `\n=== ${name} ===\n\n`;
    agents.forEach(agent => {
      result += this.getAgentTree(agent) + '\n\n';
    });

    return result;
  }

  static visualize(target: BaseAgent | BaseAgency): string {
    if (target instanceof BaseAgency) {
      return this.getAgencyTree(target);
    }
    return this.getAgentTree(target);
  }
} 