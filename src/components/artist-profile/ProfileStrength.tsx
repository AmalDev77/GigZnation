interface Props {
  percent: number;
  nudge: string | null;
  nextPercent: number;
}

const ProfileStrength = ({ percent, nudge, nextPercent }: Props) => (
  <div className="rounded-xl border border-card-border bg-card p-4 space-y-2">
    <div className="flex items-center justify-between">
      <span className="font-body text-[13px] text-foreground font-medium">
        Profile Strength: {percent}%
      </span>
    </div>
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
    {nudge && (
      <p className="font-body text-[12px] text-muted-foreground">
        {nudge} to reach {nextPercent}%
      </p>
    )}
  </div>
);

export default ProfileStrength;
