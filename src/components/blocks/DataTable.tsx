'use client';
/**
 * Generic DataTable — wraps @tanstack/react-table with a neutral look.
 * Used by any agent module that needs to show a list of rows.
 *
 * v36 — optional row-selection support. Set `enableRowSelection` to
 * surface a checkbox column at index 0 + a master "select all"
 * checkbox in the header. The parent component can wire
 * `onSelectedRowsChange` to drive a bulk-actions toolbar.
 */
import {
    type ColumnDef,
    type RowSelectionState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    type SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
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
    /** v36 — turn on the checkbox column + master select-all. */
    enableRowSelection?: boolean;
    /** v36 — fired whenever the selection set changes. Gets the
     *  currently-selected ROW DATA (not just keys). */
    onSelectedRowsChange?: (rows: TData[]) => void;
    /** v36 — uniquely identify each row for selection tracking.
     *  Defaults to the array index. Stable id is required if the
     *  table data is paged or filters re-order. */
    getRowId?: (row: TData, index: number) => string;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    emptyTitle = 'No records yet',
    emptyDescription = 'New rows will appear here.',
    onRowClick,
    className,
    enableRowSelection = false,
    onSelectedRowsChange,
    getRowId,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    /**
     * v36 — inject the checkbox column at index 0 when row selection
     * is on. We build it inline so the existing column definitions in
     * caller modules don't need to know about it.
     */
    const effectiveColumns = useMemo<ColumnDef<TData, TValue>[]>(() => {
        if (!enableRowSelection) return columns;
        const selectColumn: ColumnDef<TData, TValue> = {
            id: '__select__',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={table.getIsAllRowsSelected()}
                    ref={(el) => {
                        if (el) el.indeterminate = table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected();
                    }}
                    onChange={table.getToggleAllRowsSelectedHandler()}
                    className="h-4 w-4 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    aria-label={`Select row ${row.id}`}
                    checked={row.getIsSelected()}
                    disabled={!row.getCanSelect()}
                    onChange={row.getToggleSelectedHandler()}
                    className="h-4 w-4 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                />
            ),
            // Don't sort on the select column
            enableSorting: false,
            size: 36,
        };
        return [selectColumn, ...columns];
    }, [columns, enableRowSelection]);

    const table = useReactTable({
        data,
        columns: effectiveColumns,
        state: { sorting, rowSelection },
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        enableRowSelection,
        getRowId: getRowId ?? ((_row, index) => String(index)),
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    // v36 — broadcast the selected ROW DATA (not just IDs) to the parent
    // every time the selection set changes. Use useEffect so we don't
    // fire during render.
    useEffect(() => {
        if (!enableRowSelection || !onSelectedRowsChange) return;
        const rows = table.getSelectedRowModel().rows.map((r) => r.original);
        onSelectedRowsChange(rows);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowSelection, enableRowSelection]);

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
                                    row.getIsSelected() && 'bg-blue-50/40',
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
