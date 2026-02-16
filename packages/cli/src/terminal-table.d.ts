declare module 'terminal-table' {
  interface TerminalTableOptions {
    borderStyle?: number;
    horizontalLine?: boolean;
    width?: number[];
    rightPadding?: number;
    leftPadding?: number;
  }

  interface CellOptions {
    colSpan?: number;
    rowSpan?: number;
    align?: 'left' | 'center' | 'right';
    color?: string;
    value?: string;
  }

  class Table {
    constructor(options?: TerminalTableOptions);
    push(rows: (string | number | CellOptions)[][]): Table;
    toString(): string;
  }

  const TerminalTable: {
    (options?: TerminalTableOptions): Table;
    style(colors: string[]): (text: string) => string;
  };

  export = TerminalTable;
}
