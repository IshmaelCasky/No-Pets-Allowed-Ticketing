import { auditRouter } from "./router/audit";
import { authRouter } from "./router/auth";
import { dashboardRouter } from "./router/dashboard";
import { eventRouter } from "./router/event";
import { orderRouter } from "./router/order";
import { paymentMethodRouter } from "./router/payment-method";
import { refundRouter } from "./router/refund";
import { reviewRouter } from "./router/review";
import { roleRouter } from "./router/role";
import { scanRouter } from "./router/scan";
import { seatMapRouter } from "./router/seat-map";
import { ticketRouter } from "./router/ticket";
import { userRouter } from "./router/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  event: eventRouter,
  seatMap: seatMapRouter,
  order: orderRouter,
  review: reviewRouter,
  refund: refundRouter,
  ticket: ticketRouter,
  scan: scanRouter,
  paymentMethod: paymentMethodRouter,
  user: userRouter,
  role: roleRouter,
  audit: auditRouter,
  dashboard: dashboardRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
