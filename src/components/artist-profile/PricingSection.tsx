import { useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  minPrice: number | null;
  maxPrice: number | null;
  onSave: (min: number | null, max: number | null) => void;
  readOnly?: boolean;
}

const PricingSection = ({ minPrice, maxPrice, onSave, readOnly }: Props) => {
  const [min, setMin] = useState(minPrice?.toString() || "");
  const [max, setMax] = useState(maxPrice?.toString() || "");

  const handleBlur = () => {
    onSave(
      min ? parseFloat(min) : null,
      max ? parseFloat(max) : null
    );
  };

  if (readOnly) {
    return (
      <section className="space-y-2">
        <h3 className="font-display font-bold text-base text-foreground">Pricing</h3>
        <p className="font-body text-sm text-muted-foreground">
          {minPrice && maxPrice
            ? `₹${minPrice.toLocaleString("en-IN")} – ₹${maxPrice.toLocaleString("en-IN")}`
            : "Pricing not set"}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="font-display font-bold text-base text-foreground">Pricing (INR)</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
          <Input
            type="number"
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            onBlur={handleBlur}
            className="pl-7 rounded-btn"
          />
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
          <Input
            type="number"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            onBlur={handleBlur}
            className="pl-7 rounded-btn"
          />
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
