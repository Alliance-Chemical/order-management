import { redirect } from 'next/navigation';

export default function BookingReadyPage() {
  redirect('/freight-orders?tab=ready');
}
