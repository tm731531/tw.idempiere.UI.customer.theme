import type { RouteRecordRaw } from 'vue-router'
import AdminCalendarPage from './views/AdminCalendarPage.vue'
import AdminPermissionsPage from './views/AdminPermissionsPage.vue'
import BookingPage from './views/BookingPage.vue'
import BPartnerPage from './views/BPartnerPage.vue'
import InOutPage from './views/InOutPage.vue'
import LoginPage from './views/LoginPage.vue'
import MomReportPage from './views/MomReportPage.vue'
import OrderPage from './views/OrderPage.vue'
import PaymentPage from './views/PaymentPage.vue'
import ProductionPage from './views/ProductionPage.vue'
import QRCodeGeneratorPage from './views/QRCodeGeneratorPage.vue'
import ReportPage from './views/ReportPage.vue'
import RequestPage from './views/RequestPage.vue'
import ScanPurchasePage from './views/ScanPurchasePage.vue'
import StockPage from './views/StockPage.vue'

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
  { path: '/mom-report', component: MomReportPage },
  { path: '/inventory', component: StockPage },
  { path: '/scan-purchase', component: ScanPurchasePage },
  { path: '/qr-generator', component: QRCodeGeneratorPage },
]
