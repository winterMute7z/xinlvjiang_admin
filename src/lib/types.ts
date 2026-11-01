export type LiveState = 'live' | 'replay' | 'offline'

export type TeamId = 'red' | 'yellow' | 'blue' | 'green'

export interface TeamConfig {
  id: TeamId
  name: string
  color: string
}

export interface Host {
  hostUid: string
  /** 用于绑定时匹配斗鱼账号身份 */
  douyuUid: string
  hostName: string
  roomId: string
  /** 所属公会；本公会为 GUILD_NAME */
  guildName: string
  /** 是否参加当前赛季（与公会无关，可包含其他公会主播） */
  inSeason: boolean
  /** 当前赛季队伍；未参赛主播不设置 */
  teamId?: TeamId
  /** 是否为该队队长；列表只显示“队长”，颜色取队伍颜色 */
  isCaptain?: boolean
  aliases: string[]
  liveState: LiveState
  enabled: boolean
  collect: boolean
  joinedAt: string
  note: string
  todayAmount: number
  todayDanmu: number
  todayGivers: number
  seasonAmount: number
  /** 当前温度值 = 观众转入 − 已消费 − 撤销扣回；主播收到礼物不产生温度值 */
  currentPoints: number
  trend: number[]
}

export type ViewerStatus = 'bound' | 'frozen' | 'unbound'
export type HostBindingReviewStatus = 'not_required' | 'pending' | 'approved' | 'rejected'

export interface Viewer {
  douyuUid: string
  douyuName: string
  openId: string
  wechatName: string
  status: ViewerStatus
  /** 当前赛季参赛主播绑定需后台审核；非参赛账号为 not_required */
  hostBindingReview: HostBindingReviewStatus
  hostBindingReviewAt?: string
  hostBindingReviewNote?: string
  boundAt: string
  balance: number
  totalEarned: number
  totalTransferred: number
  lastActive: string
}

export type BindCodeStatus = 'waiting' | 'success' | 'expired' | 'cancelled'

export interface BindCode {
  code: string
  openId: string
  createdAt: string
  expiresAt: string
  status: BindCodeStatus
  douyuUid?: string
}

export type AppealType = 'switch' | 'unbind' | 'points'
export type AppealStatus = 'pending' | 'approved' | 'rejected'

export interface Appeal {
  id: string
  type: AppealType
  openId: string
  douyuUid: string
  douyuName: string
  content: string
  createdAt: string
  status: AppealStatus
  reply?: string
  handledAt?: string
}

export type TransferStatus = 'success' | 'format' | 'alias' | 'balance' | 'unbound' | 'limit' | 'reverted'

export interface Transfer {
  id: string
  time: string
  senderUid: string
  senderName: string
  roomHostUid: string
  raw: string
  alias?: string
  targetHostUid?: string
  amount?: number
  status: TransferStatus
  danmuEventId: string
  /** 按规则生成的 BOT 回复；真实接口发送由服务端完成 */
  botReply?: string
}

export type LedgerType = 'gift' | 'transfer' | 'adjust' | 'revert' | 'reset'

export interface Ledger {
  id: string
  uid: string
  type: LedgerType
  delta: number
  title: string
  detail: string
  relatedId: string
  time: string
  operator?: string
}

/** 主播温度值变动：观众转入增加；吃饭、购物等消费或转分撤销会扣减 */
export type HostPointsKind = 'in' | 'spend' | 'revert'

export interface HostPointsChange {
  id: string
  hostUid: string
  kind: HostPointsKind
  delta: number
  /** 变动后的温度值余额 */
  balance: number
  title: string
  detail: string
  relatedId: string
  time: string
}

export type SeasonStatus = 'active' | 'scheduled' | 'ended'

export interface Season {
  id: string
  name: string
  startAt: string
  endAt?: string
  resetPoints: boolean
  note: string
}

export interface Rules {
  pointsPerYuan: number
  commandPrefix: string
  allowNoHash: boolean
  minTransfer: number
  maxTransferPerCmd: number
  dailyTransferLimit: number
  bindCodeTTL: number
  /** 观众完成绑定前必须存在一笔达到该金额的单次礼物；按单笔事件判断，不累计 */
  bindMinSingleGiftAmount: number
  bindRoomHostUid: string
  dedupeGift: boolean
  freeGiftCounts: boolean
  discountGiftPolicy: 'paid' | 'original' | 'pending'
  aliasMaxLength: number
  publicGuest: boolean
  /** 成功/失败转分后是否生成 BOT 回复 */
  botReplyEnabled: boolean
  /** BOT 回复模板，支持 {观众}、{主播}、{温度值}、{当前温度值}、{原因} */
  botSuccessReply: string
  botFailureReply: string
  /** 斗鱼房间弹幕接入接口地址；签名参数由服务端生成 */
  botApiEndpoint: string
}

export interface GiftEvent {
  giftEventId: string
  senderUid: string
  senderName: string
  hostUid: string
  giftName: string
  quantity: number
  amount: number
  time: string
}

export interface Danmu {
  danmuEventId: string
  senderUid: string
  senderName: string
  hostUid: string
  text: string
  time: string
}

export type Role = 'owner' | 'operator' | 'viewer'

export interface Admin {
  id: string
  name: string
  account: string
  role: Role
  enabled: boolean
  lastLogin: string
}

export interface AuditEntry {
  id: string
  time: string
  operator: string
  module: string
  action: string
  target: string
  detail: string
}

export interface CollectorStatus {
  hostUid: string
  state: 'ok' | 'delay' | 'down'
  latencyMs: number
  lastMessage: string
}

export interface ShopProduct {
  id: string
  name: string
  /** 商品主图地址，可填写图片 URL 或小程序可访问的资源地址 */
  image?: string
  description: string
  price: number
  /** null 表示不限库存 */
  stock: number | null
  /** 虚拟商品使用动态二维码核销，实体商品使用收货地址 */
  fulfillment: 'physical' | 'virtual'
  /** 主播道具：观众购买后需要选择主播赠送 */
  isHostProp: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type ShopPurchaseStatus = 'paid' | 'used' | 'cancelled'

export interface ShopPurchase {
  id: string
  productId: string
  productName: string
  buyerUid: string
  buyerName: string
  quantity: number
  amount: number
  fulfillment?: 'physical' | 'virtual'
  /** 6 位数字核销码；虚拟商品同时生成动态二维码 */
  redemptionCode?: string
  shippingAddress?: string
  status: ShopPurchaseStatus
  purchasedAt: string
  usedAt?: string
  note?: string
}

export interface ShopUsage {
  id: string
  purchaseId: string
  productId: string
  productName: string
  buyerUid: string
  buyerName: string
  quantity: number
  usedAt: string
  operator: string
  redemptionCode?: string
  shippingAddress?: string
  note?: string
}

export interface DbState {
  version: number
  hosts: Host[]
  viewers: Viewer[]
  bindCodes: BindCode[]
  appeals: Appeal[]
  transfers: Transfer[]
  ledger: Ledger[]
  hostPoints: HostPointsChange[]
  seasons: Season[]
  teams: TeamConfig[]
  rules: Rules
  gifts: GiftEvent[]
  danmu: Danmu[]
  admins: Admin[]
  audit: AuditEntry[]
  collectors: CollectorStatus[]
  products: ShopProduct[]
  shopPurchases: ShopPurchase[]
  shopUsages: ShopUsage[]
}
