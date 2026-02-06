import { Check, Circle } from "lucide-react";

interface ChecklistStep {
  label: string;
  done: boolean;
}

interface OnboardingChecklistProps {
  steps: ChecklistStep[];
}

export function OnboardingChecklist({ steps }: OnboardingChecklistProps) {
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="rounded-2xl bg-surface-0 p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-body font-semibold text-charcoal">
          Getting Started
        </h3>
        <span className="text-caption font-medium text-charcoal-muted">
          {completed}/{total} complete
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-surface-100 mb-5">
        <div
          className="h-full rounded-full bg-primary-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3">
            {step.done ? (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-positive-100">
                <Check className="h-3 w-3 text-positive-600" />
              </div>
            ) : (
              <Circle className="h-5 w-5 text-surface-300" />
            )}
            <span
              className={`text-body-sm ${
                step.done
                  ? "text-charcoal-muted line-through"
                  : "text-charcoal"
              }`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
