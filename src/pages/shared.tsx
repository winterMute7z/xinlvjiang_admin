import type { LiveState, TransferStatus, ViewerStatus } from '@/lib/types'
import { Tag, type Tone } from '@/components/ui'

export function LiveTag({ state }: { state: LiveState }) {
  if (state === 'live')
    return (
      <Tag theme="success" dot>
        直播中
      </Tag>
    )
  if (state === 'replay') return <Tag theme="brand">轮播</Tag>
  return <Tag>未开播</Tag>
}

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; tone: Tone }> = {
  success: { label: '成功', tone: 'success' },
  format: { label: '格式错误', tone: 'danger' },
  alias: { label: '别名无效', tone: 'danger' },
  balance: { label: '余额不足', tone: 'warning' },
  unbound: { label: '未绑定', tone: 'warning' },
  limit: { label: '超出上限', tone: 'warning' },
  reverted: { label: '已撤销', tone: 'default' },
}

export function TransferStatusTag({ status }: { status: TransferStatus }) {
  const s = TRANSFER_STATUS[status]
  return <Tag theme={s.tone}>{s.label}</Tag>
}

export const VIEWER_STATUS: Record<ViewerStatus, { label: string; tone: Tone }> = {
  bound: { label: '已绑定', tone: 'success' },
  frozen: { label: '已冻结', tone: 'danger' },
  unbound: { label: '已解绑', tone: 'default' },
}

export function ViewerStatusTag({ status }: { status: ViewerStatus }) {
  const s = VIEWER_STATUS[status]
  return <Tag theme={s.tone}>{s.label}</Tag>
}
