"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { CheckCircle2, Circle, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

type SkillStep = {
  id: string;
  stepNumber: number;
  description: string;
  isRequired: boolean;
};

type Skill = {
  id: string;
  name: string;
  isCritical: boolean;
  signedOff: boolean;
  signoffFto: string | null;
  signoffDate: string | null;
  steps: SkillStep[];
};

type SkillCat = {
  id: string;
  name: string;
  skills: Skill[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TraineeSkillsClient({
  traineeName,
  skillCategories,
}: {
  traineeName: string;
  skillCategories: SkillCat[];
}) {
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const totalSkills = skillCategories.reduce((sum, c) => sum + c.skills.length, 0);
  const completedSkills = skillCategories.reduce(
    (sum, c) => sum + c.skills.filter((s) => s.signedOff).length,
    0
  );
  const overallPct = totalSkills > 0 ? Math.round((completedSkills / totalSkills) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Skills Checklist</h1>
        <p className="text-muted-foreground">{traineeName}</p>
      </div>

      {/* Overall progress */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {completedSkills} of {totalSkills} skills completed
            </span>
            <span className="font-medium">{overallPct}%</span>
          </div>
          <Progress value={overallPct} className="h-3" />
        </CardContent>
      </Card>

      {/* Skill categories */}
      {skillCategories.map((cat) => {
        const catCompleted = cat.skills.filter((s) => s.signedOff).length;
        const catPct =
          cat.skills.length > 0 ? Math.round((catCompleted / cat.skills.length) * 100) : 0;

        return (
          <Card key={cat.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{cat.name}</CardTitle>
                <Badge
                  variant={catPct === 100 ? "default" : "secondary"}
                  className={catPct === 100 ? "bg-green-600" : ""}
                >
                  {catCompleted}/{cat.skills.length}
                </Badge>
              </div>
              <Progress value={catPct} className="h-1.5" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {cat.skills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      expanded={expandedSkill === skill.id}
                      onToggle={() =>
                        setExpandedSkill(expandedSkill === skill.id ? null : skill.id)
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SkillRow({
  skill,
  expanded,
  onToggle,
}: {
  skill: Skill;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow>
        <TableCell className="w-8">
          {skill.signedOff ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {skill.steps.length > 0 && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            <div>
              <span
                className={
                  "text-sm font-medium" +
                  (skill.signedOff ? " line-through text-muted-foreground" : "")
                }
              >
                {skill.name}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {skill.isCritical && (
                  <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                    Critical
                  </Badge>
                )}
                {skill.steps.length > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    {skill.steps.length} step{skill.steps.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {skill.signedOff && skill.signoffFto && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Signed off by {skill.signoffFto}
                  {skill.signoffDate && ` on ${formatDate(skill.signoffDate)}`}
                </p>
              )}
            </div>
          </div>
        </TableCell>
      </TableRow>
      {expanded && skill.steps.length > 0 && (
        <TableRow>
          <TableCell colSpan={2} className="bg-muted/30 py-2 px-8">
            <ol className="space-y-1.5">
              {skill.steps.map((step) => (
                <li key={step.id} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground font-medium min-w-[1.5rem]">
                    {step.stepNumber}.
                  </span>
                  <span>{step.description}</span>
                  {!step.isRequired && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-1">
                      optional
                    </Badge>
                  )}
                </li>
              ))}
            </ol>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
