'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { AdminUserListItem, AdminPlanItem } from '@/types/admin';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  Edit,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Users,
  ShieldBan,
  ShieldCheck,
  LogIn,
  ExternalLink,
  Package,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Filter,
} from 'lucide-react';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [plans, setPlans] = useState<AdminPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState<'all' | 'verified' | 'unverified' | 'pending' | 'unknown'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Bulk Selection State
  const [selectedUserUids, setSelectedUserUids] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Edit User Dialog State
  const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    mobile_with_country_code: '',
    newPassword: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Block/Unblock Dialog State
  const [blockingUser, setBlockingUser] = useState<AdminUserListItem | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);

  // Change Plan Dialog State
  const [planUser, setPlanUser] = useState<AdminUserListItem | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
  const [planLoading, setPlanLoading] = useState(false);

  // Impersonate Dialog State
  const [impersonateUser, setImpersonateUser] = useState<AdminUserListItem | null>(null);
  const [impersonateLoading, setImpersonateLoading] = useState(false);

  // Single Delete User Dialog State
  const [deletingUser, setDeletingUser] = useState<AdminUserListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Manual Verify Email Dialog State
  const [verifyingUser, setVerifyingUser] = useState<AdminUserListItem | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Success Notification
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resUsers, resPlans] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getPlans().catch(() => ({ success: false, data: [] })),
      ]);

      if (resUsers && resUsers.success && Array.isArray(resUsers.data)) {
        setUsers(resUsers.data);
      } else {
        setError('Failed to fetch user list from administrative API.');
      }

      if (resPlans && resPlans.success && Array.isArray(resPlans.data)) {
        setPlans(resPlans.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with the backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showSuccessBanner = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  // Filtered users based on search and email verification status
  const filteredUsers = useMemo(() => {
    let result = users;

    if (emailStatusFilter !== 'all') {
      result = result.filter((u) => {
        const status = u.email_status || (u.email_verified_at ? 'verified' : 'unverified');
        return status === emailStatusFilter;
      });
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(query)) ||
          (u.email && u.email.toLowerCase().includes(query)) ||
          (u.mobile_with_country_code && u.mobile_with_country_code.toLowerCase().includes(query)) ||
          (u.uid && u.uid.toLowerCase().includes(query))
      );
    }

    return result;
  }, [users, emailStatusFilter, searchQuery]);

  // Paginated users
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage]);

  // Selection helpers
  const isAllCurrentPageSelected =
    paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedUserUids.has(u.uid));

  const handleToggleSelectAllPage = () => {
    const newSet = new Set(selectedUserUids);
    if (isAllCurrentPageSelected) {
      paginatedUsers.forEach((u) => newSet.delete(u.uid));
    } else {
      paginatedUsers.forEach((u) => newSet.add(u.uid));
    }
    setSelectedUserUids(newSet);
  };

  const handleToggleSelectUser = (uid: string) => {
    const newSet = new Set(selectedUserUids);
    if (newSet.has(uid)) {
      newSet.delete(uid);
    } else {
      newSet.add(uid);
    }
    setSelectedUserUids(newSet);
  };

  const selectedUsersList = useMemo(() => {
    return users.filter((u) => selectedUserUids.has(u.uid));
  }, [users, selectedUserUids]);

  const openEditModal = (user: AdminUserListItem) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name || '',
      email: user.email || '',
      mobile_with_country_code: user.mobile_with_country_code || '',
      newPassword: '',
    });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editFormData.name || !editFormData.email || !editFormData.mobile_with_country_code) {
      setEditError('Name, email, and mobile are required.');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await adminApi.updateUser({
        uid: editingUser.uid,
        name: editFormData.name,
        email: editFormData.email,
        mobile_with_country_code: editFormData.mobile_with_country_code,
        newPassword: editFormData.newPassword || undefined,
      });

      if (res && res.success) {
        setEditingUser(null);
        showSuccessBanner(`Account updated for ${editingUser.email}`);
        await fetchUsers();
      } else {
        setEditError(res?.msg || 'Failed to update user.');
      }
    } catch (err: any) {
      setEditError(err.message || 'Error occurred while updating user.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!blockingUser) return;
    setBlockLoading(true);
    try {
      const isCurrentlyBlocked = Boolean(blockingUser.is_blocked);
      const res = await adminApi.toggleUserStatus(blockingUser.uid, !isCurrentlyBlocked);
      if (res && res.success) {
        setBlockingUser(null);
        showSuccessBanner(
          !isCurrentlyBlocked
            ? `User ${blockingUser.email} has been blocked and active sessions revoked.`
            : `User ${blockingUser.email} has been unblocked.`
        );
        await fetchUsers();
      } else {
        alert(res?.msg || 'Failed to toggle user status.');
      }
    } catch (err: any) {
      alert(err.message || 'Error communicating with server.');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleChangePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planUser || selectedPlanId === '') return;

    const chosenPlan = plans.find((p) => p.id === Number(selectedPlanId));
    if (!chosenPlan) return;

    setPlanLoading(true);
    try {
      const res = await adminApi.updateUserPlan(planUser.uid, {
        id: chosenPlan.id,
        title: chosenPlan.title,
      });

      if (res && res.success) {
        setPlanUser(null);
        showSuccessBanner(`Subscription plan updated to "${chosenPlan.title}" for ${planUser.email}`);
        await fetchUsers();
      } else {
        alert(res?.msg || 'Failed to update plan.');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating plan.');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleImpersonate = async () => {
    if (!impersonateUser) return;
    setImpersonateLoading(true);
    try {
      const res = await adminApi.autoLoginAsUser(impersonateUser.uid);
      if (res && res.success) {
        window.location.href = '/dashboard';
      } else {
        alert(res?.msg || 'Failed to switch user account.');
        setImpersonateLoading(false);
      }
    } catch (err: any) {
      alert(err.message || 'Error during impersonation.');
      setImpersonateLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      const res = await adminApi.deleteUser(deletingUser.id);
      if (res && res.success) {
        const deletedUid = deletingUser.uid;
        setDeletingUser(null);
        setSelectedUserUids((prev) => {
          const updated = new Set(prev);
          updated.delete(deletedUid);
          return updated;
        });
        showSuccessBanner(`User ${deletingUser.email} permanently removed.`);
        await fetchUsers();
      } else {
        alert(res?.msg || 'Failed to delete user.');
      }
    } catch (err: any) {
      alert(err.message || 'Error communicating with server.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserUids.size === 0) return;
    setBulkDeleting(true);

    try {
      const userIdsToDelete = Array.from(selectedUserUids);
      const res = await adminApi.deleteUsers(userIdsToDelete);

      if (res && res.success) {
        setShowBulkDeleteDialog(false);
        setSelectedUserUids(new Set());
        showSuccessBanner(res.msg || `Successfully deleted ${res.deletedCount || userIdsToDelete.length} user accounts.`);
        await fetchUsers();
      } else {
        alert(res?.msg || 'Bulk deletion failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Error communicating with server during bulk deletion.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleManualVerifyEmail = async () => {
    if (!verifyingUser) return;
    setVerifyLoading(true);

    try {
      const res = await adminApi.verifyUserEmail(verifyingUser.uid);
      if (res && res.success) {
        setVerifyingUser(null);
        showSuccessBanner(`Email for ${verifyingUser.email} has been verified.`);
        await fetchUsers();
      } else {
        alert(res?.msg || 'Failed to manually verify user email.');
      }
    } catch (err: any) {
      alert(err.message || 'Error communicating with server.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const parsePlanTitle = (plan: any) => {
    if (!plan) return 'Free / Default';
    try {
      const parsed = typeof plan === 'string' ? JSON.parse(plan) : plan;
      return parsed.title || 'Custom Plan';
    } catch {
      return 'Subscribed';
    }
  };

  const renderEmailStatusBadge = (user: AdminUserListItem) => {
    const status = user.email_status || (user.email_verified_at ? 'verified' : 'unverified');

    switch (status) {
      case 'verified':
        return (
          <span
            title={
              user.email_verified_at
                ? `Verified on ${new Date(user.email_verified_at).toLocaleString()}`
                : 'Email Verified'
            }
          >
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] px-2 py-0.5 font-medium inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              Verified
            </Badge>
          </span>
        );
      case 'pending':
        return (
          <span title="Verification OTP issued and awaiting user confirmation">
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px] px-2 py-0.5 font-medium inline-flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              Pending
            </Badge>
          </span>
        );
      case 'unknown':
        return (
          <span title="Legacy user account without verification history records">
            <Badge variant="outline" className="text-muted-foreground text-[11px] px-2 py-0.5 font-normal inline-flex items-center gap-1">
              <HelpCircle className="h-3 w-3 shrink-0" />
              Unknown
            </Badge>
          </span>
        );
      case 'unverified':
      default:
        return (
          <span title="Email address has not been verified">
            <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 text-[11px] px-2 py-0.5 font-medium inline-flex items-center gap-1">
              <XCircle className="h-3 w-3 shrink-0" />
              Unverified
            </Badge>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse, inspect, verify, and manage all registered tenant accounts ({users.length} total users).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedUserUids.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              className="gap-1.5 shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected ({selectedUserUids.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-1.5 self-start sm:self-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {actionSuccess && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-3">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Success</AlertTitle>
          <AlertDescription className="text-xs">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {selectedUserUids.size > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 text-xs">
          <span className="font-medium text-foreground">
            {selectedUserUids.size} user{selectedUserUids.size > 1 ? 's' : ''} selected across pages
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedUserUids(new Set())}
              className="h-7 text-xs"
            >
              Clear Selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              className="h-7 text-xs gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      <Card className="shadow-xs">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, mobile, or UID..."
                  className="pl-9 h-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Email Status Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
                <select
                  value={emailStatusFilter}
                  onChange={(e) => {
                    setEmailStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Filter by email verification status"
                >
                  <option value="all">All Email Statuses</option>
                  <option value="verified">Verified Only</option>
                  <option value="unverified">Unverified Only</option>
                  <option value="pending">Pending Only</option>
                  <option value="unknown">Unknown Only</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-mono">
              Showing {paginatedUsers.length} of {filteredUsers.length} users
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Users</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col items-start gap-3">
                  <span>{error}</span>
                  <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No users found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || emailStatusFilter !== 'all'
                  ? 'No user accounts matched the applied search and filter criteria.'
                  : 'There are currently no registered users in the database.'}
              </p>
              {(searchQuery || emailStatusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setEmailStatusFilter('all');
                  }}
                  className="mt-2"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile User Cards (md:hidden) */}
              <div className="md:hidden divide-y divide-border">
                {paginatedUsers.map((user) => {
                  const isBlocked = user.is_blocked === 1;
                  const isSelected = selectedUserUids.has(user.uid);
                  const isVerified = user.email_status === 'verified' || Boolean(user.email_verified_at);

                  return (
                    <div key={user.uid} className={`p-3.5 space-y-2.5 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelectUser(user.uid)}
                            aria-label={`Select ${user.name || user.email}`}
                            className="mt-0.5"
                          />
                          <Avatar className="h-9 w-9 border shrink-0">
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/users/${user.uid}`}
                              className="text-sm font-semibold text-foreground hover:underline hover:text-primary transition-colors block truncate"
                            >
                              {user.name || 'Unnamed User'}
                            </Link>
                            <span className="text-xs text-muted-foreground block truncate">{user.email}</span>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" className="h-8 w-8 touch-manipulation" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => router.push(`/admin/users/${user.uid}`)}
                              className="cursor-pointer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>View Inspector</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => setImpersonateUser(user)}
                              className="cursor-pointer text-blue-600 dark:text-blue-400 focus:text-blue-600"
                            >
                              <LogIn className="mr-2 h-4 w-4" />
                              <span>Login as User</span>
                            </DropdownMenuItem>

                            {!isVerified && (
                              <DropdownMenuItem
                                onClick={() => setVerifyingUser(user)}
                                className="cursor-pointer text-emerald-600 dark:text-emerald-400 focus:text-emerald-600"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                <span>Verify Email Manually</span>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => {
                                setPlanUser(user);
                                setSelectedPlanId('');
                              }}
                              className="cursor-pointer"
                            >
                              <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>Change Plan</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => openEditModal(user)} className="cursor-pointer">
                              <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>Edit Details</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => setBlockingUser(user)}
                              className={`cursor-pointer ${
                                isBlocked
                                  ? 'text-emerald-600 dark:text-emerald-400 focus:text-emerald-600'
                                  : 'text-amber-600 dark:text-amber-400 focus:text-amber-600'
                              }`}
                            >
                              {isBlocked ? (
                                <>
                                  <ShieldCheck className="mr-2 h-4 w-4" />
                                  <span>Unblock Account</span>
                                </>
                              ) : (
                                <>
                                  <ShieldBan className="mr-2 h-4 w-4" />
                                  <span>Block Account</span>
                                </>
                              )}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => setDeletingUser(user)}
                              className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete User</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant={user.role === 'admin' ? 'destructive' : 'secondary'}
                            className="font-mono text-[10px] px-1.5 py-0"
                          >
                            {(user.role || 'user').toUpperCase()}
                          </Badge>

                          {renderEmailStatusBadge(user)}

                          {isBlocked ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-medium">
                              Blocked
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 font-medium">
                              Active
                            </Badge>
                          )}

                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            {parsePlanTitle(user.plan)}
                          </Badge>
                        </div>

                        <span className="font-mono text-[11px] text-muted-foreground">
                          {user.mobile_with_country_code || '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[44px]">
                        <Checkbox
                          checked={isAllCurrentPageSelected}
                          onCheckedChange={handleToggleSelectAllPage}
                          aria-label="Select all users on this page"
                        />
                      </TableHead>
                      <TableHead className="w-[230px]">User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Email Status</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((user) => {
                      const isBlocked = user.is_blocked === 1;
                      const isSelected = selectedUserUids.has(user.uid);
                      const isVerified = user.email_status === 'verified' || Boolean(user.email_verified_at);

                      return (
                        <TableRow key={user.uid} className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelectUser(user.uid)}
                              aria-label={`Select user ${user.email}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border">
                                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                  {getInitials(user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0">
                                <Link
                                  href={`/admin/users/${user.uid}`}
                                  className="text-sm font-semibold text-foreground hover:underline hover:text-primary transition-colors flex items-center gap-1 truncate"
                                >
                                  {user.name || 'Unnamed User'}
                                </Link>
                                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.role === 'admin' ? 'destructive' : 'secondary'}
                              className="font-mono text-xs"
                            >
                              {(user.role || 'user').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {renderEmailStatusBadge(user)}
                          </TableCell>
                          <TableCell>
                            {isBlocked ? (
                              <Badge variant="destructive" className="text-xs font-medium">
                                Blocked
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-medium">
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {user.mobile_with_country_code || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">
                              {parsePlanTitle(user.plan)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                  onClick={() => router.push(`/admin/users/${user.uid}`)}
                                  className="cursor-pointer"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground" />
                                  <span>View Inspector</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => setImpersonateUser(user)}
                                  className="cursor-pointer text-blue-600 dark:text-blue-400 focus:text-blue-600"
                                >
                                  <LogIn className="mr-2 h-4 w-4" />
                                  <span>Login as User</span>
                                </DropdownMenuItem>

                                {!isVerified && (
                                  <DropdownMenuItem
                                    onClick={() => setVerifyingUser(user)}
                                    className="cursor-pointer text-emerald-600 dark:text-emerald-400 focus:text-emerald-600"
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    <span>Verify Email Manually</span>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuItem
                                  onClick={() => {
                                    setPlanUser(user);
                                    setSelectedPlanId('');
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                                  <span>Change Plan</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => openEditModal(user)} className="cursor-pointer">
                                  <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                                  <span>Edit Details</span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() => setBlockingUser(user)}
                                  className={`cursor-pointer ${
                                    isBlocked
                                      ? 'text-emerald-600 dark:text-emerald-400 focus:text-emerald-600'
                                      : 'text-amber-600 dark:text-amber-400 focus:text-amber-600'
                                  }`}
                                >
                                  {isBlocked ? (
                                    <>
                                      <ShieldCheck className="mr-2 h-4 w-4" />
                                      <span>Unblock Account</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldBan className="mr-2 h-4 w-4" />
                                      <span>Block Account</span>
                                    </>
                                  )}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => setDeletingUser(user)}
                                  className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  <span>Delete User</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Pagination controls */}
          {!loading && !error && filteredUsers.length > pageSize && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 gap-1 touch-manipulation"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 gap-1 touch-manipulation"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Edit User Account</DialogTitle>
              <DialogDescription className="text-xs">
                Update account details for {editingUser?.email}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editError && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{editError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-xs font-medium">
                  Full Name
                </Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email" className="text-xs font-medium">
                  Email Address
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-mobile" className="text-xs font-medium">
                  Mobile (with Country Code)
                </Label>
                <Input
                  id="edit-mobile"
                  value={editFormData.mobile_with_country_code}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, mobile_with_country_code: e.target.value })
                  }
                  required
                  className="h-9 text-sm font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-password" text-xs="true" className="text-xs font-medium">
                  New Password (leave blank to keep unchanged)
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editFormData.newPassword}
                  onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
                disabled={editLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading} className="bg-red-600 hover:bg-red-700 text-white">
                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Block / Unblock Confirmation Dialog */}
      <Dialog open={!!blockingUser} onOpenChange={(open) => !open && setBlockingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              {blockingUser?.is_blocked === 1 ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  Unblock Account
                </>
              ) : (
                <>
                  <ShieldBan className="h-5 w-5 text-destructive" />
                  Block Account
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {blockingUser?.is_blocked === 1
                ? `Are you sure you want to restore access for ${blockingUser?.name} (${blockingUser?.email})? They will be able to log in and use the platform immediately.`
                : `Are you sure you want to block ${blockingUser?.name} (${blockingUser?.email})? All active user sessions will be immediately terminated, and further API requests will be rejected with HTTP 403.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setBlockingUser(null)} disabled={blockLoading}>
              Cancel
            </Button>
            <Button
              variant={blockingUser?.is_blocked === 1 ? 'default' : 'destructive'}
              onClick={handleToggleBlock}
              disabled={blockLoading}
            >
              {blockLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {blockingUser?.is_blocked === 1 ? 'Confirm Unblock' : 'Confirm Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!planUser} onOpenChange={(open) => !open && setPlanUser(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleChangePlanSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Change Subscription Plan
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select a subscription plan to assign to {planUser?.name} ({planUser?.email}). Current plan:{' '}
                <strong>{parsePlanTitle(planUser?.plan)}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <Label htmlFor="plan-select" className="text-xs font-medium">
                Choose Plan
              </Label>
              <select
                id="plan-select"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select a plan...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {p.price === 0 ? 'Free' : `$${p.price}`}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setPlanUser(null)} disabled={planLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={planLoading || selectedPlanId === ''} className="bg-red-600 hover:bg-red-700 text-white">
                {planLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply Plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Impersonate User Confirmation Dialog */}
      <Dialog open={!!impersonateUser} onOpenChange={(open) => !open && setImpersonateUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <LogIn className="h-5 w-5" />
              Impersonate User (Login as Tenant)
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2">
              <p>
                You are about to log in as <strong>{impersonateUser?.name}</strong> ({impersonateUser?.email}).
              </p>
              <p className="text-muted-foreground">
                Your browser session will switch to this tenant account. All actions taken will be recorded in the audit log.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setImpersonateUser(null)} disabled={impersonateLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleImpersonate}
              disabled={impersonateLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {impersonateLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Launch User Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete User Confirmation Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User Account
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2">
              <p>
                Are you sure you want to permanently delete <strong>{deletingUser?.name}</strong> ({deletingUser?.email})?
              </p>
              <p className="text-destructive font-medium">
                This will transactionally remove all their WhatsApp instances, contacts, chats, campaigns, and active sessions. Billing transaction records will be preserved for compliance.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setDeletingUser(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Users Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={(open) => !open && !bulkDeleting && setShowBulkDeleteDialog(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Confirm Bulk User Deletion
            </DialogTitle>
            <DialogDescription className="text-xs space-y-3">
              <p>
                You are about to permanently delete <strong>{selectedUserUids.size}</strong> selected user accounts.
              </p>
              <Alert variant="destructive" className="py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <AlertDescription className="text-xs leading-relaxed">
                  This destructive operation will permanently purge all tenant WhatsApp instances, contacts, chat histories, campaigns, flows, and revoke all active sessions. Statutory billing order records are preserved for audit compliance.
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block">
                  Accounts to be deleted ({selectedUserUids.size}):
                </span>
                <div className="max-h-36 overflow-y-auto rounded-md border bg-muted/40 p-2 space-y-1">
                  {selectedUsersList.slice(0, 10).map((u) => (
                    <div key={u.uid} className="text-xs flex items-center justify-between font-mono text-muted-foreground">
                      <span className="truncate">{u.email}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">UID: {u.uid.slice(0, 8)}...</span>
                    </div>
                  ))}
                  {selectedUsersList.length > 10 && (
                    <p className="text-[11px] text-muted-foreground italic text-center pt-1">
                      ...and {selectedUsersList.length - 10} more accounts
                    </p>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={bulkDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting || selectedUserUids.size === 0}
            >
              {bulkDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting {selectedUserUids.size} Users...
                </>
              ) : (
                `Permanently Delete ${selectedUserUids.size} Users`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Email Verification Confirmation Dialog */}
      <Dialog open={!!verifyingUser} onOpenChange={(open) => !open && !verifyLoading && setVerifyingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Manually Verify User Email
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2">
              <p>
                Are you sure you want to mark <strong>{verifyingUser?.email}</strong> ({verifyingUser?.name}) as email-verified?
              </p>
              <p className="text-muted-foreground">
                This will record an authoritative verification timestamp in the database and allow this user to log into the platform immediately. This administrative override will be logged in the system audit log.
              </p>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setVerifyingUser(null)} disabled={verifyLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleManualEmailVerifyClick}
              disabled={verifyLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {verifyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function handleManualEmailVerifyClick() {
    handleManualVerifyEmail();
  }
}
