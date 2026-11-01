import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useDb } from '@/lib/store'
import { downloadCsv, fmtDate, fmtDateTime } from '@/lib/utils'
import { Button, Card, Empty, PageHeader, Pagination, SearchInput, Select, Table, Tag, Td, Th, Toolbar, Tr, usePaged, type Tone } from '@/components/ui'

const MODULE_TONE: Record<string, Tone> = { 主播: 'brand', 别名: 'brand', 绑定: 'success', 温度值: 'warning', 转分: 'warning', 赛季: 'danger', 规则: 'danger', 系统: 'default' }

export function AuditLog() {
  const { db } = useDb()
  const [q, setQ] = useState('')
  const [module, setModule] = useState('all')
  const [operator, setOperator] = useState('all')
  const modules = [...new Set(db.audit.map((a) => a.module))]
  const operators = [...new Set(db.audit.map((a) => a.operator))]
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return db.audit.filter((a) => (module === 'all' || a.module === module) && (operator === 'all' || a.operator === operator) && (!kw || [a.action, a.target, a.detail].some((x) => x.toLowerCase().includes(kw))))
  }, [db.audit, q, module, operator])
  const paged = usePaged(rows, 15)
  return (
    <>
      <PageHeader eyebrow="系统" title="操作日志" desc="后台所有写操作都会记录操作人、对象与原因，用于审计与问题追溯。" />
      <Card flush>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="搜索操作、对象或详情" />
          <Select value={module} onChange={(e) => setModule(e.target.value)} aria-label="模块" className="w-32">
            <option value="all">全部模块</option>
            {modules.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
          <Select value={operator} onChange={(e) => setOperator(e.target.value)} aria-label="操作人" className="w-36">
            <option value="all">全部操作人</option>
            {operators.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
          <div className="flex-1" />
          <Button theme="light" icon={<Download className="size-4" />} onClick={() => downloadCsv(`操作日志_${fmtDate(new Date().toISOString())}.csv`, ['时间', '操作人', '模块', '操作', '对象', '详情'], rows.map((a) => [fmtDateTime(a.time, true), a.operator, a.module, a.action, a.target, a.detail]))}>
            导出
          </Button>
        </Toolbar>
        {rows.length === 0 ? (
          <Empty title="没有匹配的日志" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>时间</Th>
                  <Th>操作人</Th>
                  <Th>模块</Th>
                  <Th>操作</Th>
                  <Th>对象</Th>
                  <Th>详情</Th>
                </tr>
              </thead>
              <tbody>
                {paged.slice.map((a) => (
                  <Tr key={a.id}>
                    <Td className="font-num text-caption whitespace-nowrap text-ink">{fmtDateTime(a.time, true)}</Td>
                    <Td className="whitespace-nowrap text-ink">{a.operator}</Td>
                    <Td>
                      <Tag theme={MODULE_TONE[a.module] ?? 'default'}>{a.module}</Tag>
                    </Td>
                    <Td className="font-semibold whitespace-nowrap text-ink">{a.action}</Td>
                    <Td className="max-w-64 truncate text-ink">{a.target}</Td>
                    <Td className="max-w-96 truncate text-caption text-muted" >
                      <span title={a.detail}>{a.detail || '—'}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination {...paged} />
          </>
        )}
      </Card>
    </>
  )
}
