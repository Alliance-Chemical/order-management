import { documents } from '@/lib/db/schema/qr-workspace'

export type DocumentInsert = Omit<typeof documents.$inferInsert, 'documentName'> & {
  documentName: string
}
