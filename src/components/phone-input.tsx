"use client";

import { useState } from "react";
import { PhoneInput as CountryPhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { toE164 } from "@/lib/phone";

// A phone field with a country picker (flag, search, dial code) that formats the number as you
// type. Pakistan is selected by default. It submits the international number (+923001234567)
// under `name`, or nothing when left empty.
export function PhoneField({
  name,
  defaultValue = "",
  defaultCountry = "pk",
  placeholder,
}: {
  name: string;
  // A saved number, in any format we have ever stored.
  defaultValue?: string;
  defaultCountry?: string;
  placeholder?: string;
}) {
  const [phone, setPhone] = useState(() => toE164(defaultValue) ?? "");
  const [touched, setTouched] = useState(false);

  // The picker reports just the dial code ("+92") while nothing has been typed.
  const hasNumber = /^\+\d{1,4}\d+/.test(phone) && phone.replace(/\D/g, "").length > 4;
  const valid = toE164(phone) !== null;
  const showError = touched && hasNumber && !valid;

  return (
    <div className="phone-field">
      <CountryPhoneInput
        defaultCountry={defaultCountry}
        value={phone}
        onChange={(value) => {
          setPhone(value);
          setTouched(true);
        }}
        placeholder={placeholder}
        disableDialCodeAndPrefix
        showDisabledDialCodeAndPrefix
        inputProps={{ type: "tel", autoComplete: "tel", "aria-invalid": showError || undefined }}
        style={{ width: "100%" }}
      />
      <input type="hidden" name={name} value={hasNumber ? phone : ""} />
      {showError && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          That doesn&apos;t look like a valid number for this country.
        </p>
      )}
    </div>
  );
}
