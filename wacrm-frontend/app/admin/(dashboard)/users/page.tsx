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
} from 'lucide-react';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [plans, setPlans] = useState<AdminPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

  // Delete User Dialog State
  const [deletingUser, setDeletingUser] = useState<AdminUserListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // Filtered users based on search
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.mobile_with_country_code && u.mobile_with_country_code.toLowerCase().includes(query)) ||
        (u.uid && u.uid.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  // Paginated users
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage]);

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
        // Redirection to tenant dashboard
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
        setDeletingUser(null);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse, inspect, impersonate, and manage all registered tenant accounts ({users.length} total users).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-1.5 self-start sm:self-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {actionSuccess && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-3">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Success</AlertTitle>
          <AlertDescription className="text-xs">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-xs">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or mobile..."
                className="pl-9 h-9 text-sm"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
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
                {searchQuery
                  ? `No user accounts matched "${searchQuery}". Try searching with a different term.`
                  : 'There are currently no registered users in the database.'}
              </p>
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="mt-2">
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile User Cards (md:hidden) */}
              <div className="md:hidden divide-y divide-border">
                {paginatedUsers.map((user) => {
                  const isBlocked = user.is_blocked === 1;

                  return (
                    <div key={user.uid} className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
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
                          <DropdownMenuContent align="end" className="w-48">
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
                    <TableHead className="w-[240px]">User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => {
                    const isBlocked = user.is_blocked === 1;

                    return (
                      <TableRow key={user.uid} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border">
                              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <Link
                                href={`/admin/users/${user.uid}`}
                                className="text-sm font-semibold text-foreground hover:underline hover:text-primary transition-colors flex items-center gap-1"
                              >
                                {user.name || 'Unnamed User'}
                              </Link>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
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
                            <DropdownMenuContent align="end" className="w-48">
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

      {/* Delete User Confirmation Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User Account
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to permanently delete <strong>{deletingUser?.name}</strong> ({deletingUser?.email})? This action will remove their account and related configurations.
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
    </div>
  );
}
