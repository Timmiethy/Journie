declare module 'jest-axe' {
  export interface AxeNodeResult {
    html: string;
    target: string[];
  }

  export interface AxeViolation {
    id: string;
    impact?: string | null;
    description: string;
    help: string;
    nodes: AxeNodeResult[];
  }

  export interface AxeResults {
    violations: AxeViolation[];
  }

  export function axe(
    html: Element | Document | string,
    options?: Record<string, unknown>,
  ): Promise<AxeResults>;
}
