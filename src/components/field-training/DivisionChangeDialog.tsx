"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  requestDivisionChange,
  getDivisionsForSelect,
  getCurrentUserDivision,
} from "@/actions/field-training";

export function DivisionChangeDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [divisions, setDivisions] = useState<{ id: string; name: string }[]>([]);
  const [currentDivisionName, setCurrentDivisionName] = useState<string | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (newOpen) {
      setError(null);
      setSuccess(false);
      setSelectedDivisionId("");
      setReason("");

      // Load divisions and current user division
      getDivisionsForSelect().then((res) => {
        if (res.success) {
          setDivisions(res.divisions);
        }
      });
      getCurrentUserDivision().then((res) => {
        if (res.success) {
          setCurrentDivisionName(res.divisionName);
        }
      });
    }
  }

  function handleSubmit() {
    if (!selectedDivisionId) {
      setError("Please select a division.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await requestDivisionChange(selectedDivisionId, reason || undefined);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setOpen(false), 1500);
      } else {
        setError(result.error || "Failed to submit request.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/80 hover:text-white hover:bg-white/15"
        >
          <ArrowRightLeft className="size-4" />
          <span className="hidden sm:inline ml-1.5">Division</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Division Change</DialogTitle>
          <DialogDescription>
            Submit a request to change your division assignment. An admin or manager will review
            your request.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-4 text-center text-green-600 font-medium">
            Request submitted successfully! An admin will review it shortly.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {currentDivisionName && (
              <div className="text-sm text-muted-foreground">
                Current division:{" "}
                <span className="font-medium text-foreground">{currentDivisionName}</span>
              </div>
            )}
            {!currentDivisionName && (
              <div className="text-sm text-muted-foreground">
                You are not currently assigned to a division.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="division-select">Requested Division</Label>
              <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId}>
                <SelectTrigger id="division-select">
                  <SelectValue placeholder="Select a division..." />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason-text">Reason (optional)</Label>
              <Textarea
                id="reason-text"
                placeholder="Why are you requesting this change?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
