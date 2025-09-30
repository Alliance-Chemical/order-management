import { ShipStationClient } from './client';

const FREIGHT_BOOKED = Number(process.env.FREIGHT_BOOKED_TAG_ID);
const FREIGHT_READY = Number(process.env.FREIGHT_READY_TAG_ID);

export async function markFreightBooked(orderId: number) {
  const ss = new ShipStationClient();
  await ss.addOrderTag(orderId, FREIGHT_BOOKED);
}

export async function markFreightReady(orderId: number) {
  const ss = new ShipStationClient();
  await ss.addOrderTag(orderId, FREIGHT_READY);
}

export async function clearFreightBooked(orderId: number) {
  const ss = new ShipStationClient();
  await ss.removeOrderTag(orderId, FREIGHT_BOOKED);
}
