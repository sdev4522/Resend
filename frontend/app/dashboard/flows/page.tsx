import { redirect } from 'next/navigation';

// Flows and chatbot rules were the same list; keep old links working.
export default function FlowsPage() {
  redirect('/dashboard/automation');
}
