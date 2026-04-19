'use client';
/**
 * Generic DataTable — wraps @tanstack/react-table with a neutral look.
 * Used by any agent module that needs to show a list of rows.
 */
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    type SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { Inbox } from 'lucide-react';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    emptyTitle?: string;
    emptyDescription?: string;
    onRowClick?: (row: TData) => void;
    className?: string;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    emptyTitle = 'No records yet',
    emptyDescription = 'New rows will appear here.',
    onRowClick,
    className,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);

    const table = useReactTable({
        data,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    if (data.length === 0) {
        return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />;
    }

    return (
        <div className={cn('rounded-xl border border-slate-200 bg-white overflow-hidden', className)}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id}>
                                {hg.headers.map((header) => (
                                    <th key={header.id} className="px-4 py-3 font-medium">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext(),
                                              )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {table.getRowModel().rows.map((row) => (
                            <tr
                                key={row.id}
                                onClick={() => onRowClick?.(row.original)}
                                className={cn(
                                    'hover:bg-slate-50 transition-colors',
                                    onRowClick && 'cursor-pointer',
                                )}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="px-4 py-3 text-slate-700">
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext(),
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
