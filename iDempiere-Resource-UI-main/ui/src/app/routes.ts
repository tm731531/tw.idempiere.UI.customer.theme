import type { RouteRecordRaw } from 'vue-router'
import AdminCalendarPage from './views/AdminCalendarPage.vue'
import AdminPermissionsPage from './views/AdminPermissionsPage.vue'
import BookingPage from './views/BookingPage.vue'
import BPartnerPage from './views/BPartnerPage.vue'
import InOutPage from './views/InOutPage.vue'
import LoginPage from './views/LoginPage.vue'
import OrderPage from './views/OrderPage.vue'
import PaymentPage from './views/PaymentPage.vue'
import ProductionPage from './views/ProductionPage.vue'
import ReportPage from './views/ReportPage.vue'
import RequestPage from './views/RequestPage.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginPage },
  { path: '/book', component: BookingPage },
  { path: '/request', component: RequestPage },
  { path: '/admin/calendar', component: AdminCalendarPage },
  { path: '/admin/permissions', component: AdminPermissionsPage },
  { path: '/bpartner', component: BPartnerPage },
  { path: '/receipt', component: InOutPage },
  { path: '/sales-order', component: OrderPage },
  { path: '/purchase-order', component: OrderPage },
  { path: '/payment', component: PaymentPage },
  { path: '/production', component: ProductionPage },
  { path: '/report', component: ReportPage },
]
