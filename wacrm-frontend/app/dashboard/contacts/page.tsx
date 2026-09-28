'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { contactsApi } from '@/lib/api/contacts';
import { Contact, Phonebook, ContactPagination } from '@/types/contact';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit2,
  Upload,
  Download,
  BookOpen,
  FolderPlus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Tag,
} from 'lucide-react';

export default function ContactsPage() {
  // Data State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [phonebooks, setPhonebooks] = useState<Phonebook[]>([]);
  const [pagination, setPagination] = useState<ContactPagination>({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });

  // Filters State
  const [selectedPhonebookId, setSelectedPhonebookId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Dialog States
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [addPhonebookOpen, setAddPhonebookOpen] = useState(false);
  const [importCsvOpen, setImportCsvOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [phonebookToDelete, setPhonebookToDelete] = useState<Phonebook | null>(null);

  // Form State: Add Single Contact
  const [newContact, setNewContact] = useState({
    phonebook_id: '',
    name: '',
    mobile: '',
    var1: '',
    var2: '',
    var3: '',
    var4: '',
    var5: '',
  });

  // Form State: Edit Contact
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form State: New Phonebook
  const [newPhonebookName, setNewPhonebookName] = useState('');

  // Form State: Import CSV
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPhonebookId, setImportPhonebookId] = useState('');
  const [importResult, setImportResult] = useState<{
    inserted?: number;
    invalidNumbers?: Array<{ row: number; name: string; mobile: string }>;
  } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Phonebooks
  const loadPhonebooks = useCallback(async () => {
    try {
      const res = await contactsApi.getPhonebooks();
      if (res && res.success && Array.isArray(res.data)) {
        setPhonebooks(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load phonebooks:', err);
    }
  }, []);

  // Load Contacts with Pagination & Filter
  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (selectedPhonebookId && selectedPhonebookId !== 'ALL') {
        params.phonebook_id = selectedPhonebookId;
      }

      const res = await contactsApi.getContacts(params);

      if (res && res.success) {
        setContacts(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setErrorMessage(res?.msg || 'Failed to load contacts');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with contacts API');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, selectedPhonebookId]);

  useEffect(() => {
    loadPhonebooks();
  }, [loadPhonebooks]);

  useEffect(() => {
    loadContacts();
    setSelectedIds([]);
  }, [loadContacts]);

  // Checkbox selection helpers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(contacts.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // Create Phonebook Group
  const handleCreatePhonebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhonebookName.trim()) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);
      const res = await contactsApi.createPhonebook(newPhonebookName.trim());
      if (res && res.success) {
        setSuccessMessage('Phonebook group created successfully.');
        setNewPhonebookName('');
        setAddPhonebookOpen(false);
        loadPhonebooks();
      } else {
        setErrorMessage(res?.msg || 'Failed to create phonebook');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating phonebook');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Phonebook Group
  const handleDeletePhonebook = async () => {
    if (!phonebookToDelete) return;
    try {
      setActionLoading(true);
      setErrorMessage(null);
      const res = await contactsApi.deletePhonebook(phonebookToDelete.id);
      if (res && res.success) {
        setSuccessMessage(`Phonebook "${phonebookToDelete.name}" deleted.`);
        setPhonebookToDelete(null);
        if (selectedPhonebookId === String(phonebookToDelete.id)) {
          setSelectedPhonebookId('ALL');
        }
        loadPhonebooks();
        loadContacts();
      } else {
        setErrorMessage(res?.msg || 'Failed to delete phonebook');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting phonebook');
    } finally {
      setActionLoading(false);
    }
  };

  // Add Single Contact
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.phonebook_id || !newContact.mobile) {
      setErrorMessage('Please select a phonebook and enter a mobile number.');
      return;
    }

    const pb = phonebooks.find((p) => String(p.id) === String(newContact.phonebook_id));

    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await contactsApi.createContact({
        id: Number(newContact.phonebook_id),
        phonebook_name: pb ? pb.name : 'Default',
        name: newContact.name.trim(),
        mobile: newContact.mobile.trim(),
        var1: newContact.var1.trim() || undefined,
        var2: newContact.var2.trim() || undefined,
        var3: newContact.var3.trim() || undefined,
        var4: newContact.var4.trim() || undefined,
        var5: newContact.var5.trim() || undefined,
      });

      if (res && res.success) {
        setSuccessMessage('Contact added successfully.');
        setAddContactOpen(false);
        setNewContact({
          phonebook_id: '',
          name: '',
          mobile: '',
          var1: '',
          var2: '',
          var3: '',
          var4: '',
          var5: '',
        });
        loadPhonebooks();
        loadContacts();
      } else {
        setErrorMessage(res?.msg || 'Failed to add contact');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error adding contact');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Contact
  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await contactsApi.updateContact({
        contactId: editingContact.id,
        name: editingContact.name,
        mobile: editingContact.mobile,
        var1: editingContact.var1 || undefined,
        var2: editingContact.var2 || undefined,
        var3: editingContact.var3 || undefined,
        var4: editingContact.var4 || undefined,
        var5: editingContact.var5 || undefined,
      });

      if (res && res.success) {
        setSuccessMessage('Contact updated successfully.');
        setEditContactOpen(false);
        setEditingContact(null);
        loadContacts();
      } else {
        setErrorMessage(res?.msg || 'Failed to update contact');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating contact');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Single or Bulk Contacts
  const handleDeleteContacts = async () => {
    const idsToDelete = contactToDelete ? [contactToDelete.id] : selectedIds;
    if (idsToDelete.length === 0) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);

      const res = await contactsApi.deleteContacts(idsToDelete);
      if (res && res.success) {
        setSuccessMessage(`${idsToDelete.length} contact(s) deleted.`);
        setContactToDelete(null);
        setSelectedIds([]);
        setDeleteConfirmOpen(false);
        loadPhonebooks();
        loadContacts();
      } else {
        setErrorMessage(res?.msg || 'Failed to delete contacts');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting contacts');
    } finally {
      setActionLoading(false);
    }
  };

  // Import CSV
  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !importPhonebookId) {
      setErrorMessage('Please choose a CSV file and select a target phonebook.');
      return;
    }

    const pb = phonebooks.find((p) => String(p.id) === String(importPhonebookId));

    try {
      setActionLoading(true);
      setErrorMessage(null);
      setImportResult(null);

      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('id', importPhonebookId);
      formData.append('phonebook_name', pb ? pb.name : 'Default');

      const res = await contactsApi.importContacts(formData);

      if (res && res.success) {
        setImportResult({ inserted: res.inserted || 0 });
        setSuccessMessage(`Successfully imported ${res.inserted || 0} contacts!`);
        loadPhonebooks();
        loadContacts();
      } else {
        if (res?.invalidNumbers && res.invalidNumbers.length > 0) {
          setImportResult({ invalidNumbers: res.invalidNumbers });
        }
        setErrorMessage(res?.msg || 'CSV import failed. Please verify the file format.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error during CSV upload.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <DashboardPageHeader
        title="Contacts & Phonebooks"
        description="Manage segmented contact lists, customer tags, and custom campaign variables."
        breadcrumbs={[{ title: 'Contacts' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportResult(null);
                setImportFile(null);
                setImportPhonebookId(phonebooks[0]?.id ? String(phonebooks[0].id) : '');
                setImportCsvOpen(true);
              }}
              className="gap-1.5 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import CSV</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = contactsApi.exportContactsUrl({
                  search: debouncedSearch,
                  phonebook_id: selectedPhonebookId !== 'ALL' ? selectedPhonebookId : undefined,
                });
                window.open(url, '_blank');
              }}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setNewContact({
                  phonebook_id: phonebooks[0]?.id ? String(phonebooks[0].id) : '',
                  name: '',
                  mobile: '',
                  var1: '',
                  var2: '',
                  var3: '',
                  var4: '',
                  var5: '',
                });
                setAddContactOpen(true);
              }}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Contact</span>
            </Button>
          </div>
        }
      />

      {/* Notifications */}
      {errorMessage && (
        <Alert variant="destructive" className="py-2.5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">Error Notice</AlertTitle>
          <AlertDescription className="text-xs mt-0.5">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="py-2.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-xs font-semibold">Success</AlertTitle>
          <AlertDescription className="text-xs mt-0.5">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Mobile Phonebook Strip (Visible on < lg) */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
        <button
          type="button"
          onClick={() => {
            setSelectedPhonebookId('ALL');
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
            selectedPhonebookId === 'ALL'
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-3 w-3" />
          <span>All</span>
          <span className="text-[10px] opacity-80">
            ({phonebooks.reduce((acc, curr) => acc + (curr.contactCount || 0), 0)})
          </span>
        </button>

        {phonebooks.map((pb) => (
          <button
            key={pb.id}
            type="button"
            onClick={() => {
              setSelectedPhonebookId(String(pb.id));
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
              selectedPhonebookId === String(pb.id)
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-3 w-3" />
            <span>{pb.name}</span>
            <span className="text-[10px] opacity-80">({pb.contactCount || 0})</span>
          </button>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddPhonebookOpen(true)}
          className="shrink-0 h-7 px-2.5 rounded-full text-xs gap-1 text-primary touch-manipulation"
          title="Create Phonebook Group"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          <span>New List</span>
        </Button>
      </div>

      {/* Main Layout: Phonebook Filter + Contacts Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Phonebook Groups Filter (Desktop only) */}
        <Card className="hidden lg:block lg:col-span-3 shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Phonebook Lists</CardTitle>
              <CardDescription className="text-xs">
                Audience segments
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAddPhonebookOpen(true)}
              className="h-7 w-7 text-primary"
              title="Create Phonebook Group"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5 px-3">
            <button
              onClick={() => {
                setSelectedPhonebookId('ALL');
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedPhonebookId === 'ALL'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                <span>All Contacts</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  selectedPhonebookId === 'ALL'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {phonebooks.reduce((acc, curr) => acc + (curr.contactCount || 0), 0)}
              </span>
            </button>

            {phonebooks.map((pb) => (
              <div
                key={pb.id}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedPhonebookId === String(pb.id)
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                onClick={() => {
                  setSelectedPhonebookId(String(pb.id));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{pb.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      selectedPhonebookId === String(pb.id)
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {pb.contactCount || 0}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhonebookToDelete(pb);
                    }}
                    className={`h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ${
                      selectedPhonebookId === String(pb.id)
                        ? 'text-primary-foreground hover:bg-primary-foreground/20'
                        : 'text-destructive hover:bg-destructive/10'
                    }`}
                    title="Delete Phonebook"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right Column: Contacts Table & Toolbar */}
        <div className="lg:col-span-9 space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name or mobile number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>

                {/* Bulk Actions Bar */}
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2 animate-in fade-in duration-200">
                    <span className="text-xs font-medium text-muted-foreground">
                      {selectedIds.length} selected
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setContactToDelete(null);
                        setDeleteConfirmOpen(true);
                      }}
                      className="gap-1 text-xs h-8"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Selected</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs">Loading contacts...</p>
                </div>
              ) : contacts.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No contacts found</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {debouncedSearch
                      ? `No contacts match query "${debouncedSearch}".`
                      : 'Add single contacts or import audience from a CSV file to get started.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Contact Cards (md:hidden) */}
                  <div className="md:hidden divide-y divide-border">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              className="rounded border-border h-4 w-4"
                              checked={selectedIds.includes(contact.id)}
                              onChange={(e) => handleSelectRow(contact.id, e.target.checked)}
                            />
                            <div>
                              <div className="font-semibold text-foreground text-sm">
                                {contact.name || <span className="text-muted-foreground italic">No Name</span>}
                              </div>
                              <a href={`tel:${contact.mobile}`} className="font-mono text-xs text-primary hover:underline">
                                {contact.mobile}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingContact(contact);
                                setEditContactOpen(true);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground touch-manipulation"
                              title="Edit Contact"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setContactToDelete(contact);
                                setDeleteConfirmOpen(true);
                              }}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 touch-manipulation"
                              title="Delete Contact"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                            <BookOpen className="h-3 w-3" />
                            <span>{contact.phonebook_name || 'General'}</span>
                          </span>
                          {contact.var1 && (
                            <span className="px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground font-mono text-[10px]">
                              v1: {contact.var1}
                            </span>
                          )}
                          {contact.var2 && (
                            <span className="px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground font-mono text-[10px]">
                              v2: {contact.var2}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (hidden md:block) */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs bg-muted/40">
                          <TableHead className="w-10 text-center">
                            <input
                              type="checkbox"
                              className="rounded border-border"
                              checked={
                                contacts.length > 0 && selectedIds.length === contacts.length
                              }
                              onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                          </TableHead>
                          <TableHead className="font-semibold">Contact Name</TableHead>
                          <TableHead className="font-semibold">Mobile Number</TableHead>
                          <TableHead className="font-semibold">Phonebook</TableHead>
                          <TableHead className="font-semibold">Variables</TableHead>
                          <TableHead className="text-right font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((contact) => (
                          <TableRow key={contact.id} className="text-xs hover:bg-muted/30">
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                className="rounded border-border"
                                checked={selectedIds.includes(contact.id)}
                                onChange={(e) => handleSelectRow(contact.id, e.target.checked)}
                              />
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {contact.name || <span className="text-muted-foreground italic">No Name</span>}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {contact.mobile}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground font-medium">
                                <BookOpen className="h-3 w-3" />
                                <span>{contact.phonebook_name || 'General'}</span>
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                {contact.var1 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground font-mono">
                                    v1: {contact.var1}
                                  </span>
                                )}
                                {contact.var2 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground font-mono">
                                    v2: {contact.var2}
                                  </span>
                                )}
                                {!contact.var1 && !contact.var2 && (
                                  <span className="text-[11px] text-muted-foreground/60">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingContact(contact);
                                    setEditContactOpen(true);
                                  }}
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  title="Edit Contact"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setContactToDelete(contact);
                                    setDeleteConfirmOpen(true);
                                  }}
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  title="Delete Contact"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t text-xs text-muted-foreground">
                  <span>
                    Showing {contacts.length} of {pagination.total} contacts
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                      }
                      className="h-8 px-2.5 gap-1 text-xs touch-manipulation"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Prev
                    </Button>
                    <span>
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                      }
                      className="h-8 px-2.5 gap-1 text-xs touch-manipulation"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: Create Phonebook Group */}
      <Dialog open={addPhonebookOpen} onOpenChange={setAddPhonebookOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">New Phonebook Group</DialogTitle>
            <DialogDescription className="text-xs">
              Organize contacts into distinct audience lists for targeted campaigns.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePhonebook} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="pb-name" className="text-xs">Phonebook Name *</Label>
              <Input
                id="pb-name"
                placeholder="e.g. VIP Customers, Leads Sept 2026"
                value={newPhonebookName}
                onChange={(e) => setNewPhonebookName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddPhonebookOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="gap-1.5">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Create Group</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Single Contact */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add New Contact</DialogTitle>
            <DialogDescription className="text-xs">
              Add individual contact with optional custom attributes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateContact} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Phonebook Group *</Label>
              <Select
                value={newContact.phonebook_id}
                onValueChange={(val) => setNewContact((prev) => ({ ...prev, phonebook_id: val || '' }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Phonebook" />
                </SelectTrigger>
                <SelectContent>
                  {phonebooks.map((pb) => (
                    <SelectItem key={pb.id} value={String(pb.id)}>
                      {pb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name</Label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={newContact.name}
                  onChange={(e) => setNewContact((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mobile Number (with Country Code) *</Label>
                <Input
                  placeholder="e.g. 919876543210"
                  value={newContact.mobile}
                  onChange={(e) => setNewContact((prev) => ({ ...prev, mobile: e.target.value }))}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* Custom Variables Section */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Tag className="h-3.5 w-3.5 text-primary" />
                <span>Custom Variables (Optional for Campaign Personalization)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] font-mono">var1 (e.g. Order ID)</Label>
                  <Input
                    placeholder="ORD-9912"
                    value={newContact.var1}
                    onChange={(e) => setNewContact((prev) => ({ ...prev, var1: e.target.value }))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-mono">var2 (e.g. Date / Amount)</Label>
                  <Input
                    placeholder="25 September"
                    value={newContact.var2}
                    onChange={(e) => setNewContact((prev) => ({ ...prev, var2: e.target.value }))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-mono">var3</Label>
                  <Input
                    placeholder="Optional"
                    value={newContact.var3}
                    onChange={(e) => setNewContact((prev) => ({ ...prev, var3: e.target.value }))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-mono">var4</Label>
                  <Input
                    placeholder="Optional"
                    value={newContact.var4}
                    onChange={(e) => setNewContact((prev) => ({ ...prev, var4: e.target.value }))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddContactOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="gap-1.5">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Contact</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Contact */}
      <Dialog open={editContactOpen} onOpenChange={setEditContactOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Edit Contact</DialogTitle>
            <DialogDescription className="text-xs">
              Update contact information and personalization variables.
            </DialogDescription>
          </DialogHeader>
          {editingContact && (
            <form onSubmit={handleUpdateContact} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Contact Name</Label>
                  <Input
                    value={editingContact.name || ''}
                    onChange={(e) =>
                      setEditingContact((prev: any) => ({ ...prev, name: e.target.value }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mobile Number *</Label>
                  <Input
                    value={editingContact.mobile}
                    onChange={(e) =>
                      setEditingContact((prev: any) => ({ ...prev, mobile: e.target.value }))
                    }
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                <div className="text-xs font-semibold text-foreground">Custom Variables</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-mono">var1</Label>
                    <Input
                      value={editingContact.var1 || ''}
                      onChange={(e) =>
                        setEditingContact((prev: any) => ({ ...prev, var1: e.target.value }))
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-mono">var2</Label>
                    <Input
                      value={editingContact.var2 || ''}
                      onChange={(e) =>
                        setEditingContact((prev: any) => ({ ...prev, var2: e.target.value }))
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-mono">var3</Label>
                    <Input
                      value={editingContact.var3 || ''}
                      onChange={(e) =>
                        setEditingContact((prev: any) => ({ ...prev, var3: e.target.value }))
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-mono">var4</Label>
                    <Input
                      value={editingContact.var4 || ''}
                      onChange={(e) =>
                        setEditingContact((prev: any) => ({ ...prev, var4: e.target.value }))
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditContactOpen(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={actionLoading} className="gap-1.5">
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Import CSV */}
      <Dialog open={importCsvOpen} onOpenChange={setImportCsvOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Import Contacts from CSV</DialogTitle>
            <DialogDescription className="text-xs">
              Upload a standard comma-separated file to import multiple recipients into a phonebook.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImportCsv} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Target Phonebook *</Label>
              <Select
                value={importPhonebookId}
                onValueChange={(val) => setImportPhonebookId(val || '')}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Phonebook" />
                </SelectTrigger>
                <SelectContent>
                  {phonebooks.map((pb) => (
                    <SelectItem key={pb.id} value={String(pb.id)}>
                      {pb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">CSV File *</Label>
              <div className="border border-dashed rounded-lg p-6 text-center hover:bg-muted/20 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  id="csv-file-input"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-xs font-medium text-foreground">
                    {importFile ? importFile.name : 'Click to select .csv file'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Supported columns: <code className="font-mono">name, mobile, var1, var2, var3, var4, var5</code>
                  </p>
                </label>
              </div>
            </div>

            {/* Import Feedback / Invalid numbers */}
            {importResult?.invalidNumbers && importResult.invalidNumbers.length > 0 && (
              <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs space-y-2">
                <p className="font-semibold text-destructive">
                  {importResult.invalidNumbers.length} Invalid Phone Numbers Detected
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px]">
                  {importResult.invalidNumbers.map((inv, idx) => (
                    <div key={idx} className="text-destructive/90">
                      Row {inv.row}: &ldquo;{inv.mobile}&rdquo; ({inv.name || 'Unnamed'})
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportCsvOpen(false)}
                disabled={actionLoading}
              >
                Close
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading || !importFile} className="gap-1.5">
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Start Import</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Delete Contacts Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              {contactToDelete
                ? `Are you sure you want to delete contact "${contactToDelete.name || contactToDelete.mobile}"? This cannot be undone.`
                : `Are you sure you want to permanently delete ${selectedIds.length} selected contacts?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContacts}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Delete Phonebook Confirmation */}
      <AlertDialog
        open={Boolean(phonebookToDelete)}
        onOpenChange={(open) => !open && setPhonebookToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Phonebook Group?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting phonebook <strong className="font-semibold text-foreground">{phonebookToDelete?.name}</strong> will also permanently remove all contacts within this list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePhonebook}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Deleting...' : 'Delete Phonebook & Contacts'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
