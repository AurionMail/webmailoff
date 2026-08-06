import { ContactsApp } from "@/components/contacts/contacts-app";

// Contact permalinks (#733): /contacts/<contactId>[/edit], plus /contacts/new
// for the "add this sender" flow. The older query form (?contactId=, ?addEmail=)
// still works - see parseContactsPath.
export default async function ContactsRoute({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments } = await params;
  return <ContactsApp linkSegments={segments ?? []} />;
}
