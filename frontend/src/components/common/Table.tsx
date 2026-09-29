import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full overflow-x-auto border border-slate-200 rounded-financial bg-white shadow-2xs">
      <table className={`w-full text-left text-xs border-collapse ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <thead
      className={`bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold select-none ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
};

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <tbody className={`divide-y divide-slate-100 ${className}`} {...props}>
      {children}
    </tbody>
  );
};

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  interactive = true,
  className = '',
  ...props
}) => {
  return (
    <tr
      className={`transition-colors ${
        interactive ? 'hover:bg-slate-50/80 cursor-default' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
};

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  align = 'left',
  className = '',
  ...props
}) => {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th
      scope="col"
      className={`py-3 px-4 font-semibold ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
  numeric?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  align = 'left',
  numeric = false,
  className = '',
  ...props
}) => {
  const alignClass =
    align === 'right' || numeric ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  const numericClass = numeric ? 'font-mono tabular-nums font-medium text-ink-900' : 'text-slate-700';

  return (
    <td
      className={`py-3.5 px-4 text-xs align-middle ${alignClass} ${numericClass} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
};
