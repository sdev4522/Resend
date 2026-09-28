'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { teamApi, AgentMember } from '@/lib/api/dashboard';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
  Mail,
  Phone,
} from 'lucide-react';

export default function TeamPage() {
  const { role } = useAuth();
  const [agents, setAgents] = useState<AgentMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Agent Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [comments, setComments] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await teamApi.getAgents();
      if (res.success) {
        setAgents(res.data || []);
      } else {
        throw new Error('Failed to load team members');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading team agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      const res = await teamApi.addAgent({
        name,
        email,
        password,
        mobile,
        comments,
      });

      if (res.success) {
        toast.success(`Agent ${name} added successfully`);
        setName('');
        setEmail('');
        setPassword('');
        setMobile('');
        setComments('');
        setAddModalOpen(false);
        await fetchAgents();
      } else {
        throw new Error(res.msg || 'Failed to add team agent');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgent = async (agent: AgentMember) => {
    if (!confirm(`Are you sure you want to remove ${agent.name} from the workspace?`)) {
      return;
    }

    try {
      const res = await teamApi.deleteAgent(agent.uid);
      if (res.success) {
        toast.success(`Agent ${agent.name} removed`);
        await fetchAgents();
      } else {
        throw new Error(res.msg || 'Failed to remove agent');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error removing agent');
    }
  };

  // Permission check for agents trying to manage team
  if (role === 'agent') {
    return (
      <div className="space-y-6">
        <DashboardPageHeader
          title="Team Management"
          description="Workspace team member directory."
          breadcrumbs={[{ title: 'Team' }]}
        />
        <Card className="shadow-xs border">
          <CardContent className="p-8 text-center space-y-2">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold text-base">Restricted Access</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Team member management and invitation privileges are restricted to workspace owners.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Team Members & Agents"
        description="Collaborate with support agents on a single WhatsApp number. Assign chats and track responses."
        breadcrumbs={[{ title: 'Team' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAgents}
              disabled={loading}
              className="rounded-full text-xs h-9 px-4 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
              <DialogTrigger
                render={
                  <Button size="sm" className="rounded-full text-xs h-9 px-4 gap-1.5 cursor-pointer" />
                }
              >
                <Plus className="h-4 w-4" />
                <span>Add Member</span>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg">Add Support Agent</DialogTitle>
                  <DialogDescription className="text-xs">
                    Create an agent login with restricted access to customer conversations.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAddAgent} className="space-y-3.5 pt-2">
                  {createError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{createError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="agent-name" className="text-xs font-semibold">
                      Full Name
                    </Label>
                    <Input
                      id="agent-name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Support"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="agent-email" className="text-xs font-semibold">
                      Email Address
                    </Label>
                    <Input
                      id="agent-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="agent-mobile" className="text-xs font-semibold">
                      Mobile Number
                    </Label>
                    <Input
                      id="agent-mobile"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="+1234567890"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="agent-password" className="text-xs font-semibold">
                      Temporary Password
                    </Label>
                    <Input
                      id="agent-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="agent-notes" className="text-xs font-semibold">
                      Role / Comments (Optional)
                    </Label>
                    <Input
                      id="agent-notes"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Sales inquiry specialist"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddModalOpen(false)}
                      className="rounded-full text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={creating}
                      className="rounded-full text-xs"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Member'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* Agents List Card */}
      <Card className="shadow-xs border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Active Team Directory
              </CardTitle>
              <CardDescription className="text-xs">
                Colleagues with access to reply to WhatsApp chats.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {agents.length} Agent{agents.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : agents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b text-muted-foreground uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-3 px-3">Agent</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Notes</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agents.map((agent) => {
                    const initials = agent.name
                      ? agent.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                      : 'AG';

                    return (
                      <tr key={agent.uid} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 border">
                              <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-foreground text-xs">{agent.name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">UID: {agent.uid.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{agent.email}</span>
                          </div>
                          {agent.mobile && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{agent.mobile}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            Support Agent
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {agent.comments || '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteAgent(agent)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-foreground">No Support Agents Added</span>
              <p className="text-xs text-muted-foreground max-w-sm">
                Add team members so multiple colleagues can reply to customers simultaneously from one WhatsApp number.
              </p>
              <Button
                size="sm"
                onClick={() => setAddModalOpen(true)}
                className="mt-3 rounded-full text-xs h-8 px-4"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add First Agent
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
