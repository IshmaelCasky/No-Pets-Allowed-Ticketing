import { auditRouter } from "./router/audit";
import { authRouter } from "./router/auth";
import { dashboardRouter } from "./router/dashboard";
import { eventRouter } from "./router/event";
import { orderRouter } from "./router/order";
import { refundRouter } from "./router/refund";
import { roleRouter } from "./router/role";
import { scanRouter } from "./router/scan";
import { seatMapRouter } from "./router/seat-map";
import { setupRouter } from "./router/setup";
import { ticketRouter } from "./router/ticket";
import { userRouter } from "./router/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  setup: setupRouter,
  event: eventRouter,
  seatMap: seatMapRouter,
  order: orderRouter,
  refund: refundRouter,
  ticket: ticketRouter,
  scan: scanRouter,
  user: userRouter,
  role: roleRouter,
  audit: auditRouter,
  dashboard: dashboardRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
