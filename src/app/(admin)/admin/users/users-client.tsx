"use client";

import { useState, useTransition, useMemo } from "react";
import {
  approveAccountAction,
  rejectAccountAction,
  createAdminUserAction,
  updateAdminUserAction,
  deleteAdminUserAction,
  adminResetPassword,
} from "@/actions/auth";
import { ADMIN_ROLE_LABELS, ADMIN_ROLES, type AdminRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  UserPlus,
  Check,
  X,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  Search,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: string;
}

interface UsersClientProps {
  users: UserRow[];
  currentUserId: string;
}

type Tab = "pending" | "active" | "disabled";

export function UsersClient({ users, currentUserId }: UsersClientProps) {
  const [tab, setTab] = useState<Tab>(
    users.some((u) => u.status === "pending") ? "pending" : "active"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [approveTarget, setApproveTarget] = useState<UserRow | null>(null);
  const [approveRole, setApproveRole] = useState<AdminRole>("data_entry");
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pendingCount = users.filter((u) => u.status === "pending").length;
  const activeCount = users.filter((u) => u.status === "active").length;
  const disabledCount = users.filter((u) => u.status === "disabled").length;

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      // Status tab filter
      if (u.status !== tab) return false;
      // Role filter
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      // Search filter — match name or email
      if (q) {
        const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
        const email = u.email.toLowerCase();
        if (!fullName.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [users, tab, roleFilter, searchQuery]);

  function handleApprove(user: UserRow) {
    setApproveTarget(user);
    setApproveRole("data_entry");
    setError(null);
  }

  function submitApprove() {
    if (!approveTarget) return;
    startTransition(async () => {
      const result = await approveAccountAction(approveTarget.id, approveRole);
      if (result.success) {
        setApproveTarget(null);
        setError(null);
      } else {
        setError(result.error || "Failed to approve");
      }
    });
  }

  function handleReject(userId: string) {
    startTransition(async () => {
      const result = await rejectAccountAction(userId);
      if (!result.success) {
        setError(result.error || "Failed to reject");
      }
    });
  }

  function handleToggleStatus(user: UserRow) {
    const newStatus = user.status === "active" ? "disabled" : "active";
    startTransition(async () => {
      const result = await updateAdminUserAction(user.id, { status: newStatus });
      if (!result.success) {
        setError(result.error || "Failed to update");
      }
    });
  }

  function handleChangeRole(user: UserRow, newRole: AdminRole) {
    startTransition(async () => {
      const result = await updateAdminUserAction(user.id, { role: newRole });
      if (!result.success) {
        setError(result.error || "Failed to update role");
      }
    });
  }

  function handleDelete(userId: string) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    startTransition(async () => {
      const result = await deleteAdminUserAction(userId);
      if (!result.success) {
        setError(result.error || "Failed to delete");
      }
    });
  }

  function openPasswordReset(user: UserRow) {
    setPasswordTarget(user);
    setNewPassword("");
    setShowPassword(false);
    setError(null);
  }

  function submitPasswordReset() {
    if (!passwordTarget || !newPassword) return;
    startTransition(async () => {
      const result = await adminResetPassword(passwordTarget.id, newPassword);
      if (result.success) {
        setPasswordTarget(null);
        setNewPassword("");
        setError(null);
      } else {
        setError(result.error || "Failed to reset password");
      }
    });
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case "active":
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case "disabled":
        return <Badge className="bg-gray-100 text-gray-500">Disabled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
            {ADMIN_ROLE_LABELS[role as AdminRole]}
          </Badge>
        );
      case "training_manager":
        return (
          <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
            {ADMIN_ROLE_LABELS[role as AdminRole]}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-gray-300 text-gray-700">
            {ADMIN_ROLE_LABELS[role as AdminRole] || role}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray flex items-center gap-2">
            <Shield className="h-6 w-6 text-nmh-teal" />
            Admin Users
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage admin accounts and pending requests.
          </p>
        </div>
        <Button
          className="bg-nmh-teal hover:bg-nmh-dark-teal shrink-0 self-start sm:self-auto"
          onClick={() => {
            setCreateOpen(true);
            setError(null);
          }}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: "pending" as Tab, label: "Pending", count: pendingCount },
          { key: "active" as Tab, label: "Active", count: activeCount },
          { key: "disabled" as Tab, label: "Disabled", count: disabledCount },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-nmh-teal text-nmh-teal"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ADMIN_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ADMIN_ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* User Table */}
      <div className="bg-card rounded-lg border">
        {filteredUsers.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {searchQuery || roleFilter !== "all"
              ? "No users match your search or filter."
              : `No ${tab} users.`}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <TableRow key={user.id} className={isSelf ? "bg-nmh-teal/5" : undefined}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>{roleBadge(user.role)}</TableCell>
                    <TableCell>{statusBadge(user.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {tab === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleApprove(user)}
                              disabled={isPending}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleReject(user.id)}
                              disabled={isPending}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {tab === "active" && !isSelf && (
                          <>
                            <Select
                              value={user.role}
                              onValueChange={(val) => handleChangeRole(user, val as AdminRole)}
                              disabled={isPending}
                            >
                              <SelectTrigger className="w-[160px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ADMIN_ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {ADMIN_ROLE_LABELS[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reset password"
                              onClick={() => openPasswordReset(user)}
                              disabled={isPending}
                            >
                              <KeyRound className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Disable account"
                              onClick={() => handleToggleStatus(user)}
                              disabled={isPending}
                            >
                              <UserX className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete user"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(user.id)}
                              disabled={isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {tab === "disabled" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleToggleStatus(user)}
                              disabled={isPending}
                            >
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              Re-enable
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reset password"
                              onClick={() => openPasswordReset(user)}
                              disabled={isPending}
                            >
                              <KeyRound className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete user"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(user.id)}
                              disabled={isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveTarget !== null} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Account</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Approve <strong>{approveTarget.firstName} {approveTarget.lastName}</strong> ({approveTarget.email}) and assign a role:
              </p>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={approveRole} onValueChange={(val) => setApproveRole(val as AdminRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ADMIN_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-nmh-teal hover:bg-nmh-dark-teal"
              onClick={submitApprove}
              disabled={isPending}
            >
              {isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={passwordTarget !== null} onOpenChange={(open) => !open && setPasswordTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-nmh-teal" />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          {passwordTarget && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Set a new password for <strong>{passwordTarget.firstName} {passwordTarget.lastName}</strong> ({passwordTarget.email}).
                This will immediately log them out of all active sessions.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, and a number.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-nmh-teal hover:bg-nmh-dark-teal"
              onClick={submitPasswordReset}
              disabled={isPending || newPassword.length < 8}
            >
              {isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Admin User</DialogTitle>
          </DialogHeader>
          <form
            action={async (formData) => {
              const result = await createAdminUserAction(formData);
              if (result.success) {
                setCreateOpen(false);
                setError(null);
              } else {
                setError(result.error || "Failed to create user");
              }
            }}
            className="space-y-4 py-2"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-firstName">First Name</Label>
                <Input id="create-firstName" name="firstName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-lastName">Last Name</Label>
                <Input id="create-lastName" name="lastName" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input id="create-email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <Select name="role" defaultValue="data_entry">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ADMIN_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-nmh-teal hover:bg-nmh-dark-teal">
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
