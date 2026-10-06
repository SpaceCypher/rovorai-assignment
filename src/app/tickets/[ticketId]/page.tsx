import { TicketView } from '@/features/tickets/components/ticket-view'

export default async function TicketPage({ params }: PageProps<'/tickets/[ticketId]'>) {
  const { ticketId } = await params
  return <TicketView ticketId={ticketId} />
}
