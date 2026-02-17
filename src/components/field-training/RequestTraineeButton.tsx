"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { createAssignmentRequest } from "@/actions/field-training";

interface TraineeOption {
  id: string;
  name: string;
  employeeId: string | null;
}

interface RequestTraineeButtonProps {
  trainees: TraineeOption[];
}

export function RequestTraineeButton({ trainees }: RequestTraineeButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);

    const traineeId = formData.get("traineeId") as string;
    if (!traineeId || traineeId === "__none__") {
      setError("Please select a trainee.");
      return;
    }

    startTransition(async () => {
      const result = await createAssignmentRequest(formData);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          setSuccess(false);
        }, 1500);
      } else {
        setError(result.error ?? "Failed to submit request.");
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          setError(null);
          setSuccess(false);
        }}
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Request Trainee
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Trainee Assignment</DialogTitle>
            <DialogDescription>
              Submit a request to your supervisor/manager to have a trainee assigned to you.
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <Card className="border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-800 font-medium">
                Request submitted successfully! Your supervisor/manager will review it.
              </p>
            </Card>
          ) : (
            <form action={handleSubmit}>
              {error && (
                <Card className="border-destructive/50 bg-destructive/10 p-3 mb-4">
                  <p className="text-sm text-destructive">{error}</p>
                </Card>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="rt-trainee">Trainee</Label>
                  <Select name="traineeId" defaultValue="__none__">
                    <SelectTrigger id="rt-trainee">
                      <SelectValue placeholder="Select a trainee..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" disabled>
                        Select a trainee...
                      </SelectItem>
                      {trainees.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {t.employeeId ? ` (${t.employeeId})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {trainees.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No available trainees found.
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="rt-reason">Reason (optional)</Label>
                  <Textarea
                    id="rt-reason"
                    name="reason"
                    placeholder="Why are you requesting this trainee?"
                    rows={3}
                    maxLength={1000}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending || trainees.length === 0}>
                    {isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
