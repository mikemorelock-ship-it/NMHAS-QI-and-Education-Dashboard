"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, null);

  // Show success message after registration
  if (state?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl text-nmh-gray">Request Submitted</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your account request has been submitted. An administrator will review and approve your
              account.
            </p>
            <p className="text-sm text-muted-foreground">
              You will be able to sign in once your account has been approved.
            </p>
            <Link
              href="/login"
              className="inline-block mt-4 text-sm text-nmh-teal hover:text-nmh-dark-teal hover:underline"
            >
              Back to Sign In
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-nmh-teal/10">
            <UserPlus className="h-8 w-8 text-nmh-teal" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl text-nmh-gray">Request Account</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            Submit a request for an admin dashboard account
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" placeholder="First" required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" placeholder="Last" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                required
                minLength={8}
              />
            </div>
            <div aria-live="polite">
              {state?.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base bg-nmh-teal hover:bg-nmh-dark-teal"
              disabled={isPending}
            >
              {isPending ? "Submitting..." : "Request Account"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link
              href="/login"
              className="text-sm text-nmh-teal hover:text-nmh-dark-teal hover:underline"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
