import InputField from "../shared/InputField";
import SelectField from "../shared/SelectField";
import {
  AMENITIES,
  FURNISHING_OPTIONS,
  PROPERTY_CONFIGURATIONS,
  PROPERTY_TYPES,
} from "@/lib/property-attributes";

type PropertyAttributeFieldsProps = {
  // Prefilled when amending an existing property. Uncontrolled otherwise, so
  // the add form keeps behaving exactly as it did.
  defaults?: {
    configuration?: string | null;
    propertyType?: string | null;
    furnishing?: string | null;
    carpetAreaSqft?: number | null;
    amenities?: string[];
  };
};

// The four attributes the discovery filters search on, in one fragment shared
// by the Add Property form and the property edit form. Deliberately one
// component rather than two copies: if these ever drift apart, a property
// could be registered with a value its own edit form cannot represent.
//
// The option lists come from lib/property-attributes.ts, the same lists the
// filter panel renders, which is what keeps "1 RK" identical on both sides.
export default function PropertyAttributeFields({
  defaults,
}: PropertyAttributeFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <SelectField
          label="Configuration"
          name="configuration"
          options={PROPERTY_CONFIGURATIONS}
          placeholder="Not sure"
          defaultValue={defaults?.configuration ?? ""}
          helperText="1 RK is a single room with a kitchen."
        />

        <SelectField
          label="Property Type"
          name="propertyType"
          options={PROPERTY_TYPES}
          placeholder="Not sure"
          defaultValue={defaults?.propertyType ?? ""}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SelectField
          label="Furnishing"
          name="furnishing"
          options={FURNISHING_OPTIONS}
          placeholder="Not sure"
          defaultValue={defaults?.furnishing ?? ""}
        />

        <InputField
          label="Built-up Area (sq.ft)"
          placeholder="850"
          name="carpetAreaSqft"
          type="number"
          min="0"
          // step="1", not a rounder increment. A step of 10 makes 1075 fail
          // the browser's own constraint validation, which blocks submit
          // silently — no error message, no request, just a form that does
          // nothing. Areas are whole numbers, not multiples of ten.
          step="1"
          defaultValue={
            defaults?.carpetAreaSqft === null || defaults?.carpetAreaSqft === undefined
              ? undefined
              : String(defaults.carpetAreaSqft)
          }
          helperText="Renters filter by minimum area, so this helps the property be found."
        />
      </div>

      <div>
        <p className="mb-2 font-medium text-foreground">Amenities</p>
        <p className="mb-3 text-sm text-muted">
          Select everything that applies. Renters can filter by these.
        </p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {AMENITIES.map((amenity) => (
            <label key={amenity} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="amenities"
                value={amenity}
                defaultChecked={defaults?.amenities?.includes(amenity) ?? false}
                className="accent-blue-600"
              />
              {amenity}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
