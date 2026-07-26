import { cn } from '@/lib/utils'

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  // 表格只在桌面用(手机端各页面都换成了卡片列表),但仍留横向滚动兜底
  return (
    <div className="w-full overflow-x-auto scroll-touch">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}
export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b bg-gray-50', className)} {...props} />
}
export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}
export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b transition-colors hover:bg-gray-50', className)} {...props} />
}
export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-12 px-4 text-left align-middle font-medium text-gray-500 text-xs uppercase tracking-wide', className)} {...props} />
}
export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('p-4 align-middle', className)} {...props} />
}
