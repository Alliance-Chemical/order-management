import { ShipStationClient } from './client';

const FREIGHT_STAGED = Number(process.env.FREIGHT_STAGED_TAG_ID);
const FREIGHT_READY = Number(process.env.FREIGHT_READY_TAG_ID);

export async function markFreightStaged(orderId: number) {
  const ss = new ShipStationClient();
  await ss.addOrderTag(orderId, FREIGHT_STAGED);
}

export async function markFreightReady(orderId: number) {
  const ss = new ShipStationClient();
  await ss.addOrderTag(orderId, FREIGHT_READY);
}

export async function clearFreightStaged(orderId: number) {
  const ss = new ShipStationClient();
  await ss.removeOrderTag(orderId, FREIGHT_STAGED);
}