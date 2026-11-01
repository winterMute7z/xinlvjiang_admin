import { useEffect, useState } from 'react'
import { DbProvider } from '@/lib/store'
import { useRoute, type RouteKey } from '@/lib/router'
import { Layout } from '@/components/Layout'
import { ToastProvider } from '@/components/ui'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Hosts } from '@/pages/Hosts'
import { Aliases } from '@/pages/Aliases'
import { Bindings } from '@/pages/Bindings'
import { Points } from '@/pages/Points'
import { Transfers } from '@/pages/Transfers'
import { Shop } from '@/pages/Shop'
import { Season } from '@/pages/Season'
import { DataCenter } from '@/pages/DataCenter'
import { Settings } from '@/pages/Settings'
import { AuditLog } from '@/pages/AuditLog'

const PAGES: Record<RouteKey, { title: string; el: () => React.JSX.Element }> = {
  dashboard: { title: '数据总览', el: Dashboard },
  hosts: { title: '主播管理', el: Hosts },
  aliases: { title: '别名管理', el: Aliases },
  bindings: { title: '绑定管理', el: Bindings },
  points: { title: '温度值账户', el: Points },
  transfers: { title: '转分记录', el: Transfers },
  shop: { title: '商店管理', el: Shop },
  season: { title: '赛季设置', el: Season },
  data: { title: '数据中心', el: DataCenter },
  settings: { title: '规则配置', el: Settings },
  audit: { title: '操作日志', el: AuditLog },
}

const SESSION_KEY = 'xlj-admin-operator'

export default function App() {
  const [operator, setOperator] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY))
  const { path, navigate } = useRoute()
  const page = PAGES[path] ?? PAGES.dashboard
  const routeKey = (PAGES[path] ? path : 'dashboard') as RouteKey

  useEffect(() => {
    document.title = operator ? `${page.title} · 管理后台` : '登录 · 管理后台'
  }, [page, operator])

  return (
    <ToastProvider>
      {!operator ? (
        <Login
          onLogin={(name) => {
            sessionStorage.setItem(SESSION_KEY, name)
            setOperator(name)
          }}
        />
      ) : (
        <DbProvider operator={operator}>
          <Layout
            route={routeKey}
            onNavigate={navigate}
            onLogout={() => {
              sessionStorage.removeItem(SESSION_KEY)
              setOperator(null)
            }}
          >
            <page.el />
          </Layout>
        </DbProvider>
      )}
    </ToastProvider>
  )
}
