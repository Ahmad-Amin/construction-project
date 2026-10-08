"use client";

import { useState } from "react";
import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { PhoneInput as CountryPhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { toE164 } from "@/lib/phone";

// A phone field with a country picker (flag, search, dial code) that formats the number as you
// type. Pakistan is selected by default. It submits the international number (+923001234567)
// under `name`, or nothing when left empty. The dial code lives in the picker, so people type
// just their own number, with or without the leading 0.
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
  const [dialCode, setDialCode] = useState(() => {
    const saved = parsePhoneNumberFromString(toE164(defaultValue) ?? "");
    return saved?.countryCallingCode ?? getCountryCallingCode(defaultCountry.toUpperCase() as CountryCode);
  });
  const [leftField, setLeftField] = useState(false);

  // While nothing is typed the picker reports just the dial code ("+92").
  const hasNumber = phone.replace(/\D/g, "").length > String(dialCode).length;
  const valid = toE164(phone) !== null;
  const showError = leftField && hasNumber && !valid;

  return (
    <div className="phone-field">
      <CountryPhoneInput
        defaultCountry={defaultCountry}
        value={phone}
        onChange={(value, { country }) => {
          // Once the number is complete, drop a leading 0 (0300… becomes +92 300…).
          const parsed = parsePhoneNumberFromString(value);
          setPhone(parsed?.isValid() ? parsed.number : value);
          setDialCode(country.dialCode);
          setLeftField(false);
        }}
        placeholder={placeholder}
        disableDialCodeAndPrefix
        allowMaskOverflow
        showDisabledDialCodeAndPrefix
        inputProps={{
          type: "tel",
          autoComplete: "tel",
          "aria-invalid": showError || undefined,
          onBlur: () => setLeftField(true),
        }}
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
