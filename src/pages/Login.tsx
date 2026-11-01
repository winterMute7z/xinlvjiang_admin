import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, ShieldCheck, User } from 'lucide-react'
import { Button, Field, TextInput } from '@/components/ui'
import { GUILD_NAME } from '@/lib/seed'

const DEMO_ACCOUNTS: Record<string, string> = { admin: '超级管理员', lin: '运营 小林', jie: '数据 阿杰' }

export function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [account, setAccount] = useState('admin')
  const [password, setPassword] = useState('demo1234')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!DEMO_ACCOUNTS[account.trim()]) return setError('账号不存在，可使用 admin / lin / jie')
    if (password.length < 6) return setError('密码至少 6 位')
    setError(null)
    setLoading(true)
    setTimeout(() => onLogin(DEMO_ACCOUNTS[account.trim()]), 500)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page p-6">
      <div aria-hidden className="soft-orb absolute -top-40 -left-32 size-[460px] opacity-25" />
      <div aria-hidden className="soft-orb absolute -right-24 -bottom-44 size-[380px] opacity-20" />
      <div className="relative grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-[28px] bg-card shadow-surface md:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand to-brand-deep p-10 text-highlight md:flex">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full bg-highlight/25 ring-1 ring-highlight/40" aria-label={`${GUILD_NAME} Logo 图片占位`} role="img" />
            <span className="text-section font-bold">{GUILD_NAME} · 管理后台</span>
          </div>
          <div>
            <div className="text-micro font-bold tracking-widest text-highlight/75">{GUILD_NAME}公会</div>
            <div className="mt-2 text-[28px] leading-tight font-extrabold">斗鱼直播数据<br />与观众温度值运营中心</div>
            <ul className="mt-6 space-y-2.5 text-body text-highlight/85">
              {['主播、别名与直播间配置', '斗鱼账号绑定与申诉审核', '温度值账户、转分命令与撤销', '赛季周期与全量数据报表'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-micro text-highlight/70">所有数据均为虚构演示值，不连接斗鱼或微信身份</div>
        </div>
        <form onSubmit={submit} className="flex flex-col justify-center gap-5 p-10">
          <div>
            <div className="text-micro font-bold tracking-widest text-brand-ink">管理员登录</div>
            <h1 className="mt-1 text-title font-extrabold text-ink">欢迎回来</h1>
            <p className="mt-1 text-caption text-muted">演示账号：admin / lin / jie，密码任意 6 位以上</p>
          </div>
          <Field label="登录账号" required>
            {(id) => <TextInput id={id} prefix={<User className="size-4" />} value={account} onChange={(e) => setAccount(e.target.value)} autoComplete="username" invalid={!!error && error.includes('账号')} />}
          </Field>
          <Field label="密码" required error={error}>
            {(id) => (
              <TextInput
                id={id}
                type={show ? 'text' : 'password'}
                prefix={<KeyRound className="size-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                invalid={!!error && error.includes('密码')}
                suffix={
                  <button type="button" onClick={() => setShow(!show)} aria-label={show ? '隐藏密码' : '显示密码'} className="flex cursor-pointer items-center text-muted hover:text-ink">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
            )}
          </Field>
          <Button type="submit" size="large" block loading={loading}>
            登录
          </Button>
        </form>
      </div>
    </div>
  )
}
