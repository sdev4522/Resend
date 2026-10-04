import { api } from './client';
import {
  Contact,
  Phonebook,
  ContactPagination,
  GetContactsParams,
  CreateContactPayload,
  EditContactPayload,
  ImportContactsResult,
} from '@/types/contact';

export const contactsApi = {
  getContacts: (params?: GetContactsParams) => {
    return api.get<{
      success: boolean;
      data: Contact[];
      pagination: ContactPagination;
      msg?: string;
    }>('/api/phonebook/get_uid_contacts', { params });
  },

  getPhonebooks: (params?: { _t?: number }) => {
    return api.get<{
      success: boolean;
      data: Phonebook[];
      msg?: string;
    }>('/api/phonebook/get_by_uid', { params: { _t: Date.now(), ...params } });
  },

  createPhonebook: (name: string) => {
    return api.post<{ success: boolean; msg: string; data?: Phonebook }>('/api/phonebook/add', { name });
  },

  deletePhonebook: (id: number) => {
    return api.post<{ success: boolean; msg: string }>('/api/phonebook/del_phonebook', { id });
  },

  createContact: (payload: CreateContactPayload) => {
    return api.post<{ success: boolean; msg: string }>(
      '/api/phonebook/add_single_contact',
      payload
    );
  },

  updateContact: (payload: EditContactPayload) => {
    return api.put<{ success: boolean; msg: string }>(
      '/api/phonebook/edit_contact',
      payload
    );
  },

  deleteContacts: (selected: number[]) => {
    return api.post<{ success: boolean; msg: string }>('/api/phonebook/del_contacts', {
      selected,
    });
  },

  importContacts: (formData: FormData) => {
    return api.upload<ImportContactsResult>('/api/phonebook/import_contacts', formData);
  },

  exportContactsUrl: (params?: { search?: string; phonebook_id?: string | number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.phonebook_id) searchParams.set('phonebook_id', String(params.phonebook_id));
    const query = searchParams.toString();
    return `/api/proxy/phonebook/export_contacts_csv${query ? `?${query}` : ''}`;
  },
};
