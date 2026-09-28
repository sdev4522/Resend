export interface Contact {
  id: number;
  uid: string;
  phonebook_id: number;
  phonebook_name: string;
  name: string;
  mobile: string;
  var1?: string | null;
  var2?: string | null;
  var3?: string | null;
  var4?: string | null;
  var5?: string | null;
  createdAt?: string;
}

export interface Phonebook {
  id: number;
  name: string;
  uid: string;
  contactCount?: number;
}

export interface ContactPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetContactsParams extends Record<string, string | number | boolean | undefined> {
  page?: number;
  limit?: number;
  search?: string;
  phonebook_id?: string | number;
}

export interface CreateContactPayload {
  id: number; // phonebook_id
  phonebook_name: string;
  name: string;
  mobile: string;
  var1?: string;
  var2?: string;
  var3?: string;
  var4?: string;
  var5?: string;
}

export interface EditContactPayload {
  contactId: number;
  name: string;
  mobile: string;
  var1?: string;
  var2?: string;
  var3?: string;
  var4?: string;
  var5?: string;
}

export interface ImportContactsResult {
  success: boolean;
  msg: string;
  inserted?: number;
  invalidNumbers?: Array<{
    row: number;
    name: string;
    mobile: string;
  }>;
}
