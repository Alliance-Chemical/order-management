import { string, z } from "zod";

export const optsSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(1, {
      message: "Order number must be at least 1 character long",
    })
    .max(25, {
      message: "Order number must be at most 25 characters long",
    }),
  orderStatus: z.union([
    z.literal("awaiting_payment"),
    z.literal("awaiting_shipment"),
    z.literal("pending_fulfillment"),
    z.literal("shipped"),
    z.literal("on_hold"),
    z.literal("cancelled"),
    z.literal("rejected_fulfillment"),
  ]),
});

export const authSchema = z.object({
  data: z.object({
    access_token: z.string(),
    expires_in: z.number().optional(),
    scope: string().optional(),
    token_type: string().optional(),
  }),
});
